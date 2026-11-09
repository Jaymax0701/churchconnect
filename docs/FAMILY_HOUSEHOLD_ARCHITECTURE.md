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

A family has one primary Family Leader in the first release. Church account approval, roles, congregation membership, family approval, and minor safeguarding review remain separate workflows.

## 2. Age and account policy

Age is calculated from date of birth using the church's configured local date, not a client-supplied age.

- **Under 12:** no individual login account. The Family Leader creates and manages the child's person record.
- **12–17:** an individual login account is permitted. The account holder owns their password and authentication factors. Under-18 safeguarding/guardian review and normal account approval remain required.
- **18+:** individual login account and self-management of authentication credentials.
- **Future age-13 enhancement:** on the child's 13th birthday, show an optional action to create/link an individual account. It must never create an account automatically. The new Auth identity must link to the existing person record without creating a duplicate. This feature is deferred until the initial family foundation is complete.

The age-13 option does not change the policy that under-12 children have no login.

## 3. Household membership and relationships

Immediate family is the default. Extended family is optional. In-laws are not automatically part of a household; they may be added as optional extended members when appropriate.

Immediate relationships (relative to the Family Leader):
- spouse, father, mother, son, daughter.

Optional extended relationships:
- grandfather, grandmother, grandson, granddaughter;
- brother, sister, uncle, aunt, nephew, niece, cousin;
- father-in-law, mother-in-law, son-in-law, daughter-in-law, brother-in-law, sister-in-law;
- guardian, ward, other relative, other household member.

A short custom description is available for the two "other" categories. Relationships are recorded relative to the Family Leader. Do not infer reciprocal relationships automatically.

Initial release: one active primary household per person. Design for future split-household/custody arrangements, but do not implement multiple active households in this release.

## 4. Family permissions and approvals

The Family Leader can:
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

Family Leader approval is not a substitute for legal guardian authority, safeguarding checks, church administrator approval, or legally required consent.

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
- `id`, `family_name`, `household_address`, optional shared contact phone;
- creator person and Auth user;
- timestamps.

### `family_members`
- `id`, `family_id`, `person_id`;
- `relationship_group` (immediate/extended);
- `relationship_to_leader`, optional custom description;
- `is_primary_leader`;
- `status` (pending/active/rejected/removed);
- adding Auth user, join and audit timestamps.

### `family_change_requests`
- family and target person;
- requesting Auth user;
- proposed values in a typed/allowlisted JSON object;
- status (pending/approved/rejected/cancelled);
- reviewer, decision note and timestamps.

### Consent and minor review
Consent records identify the person, consent type, notice version/language, choice, source, timestamp, and who recorded/provided the consent. A parent/guardian acting for a child must have their relationship and authority explicitly recorded; Family Leader status alone does not prove legal guardian authority. Minor safeguarding review is separate from consent.

### `congregation_memberships`
Retains the existing church-membership workflow but gains a `person_id` link. `user_id` becomes nullable for people without login accounts. Church membership remains independent of household membership and Auth approval.

### `user_roles`
Remains an account authorisation structure. Do not assign login roles to managed child person records without Auth accounts.

## 6. Registration and account linking

1. An eligible Family Leader registers their own Auth account, verifies email, and passes normal ChurchConnect approval.
2. The Family Leader creates a household and adds immediate-family person records.
3. Children under 12 are created as managed person/family-member records without Auth users.
4. People aged 12+ and adults register using their own credentials and request to join a household or accept a secure invitation.
5. The Family Leader approves the household link. Account approval and minor review remain separate.
6. When a managed child later creates an account (including the future age-13 prompt), link the verified Auth identity to the existing person record. Enforce uniqueness and do not create a duplicate person.

## 7. Security requirements

- RLS scopes reads to the person and active household; sensitive person details such as DOB are visible to the person and authorised Family Leader only.
- Other household members receive a roster-safe view that does not expose DOB or other restricted details.
- Family writes and privileged transitions use trusted server-side functions; hiding buttons is not security.
- Derive the actor from verified JWT/`auth.uid()`; never trust caller-supplied actor IDs.
- Family Leader cannot approve their own change request.
- Protect `family_id`, `person_id`, `auth_user_id`, relationship, leader designation, DOB, and review status from direct client mutation.
- Keep audit history for membership, leader, profile-change and consent decisions.
- Service-role credentials remain server-side only.

## 8. PR #26 database work and deployment gate

The PR branch contains:
- `supabase/review/0008_family_household_foundation.review.sql`: creates person/household structures, backfills existing Auth profiles to people, links congregation memberships, and adds RLS read policies. It is review-only.
- `supabase/review/0009_pdpa_dob_consent_and_minor_review.review.sql`: the next migration in sequence; links Auth signups and consent records to people, and stores minor review against the person. It is review-only.

Apply in numeric order only after reviewing the complete scripts against the live Supabase catalog. No SQL has been applied by this change.

The schema foundation does not yet provide all trusted write workflows or UI needed to create families, add managed children, process join requests, approve changes, link accounts, or record guardian consent. Do not enable public family registration or deploy this PR until those server-side workflows, screens, behavioral tests and RLS checks are complete.

The signup UI blocks individual account creation for under-12 registrations. It explains that a Family Leader must register the child as a managed member; that workflow must be completed before public rollout.

## 9. Out of scope for first release

- Multiple primary Family Leaders (one primary leader initially; a secondary family administrator may follow).
- Multiple active household affiliations for a person.
- Automatic account creation at age thresholds.
- Automatic transfer of household ownership.
- Treating Family Leader approval as a replacement for church approval, guardian authority or safeguarding review.
