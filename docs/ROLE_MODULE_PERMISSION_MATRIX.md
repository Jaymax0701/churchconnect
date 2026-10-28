# ChurchConnect Role/Module Permission Matrix

Status: Decision template — no grants are implied by this document.

## Purpose

This matrix is the required owner-review artifact before writing permission seeds or RLS policies. The database currently contains six canonical role IDs and twelve canonical module IDs, but no live permission assignments in staging. Do not infer permissions from role names or seed them automatically.

## Rules for completing this matrix

- Use exact role IDs and module IDs below; IDs are case-sensitive.
- For each role/module pair, explicitly choose `ALLOW`, `DENY`, or `PENDING` for each action.
- An omitted or `PENDING` decision must remain denied by the implementation until explicitly approved.
- Role-derived grants are only a capability baseline. Approval status, authentication, module/record scope, ministry assignment, and ownership constraints still apply.
- An explicit per-user `DENY` overrides role grants. An explicit per-user `ALLOW` never bypasses those constraints.
- Do not translate legacy `permissions` / `role_permissions` rows automatically. They are empty in the staging restore, and the legacy action/scope model differs from the proposed CRUD booleans.
- Define `manage`, `approve`, and `assign` separately before mapping any legacy capability or administrative action.

## Canonical roles

| Role ID | Current description |
| --- | --- |
| `superadmin` | Platform administration |
| `church_council` | Authorized governance functions |
| `church_admin` | Church administration |
| `ministry_leader` | Leadership within an assigned ministry |
| `ministry_volunteer` | Assigned ministry duties |
| `member` | Standard authenticated member |

## Canonical modules

| Module ID | Current name |
| --- | --- |
| `public_site` | Public Website |
| `member_portal` | Member Portal |
| `congregation` | Congregation |
| `cell_groups` | Cell Groups |
| `children` | Children Ministry |
| `cms` | Content Management |
| `evangelism` | Evangelism |
| `men` | Men Ministry |
| `praise_worship` | Praise & Worship |
| `sunday_service` | Sunday Service |
| `women` | Women Ministry |
| `youth` | Youth Ministry |

## Matrix template

For each role/module pair, decide `view`, `create`, `update`, and `delete`. Use `PENDING` until approved. This template intentionally does not supply permissions based on assumptions.

| Role ID | Module ID | View | Create | Update | Delete | Scope / notes |
| --- | --- | --- | --- | --- | --- | --- |
| `superadmin` | all modules | PENDING | PENDING | PENDING | PENDING | Proposed global administrative capability; still subject to integrity and audit safeguards |
| `church_council` | all modules | PENDING | PENDING | PENDING | PENDING | Define governance-only modules and actions |
| `church_admin` | all modules | PENDING | PENDING | PENDING | PENDING | Define administration scope; cannot manage protected superadmin assignments |
| `ministry_leader` | all modules | PENDING | PENDING | PENDING | PENDING | Only within explicitly assigned/led ministry scope where applicable |
| `ministry_volunteer` | all modules | PENDING | PENDING | PENDING | PENDING | Only assigned duties and ministry scope |
| `member` | all modules | PENDING | PENDING | PENDING | PENDING | Protected records remain self-scoped unless separately approved |

## Additional decisions required

1. **Approval:** new accounts should default to unapproved; specify the trusted bootstrap process for the first approved superadmin.
2. **Role hierarchy:** decide whether hierarchy is required now. If yes, assign a unique, explicit hierarchy level to each canonical role ID and define whether larger or smaller numbers mean greater authority.
3. **Special capabilities:** define `manage`, `approve`, and `assign` independently of CRUD, including which roles may grant roles or approve members.
4. **Public content:** identify the exact public-site data sources and columns that anonymous visitors may read. Do not infer this from the `public_site` module alone.
5. **Ministry scope:** the agreed design is one primary leader via `ministries.leader_id`, with additional leaders represented by ministry-scoped `user_roles`; leadership-only access requires the records to agree. Decide which roles can appoint, replace, and remove leaders, and ensure those changes are transactional.
6. **Authentication:** current login is a demonstration form, so end-to-end authorization remains unverified until real Supabase Auth sign-in/session flows are implemented.

## Implementation gate

No permission rows, CRUD grants, RLS policies, or security-definer authorization functions should be generated from this template until the owner approves the matrix and the special-capability, approval, hierarchy, and bootstrap decisions.
