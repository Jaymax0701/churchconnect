# ChurchConnect Ministry Leadership Scope Design

Status: Proposed design for staging review. Documentation only; no database changes.

## Decision

Use both sources of ministry leadership:

- `public.ministries.leader_id` identifies the single primary leader.
- `public.user_roles` rows with `scope_type = 'ministry'`, `ministry_id` equal to that ministry, and role ID `ministry_leader` record ministry-scoped leadership assignments.

**Recommended model: one primary leader plus optional additional ministry leaders.** Additional leaders may hold the ministry-scoped `ministry_leader` role without being the primary leader. Their permissions must be explicitly defined in the permission matrix; they must not automatically gain primary-leader-only actions.

Neither source alone grants unrestricted access. RLS and the authoritative permission function must enforce both capability and row scope.

## Consistency invariants

1. A non-null `ministries.leader_id` must have a matching ministry-scoped `ministry_leader` assignment for that same ministry.
2. A ministry-scoped `ministry_leader` assignment does not designate the primary leader. It can represent an additional leader, subject to the permission matrix.
3. A user may lead multiple ministries unless a later product rule explicitly prohibits it; do not add an unsupported uniqueness constraint on `leader_id`.
4. Leadership-only access requires the actor's authenticated identity, approved/active membership, required module/action capability, active ministry, and matching ministry scope. Primary-leader-only actions additionally require `ministries.leader_id = auth.uid()`.
5. If `leader_id` has no matching role assignment, deny leadership-only access and flag the mismatch for administrative repair. A role assignment scoped to one ministry never authorizes access to another ministry.
6. Appointing, transferring, or clearing the primary leader must update `leader_id` and the corresponding `user_roles` assignment in one authorized transaction. Prevent direct client writes that could leave the two sources inconsistent.
7. Removing a user's additional leader role must not clear a different user's primary leadership. Removing the primary leader's assignment must either transfer leadership atomically or clear both sources atomically.
8. Global `superadmin` authority is a separate, explicitly checked administrative path; it is not inferred from ministry scope and remains subject to relational integrity and protected-role safeguards.
9. Role assignment changes must not permit self-promotion, unauthorized assignment, bypass of role hierarchy, or unauthorized changes to system roles.
10. Foreign-key deletion behavior must be deliberate and tested. Deleting an auth user must not transfer leadership implicitly; `ON DELETE SET NULL` is proposed for `leader_id`.

## Proposed schema and operation design

- Add nullable `ministries.leader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL`.
- Add an index on `ministries(leader_id)` if query plans and access patterns justify it.
- Keep existing `user_roles` scope CHECK constraints and unique assignment index.
- Implement a controlled database operation/RPC to appoint or replace a primary leader. It must validate actor authority, target account approval, ministry activity, canonical role ID, and any role-hierarchy restriction; then upsert the matching ministry-scoped `ministry_leader` assignment and update `ministries.leader_id` atomically.
- Implement controlled removal/transfer that keeps both sources consistent. Concurrency control must prevent competing transfers from leaving an invalid state.
- Define the permission matrix before implementation: identify which actions are available to primary leaders versus additional leaders. Until then, additional leaders should receive no implicit primary-leader-only authority.
- Add a consistency audit query and tests to detect any mismatch between `leader_id` and ministry-scoped `ministry_leader` assignments.

## Required tests

- Appoint a primary leader: both records update in one transaction.
- Add an additional leader without changing `leader_id`.
- Transfer primary leadership: old and new assignments remain consistent.
- Reject unauthorized actors, unapproved targets, inactive ministries, self-promotion, and protected-role bypass.
- A Ministry A leader cannot read or mutate Ministry B leadership-scoped records.
- Additional leaders cannot perform actions reserved for the primary leader.
- Removing a primary leader role cannot leave a stale `leader_id`; removing an additional leader cannot disturb the primary leader.
- Clearing or deleting the auth user cannot leave an invalid leader reference.
- A mismatch between `leader_id` and `user_roles` denies leadership-only access and is reported for repair.
- Capability denial still denies access even when both leadership records agree.
- Concurrent leadership transfers cannot violate the consistency invariants.

## Implementation gate

This document records the recommended design only. Before writing an executable migration, finish the staging grant inventory, define the approval/status model and its initial-account policy, agree the role/module/action/scope permission matrix, and verify function/RLS behavior with tests. No SQL or database changes are applied by this document.
