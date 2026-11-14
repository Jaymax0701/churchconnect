# ChurchConnect Family and Household Architecture

Status: approved product rules and implementation design. This document is not a database migration.

## 1. Core model

A person, a login account, a household, and a church membership are separate records.

- `people` is the durable identity for every individual.
- `profiles` is the authenticated account profile and links to `people`.
- `families` represents a household.
- `family_members` links people to a household.
- `congregation_memberships` links a person to church membership independently of login access.
- Never create placeholder Auth users or shared passwords for children.

A family has one primary Family Leader in the first release. The Family Leader is an appointed household role, not automatically the parent, oldest member, or legal guardian. When creating a family, the creator may appoint themselves as the initial Family Leader or nominate another eligible household member; a nominee must accept. Leadership transfer requires acceptance by the successor and is recorded in audit history. Superadmin may intervene in exceptional cases through an audited trusted workflow. Church account approval, roles, congregation membership, family approval, and minor safeguarding review remain separate workflows.

## 2. Age and account policy

Age is calculated from date of birth using Malaysia local date (Asia/Kuching for the initial Sarawak deployment), not a client-supplied age. The database and browser must use the same local calendar date.

- **Under 12:** no individual login account. The Family Leader creates and manages the child's person record.
- **12–17:** an individual login account is permitted. The account holder owns their password and authentication factors. Under-18 safeguarding/guardian review and normal account approval remain required.
- **18+:** individual login account and self-management of authentication credentials.
- **Future age-13 enhancement:** on the child's 13th birthday, show an optional action to create/link an individual account. It must never create an account automatically. The new Auth identity must link to the existing person record without creating a duplicate. This feature is deferred until the initial family foundation is complete.

The age-13 option does not change the policy that under-12 children have no login.

## 3. Household membership and relationships

Immediate family is the default. Extended family is optional. In-law relationship categories are excluded from the initial release; do not add them automatically or offer them in the registration interface.

Immediate relationships (relative to the Family Leader): spouse, father, mother, son, daughter.

Optional extended relationships: grandfather, grandmother, grandson, granddaughter, brother, sister, uncle, aunt, nephew, niece, cousin, guardian, ward, other relative, and other household member. In-law relationship categories are excluded from the initial release.

A short custom description is available for the two "other" categories. Relationships are recorded relative to the Family Leader. Do not infer reciprocal relationships automatically.

Initial release: one active primary household per person. Design for future split-household/custody arrangements, but do not implement multiple active households in this release.

## 4. Family permissions and approvals

The Family Leader can:
- self-appoint as initial leader when creating the household, or accept an appointment from the creator;
- accept a leadership transfer from the current leader; a nominee must accept before the transfer takes effect;
- create and update shared household details (family name, household address, shared contact details);
- add managed children under 12 without creating Auth accounts;
- invite or approve eligible members who have their own login accounts;
- approve or reject household join requests;
- approve or reject personal-detail change requests submitted by other household members;
- maintain household relationships and member status.

A member's proposed personal-detail change remains pending until the Family Leader approves it. Current values must not be overwritten before approval. Retain requester, proposed values, decision, reviewer, timestamps and audit information.

The Family Leader cannot:
- view, set, reset, or change another person's password;
- access another person's private authentication factors;
- approve their own change request;
- bypass church account approval or minor safeguarding review.

Family Leader approval is not a substitute for legal guardian authority, safeguarding checks, church administrator approval, or legally required consent. A Family Leader who is not the child's legal parent/guardian may still register/manage the child's household record, but must not provide or attest to guardian consent merely because they hold the Family Leader role. Where guardian consent is required, record the actual parent/legal guardian as the consent actor separately, including their relationship and the basis/confirmation of authority.

## 5. Data model

### `people`
One row per individual, regardless of login status:
- `id` UUID primary key;
- `auth_user_id` nullable unique FK to `auth.users` (NULL for managed children without login);
- `full_name`, `date_of_birth`;
- `minor_review_status`, `minor_reviewed_at`, `minor_reviewed_by`;
- `created_by_auth_user_id`, timestamps.

### `profiles`
Existing Auth-linked account profile. A non-null unique `person_id` links it to `people`. Account approval remains here and is separate from the person's minor review state.

### `families`
Household name, address, optional shared contact phone, creator person/Auth user and timestamps.

### `family_members`
Household/person link, relationship group (immediate/extended), relationship to Family Leader, optional custom description, primary-leader flag, membership status, adding Auth user and timestamps.

### `family_change_requests`
Family and target person, requesting Auth user, proposed values in a typed/allowlisted JSON object, status (pending/approved/rejected/cancelled), reviewer, decision note and timestamps.

### Consent and minor review
Consent records identify the person, consent type, notice version/language, choice, source, timestamp, and who recorded/provided the consent. A Family Leader may register a child even when they are not the legal parent/guardian. If parent/guardian consent is required, the actual parent/legal guardian must be separately identified as the consent actor; record their relationship and authority. The Family Leader's appointment does not confer guardian authority. Minor safeguarding review is separate from consent.

### `congregation_memberships`
Retains the existing church-membership workflow but gains a `person_id` link. `user_id` becomes nullable for people without login accounts. Church membership remains independent of household membership and Auth approval.

### `user_roles`
Remains an account authorisation structure. Do not assign login roles to managed child person records without Auth accounts.

