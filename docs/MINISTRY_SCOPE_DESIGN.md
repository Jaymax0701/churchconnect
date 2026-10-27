# ChurchConnect Ministry Leadership Scope Design

Status: Proposed design for review. Documentation only; no database changes.

## Decision

ChurchConnect will use both:

- `public.ministries.leader_id`: the designated primary leader for a ministry.
- `public.user_roles` rows with `scope_type = 'ministry'` and matching `ministry_id`: the user's ministry-scoped role assignment.

Neither source alone grants unrestricted access. Database RLS and the authoritative permission function must enforce both capability and row scope.

## Consistency invariants

1. A designated leader must have a matching ministry-scoped `ministry_leader` role assignment for that same ministry.
2. A ministry-scoped role assignment does not, by itself, designate the user as the primary leader. Volunteers and other ministry roles may be assigned without setting `leader_id`.
3. A user can be designated primary leader of multiple ministries only if the product explicitly allows it; the schema must not silently impose a single-ministry assumption.
4. A leadership-only operation is allowed only when the actor has the required module/action permission, is an approved active member, the ministry is active, and both leadership sources agree.
5. If the `leader_id` points to a user without the matching ministry-scoped leader role, or a role assignment's ministry scope is inconsistent with the record being accessed, deny leadership-only access and flag the mismatch for administrative repair.
6. Replacing or clearing `leader_id` and removing/demoting a ministry leader role must be performed through one authorized transaction that updates both sources consistently. Do not expose independent client writes that can leave them inconsistent.
7. A ministry-scoped role for Ministry A never grants leadership access to Ministry B.
8. Global `superadmin` authority is a separate, explicitly checked administrative path; it must not be inferred from ministry scope.
9. Role assignment changes must not allow self-promotion, self-assignment to protected roles, or bypass the approved role hierarchy.
10. Foreign-key deletion behavior must be deliberate. Deleting a user should not accidentally transfer leadership; ministry deletion and auth-user deletion must be tested against the chosen FK actions.

## Proposed schema details

- Add nullable `ministries.leader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL` unless product requirements demand a different deletion policy.
- Add an index on `ministries(leader_id)` if query plans and access patterns justify it.
- Keep existing `user_roles` scope CHECK constraints and unique assignment index.
- Define a transaction/RPC for appointing or replacing a primary ministry leader. It should validate the actor's authority, target user's approval status, ministry activity, and canonical role ID; then upsert the matching ministry-scoped `ministry_leader` assignment and update `ministries.leader_id` atomically.
- Define a controlled removal/transfer operation that clears or changes `leader_id` and removes or updates the old leader assignment atomically.
- If a user can hold `ministry_leader` role assignments without being primary leader, that role may represent deputy/team leadership only if the product explicitly defines those permissions. Otherwise, use a separate role or assignment attribute. This distinction must be decided before migration.

## Open product decision

Choose whether every ministry-scoped `ministry_leader` assignment must be the primary leader, or whether additional/deputy leaders can hold that role. Until decided, do not create the migration, seed permissions, or implement leader assignment RPCs.

## Required tests

- Appoint a leader: both records update in one transaction.
- Transfer leadership: old and new records remain consistent.
- Reject an unauthorized actor.
- Reject self-promotion and self-assignment.
- Ministry A leader cannot read or mutate Ministry B leadership-scoped records.
- Removing a leader role cannot leave an unintended stale `leader_id`.
- Clearing or deleting the auth user cannot leave an invalid leader reference.
- A mismatch between `leader_id` and `user_roles` denies leadership-only access.
- Capability denial still denies access even if both leadership records agree.
- Inactive ministries and unapproved accounts are denied protected access.

No SQL or database changes are applied by this document.
