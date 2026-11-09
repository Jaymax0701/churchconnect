# ChurchConnect Family and Household Architecture

Status: design decision for the registration and privacy work. This document is not a database migration.

## 1. Core model

A household is a group of related people. A ChurchConnect login is an authentication identity. These are separate concepts.

- Every person in the household has one family-member/person record.
- A person may have a linked Supabase Auth account, but an account is not required for every person.
- Never create placeholder Auth users or shared passwords for children.
- A family has one primary Family Leader initially.
- The Family Leader manages shared household details and coordinates family membership.
- Church account approval, role assignment, congregation membership, and minor safeguarding review remain separate workflows.

## 2. Age and account policy

Age is calculated from the person's date of birth using the church's configured local date, not a client-supplied age.

- Under 12: no individual login account; the Family Leader manages the child's person record.
- Ages 12–17: individual login accounts are permitted, subject to the under-18 safeguarding/guardian review and the normal account approval workflow. The account holder owns their password and authentication factors.
- 18 and above: individual login account and self-management of authentication credentials.
- Future enhancement: when a managed child reaches their 13th birthday, show an optional action inviting them to create/link an individual ChurchConnect account. This is an option, not an automatic account creation. Preserve the existing person/family record and do not create a duplicate person. The feature is intentionally deferred until the family foundation and registration work are complete.

The age-13 prompt is a future account-onboarding enhancement; it does not silently change the age policy above or automatically create an account.

## 3. Household membership

Default household registration is immediate family. Extended family is optional.

Immediate-family relationship values (relative to the Family Leader):
- spouse
- father
- mother
- son
- daughter

Optional extended-family values:
- grandfather
- grandmother
- grandson
- granddaughter
- brother
- sister
- uncle
- aunt
- nephew
- niece
- cousin
- guardian
- ward
- other_relative
- other_household_member

In-law relationships are not part of the default immediate-family list. They may be added as optional extended relationships where relevant. Do not assume an in-law belongs to the same household merely because of the relationship.

Relationship values are recorded relative to a clearly identified reference person (initially the Family Leader). Do not infer reciprocal relationships automatically where ambiguity exists. Allow a short custom description for the "other" values.

A person may have one active primary household in the initial release. Design for future multiple-household affiliations (for example, children whose parents live separately), but do not implement that complexity in the first release.

## 4. Family permissions and approvals

Family Leader can:
- create and update shared household details (family display name, household address, shared contact details);
- invite or request to add people to their household;
- approve or reject household join requests;
- review and approve/reject profile-change requests submitted by other household members;
- manage records for children who do not have login accounts.

A family member may submit proposed changes to their own personal details. For family-managed fields, the request is pending until the Family Leader approves it. The system must preserve current values until approval and retain requester, proposed values, decision, reviewer and timestamps.

The Family Leader must not:
- view, set, reset, or change another person's password;
- access another person's private authentication factors or private login email without a separately authorised account-management workflow;
- approve their own change requests;
- bypass Church Administration account approval or minor safeguarding review.

The Family Leader's approval is not a substitute for Church Administration approval, legal guardian authority, safeguarding checks, or a person's own legally required consent.

## 5. Suggested data model

This is the intended logical model; exact SQL, constraints, RLS policies and migration order must be reviewed against the live schema before deployment.

### families
- id (UUID primary key)
- family_name
- household_address fields
- shared_contact details (only what is needed)
- primary_leader_member_id
- created_at, updated_at

### family_members
- id (UUID primary key; person/household-member identity)
- family_id
- auth_user_id (nullable unique FK to auth.users; NULL for children without login)
- full_name
- date_of_birth
- relationship_to_leader
- relationship_description (nullable)
- member_status (pending, active, rejected, removed)
- added_by / joined_at
- created_at, updated_at

The family-member record is the durable person identity. Linking an Auth account later must attach to the existing record, not create a duplicate person.

### family_change_requests
- id
- family_member_id (whose details are changing)
- requested_by_auth_user_id
- change_type / proposed values
- status (pending, approved, rejected, cancelled)
- reviewed_by_auth_user_id
- reviewed_at, decision_note
- created_at

Use an auditable, typed change representation; never accept arbitrary client-supplied column names or SQL fragments.

### Consent and minor review
Privacy/guardian consent events must identify:
- the person the record concerns (family_member_id);
- who provided/recorded the consent (actor Auth user / guardian);
- consent type, policy version, language, choice, source and timestamp;
- the basis/relationship/authority recorded for acting on behalf of a child, where applicable.

Minor safeguarding review is separate from consent. Record review status, reviewer, timestamp and the church's process reference. A "cleared" status is an administrative marker, not proof of legal guardian authority by itself.

### Existing tables
- public.profiles remains the Auth-linked profile/account record.
- public.congregation_memberships remains a separate church-membership record. It must be extended or redesigned to refer to a person/family-member identity if children without Auth accounts need congregation membership.
- public.user_roles remains an account authorisation structure; do not assign roles to non-login child records.

## 6. Registration and linking flows

1. Adult/eligible Family Leader creates their own Auth account and verifies email.
2. Family Leader creates a household and adds person records for immediate family.
3. Children under 12 are added as managed family-member records without Auth users.
4. Members who are eligible for login register with their own email/password and request to join the household, or accept a secure invitation.
5. The Family Leader approves the household link. Church account approval and minor review remain separate.
6. When a managed child later creates an account (including the future optional age-13 prompt), securely link the Auth identity to the existing family-member record after verification and approval. Enforce uniqueness to prevent duplicate person records.

## 7. Required security controls

- RLS must scope family reads/writes to active household membership and explicit permissions.
- Do not rely on hidden UI controls; enforce Family Leader authority in database policies or trusted server-side functions.
- Derive the actor from auth.uid()/verified JWT. Never trust a caller-supplied actor ID.
- Family Leader must not approve their own change requests.
- Prevent unauthorised changes to family_id, auth_user_id, relationship, leader designation, DOB, and review status.
- Keep audit history for membership, leader, profile-change and consent decisions.
- Use server-side functions for privileged transitions and linking identities.
- Keep Auth secrets and service-role credentials server-side only.

## 8. Dependency for PR #26

The current PR #26 SQL assumes every person being registered has an Auth user. Its profiles.date_of_birth and privacy_consent_records.user_id-only design cannot represent a child under 12 without a login. Do not execute the current PR #26 SQL as-is.

Before PR #26 can be considered deployable, reconcile DOB, consent and minor-review records with the family-member/person identity described above. The Auth trigger must not be used to create under-12 child records; those records must be created through a Family Leader-authorized workflow. The family schema and RLS must be reviewed before the signup/consent UI is enabled.

## 9. Out of scope for the first family release

- Multiple primary Family Leaders (start with one; secondary family administrator can be added later).
- Multiple active household affiliations for one person.
- Automatic account creation at age thresholds.
- Automatic transfer of household ownership.
- Treating Family Leader approval as a replacement for church or safeguarding approval.