## 6. Registration and account linking

1. An eligible person registers their own Auth account, verifies email, and passes normal ChurchConnect approval.
2. The person creates a household and either self-appoints as its initial Family Leader or nominates another eligible member, who must accept.
3. The Family Leader adds immediate-family person records.
4. Children under 12 are created as managed person/family-member records without Auth users.
5. People aged 12+ and adults register using their own credentials and request to join a household or accept a secure invitation.
6. The Family Leader approves the household link. Account approval and minor review remain separate.
7. When a managed child later creates an account (including the future optional age-13 prompt), link the verified Auth identity to the existing person record. Enforce uniqueness and do not create a duplicate person.

## 7. Security requirements

- RLS scopes reads to the person and active household; sensitive person details such as DOB are visible to the person and authorised Family Leader only.
- A non-leader household member cannot directly update their own profile name; they must use the Family Leader approval workflow. Superadmin name updates synchronise the Auth profile and durable person record through a trusted database function.
- Other household members receive a roster-safe view that does not expose DOB or other restricted details.
- Family writes and privileged transitions use trusted server-side functions; hiding buttons is not security.
- Derive the actor from verified JWT/`auth.uid()`; never trust caller-supplied actor IDs.
- Family Leader cannot approve their own change request.
- Family Leader appointment/transfer must be performed by an explicitly authorised appointment process and recorded in audit history; do not let a normal member update `is_primary_leader` directly. The family creator may self-appoint during initial creation. A nominee or transfer successor must accept.
- Protect `family_id`, `person_id`, `auth_user_id`, relationship, leader designation, DOB, and review status from direct client mutation.
- Keep audit history for membership, leader, profile-change and consent decisions.
- Service-role credentials remain server-side only.

## 8. Initial family workflow implementation (PR #26)

The additive review migration `supabase/review/0010_family_creation_and_managed_children.review.sql` implements the first trusted write workflows:

- An approved authenticated member can create one household and self-appoint as its initial primary Family Leader in a single transaction.
- The caller identity is derived from `auth.uid()`; the caller cannot supply another actor.
- The active primary Family Leader can add a child under 12 as a managed `people` record with no Auth user, profile, login, or password.
- Family creation and managed-child addition are recorded in an append-only `family_audit_log`.
- The migration does not claim guardian consent. A Family Leader may manage a child's household record without being their legal guardian; actual guardian consent must be collected through a separate verified workflow.

The migration is additive because the 0008 and 0009 structures have already been applied to the current Supabase project. Do not rerun 0008 or 0009. Review and apply 0010 manually only after checking it against the live catalog.

PR #34 adds the first family workspace increment: an all-member household roster, with DOB exposed only to the active primary Family Leader, and trusted household-detail updates with audit logging. Its review-only migration is `supabase/review/0012_family_workspace_roster_and_household_updates.review.sql`; apply it manually only after reviewing and confirming the target Supabase project. The UI degrades gracefully until the migration is applied.

PR #35 adds a reviewed invitation increment: approved active primary Family Leaders can invite an email address using a 14-day, single-use link; the invitee must accept using the matching verified email on their own ChurchConnect account. The invitee must have an approved account and cleared safeguarding review before household membership becomes active. Under-12s remain managed-child records. Migration `0013_family_member_invitations.review.sql` is review-only and must be manually inspected and applied to the confirmed Supabase project before invitation tools are usable. The application creates a shareable link but does not send email automatically; the Family Leader shares it through their preferred channel.

Still to implement: nomination and accepted leadership transfer, profile-change approval, guardian-consent capture/verification, managed-child Superadmin review, account linking, automated invitation email delivery, and cross-family negative tests.

## 9. PR #26 database work and deployment gate

The PR branch contains two review-only SQL files, in this order:

1. `supabase/review/0008_family_household_foundation.review.sql` — creates person/household structures, backfills existing Auth profiles to people, links congregation memberships, and adds RLS read policies.
2. `supabase/review/0009_pdpa_dob_consent_and_minor_review.review.sql` — links Auth signups and consent records to people, and stores minor review against the person.

Both scripts must be reviewed against the live Supabase catalog before manual execution. No SQL has been applied by these changes.

The schema foundation does not yet provide all trusted write workflows or UI needed to create families, add managed children, process join requests, approve changes, link accounts, or record guardian consent. Do not enable public family registration or deploy this PR until those server-side workflows, screens, behavioral tests and RLS checks are complete.

The signup UI blocks individual account creation for under-12 registrations. It explains that a Family Leader must register the child as a managed member; that workflow must be completed before public rollout.

The follow-up review migration `supabase/review/0011_enforce_under_12_no_login.review.sql` adds the same restriction to the trusted Auth user-creation trigger. This closes the direct-API bypass that the browser-only check cannot prevent. It also keeps signup and managed-child DOB calculations aligned to `Asia/Kuching`. PR #33 was merged into `main`; the migration itself remains review-only and must be manually inspected and applied to the verified Supabase project. Its application to Supabase has not been confirmed.

## 10. Out of scope for first release

- Multiple simultaneous primary Family Leaders (one primary leader initially; a secondary family administrator may follow).
- Multiple active household affiliations for a person.
- Automatic account creation at age thresholds.
- Automatic transfer of household ownership.
- Treating Family Leader approval as a replacement for church approval, guardian authority or safeguarding review.
