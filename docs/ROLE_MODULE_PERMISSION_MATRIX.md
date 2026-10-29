# ChurchConnect Role/Module Permission Matrix

Status: Decision template — no grants are implied by this document.

## Purpose

This matrix is the required owner-review artifact before writing permission seeds or RLS policies. The database currently contains six canonical role IDs and twelve canonical module IDs, but no live permission assignments in staging. Do not infer permissions from role names or seed them automatically.

## Rules for completing this matrix

- Use exact role IDs and module IDs below; IDs are case-sensitive.
- For each role/module pair, explicitly choose `ALLOW`, `DENY`, or `PENDING` for each action.
- An omitted or `PENDING` decision must remain denied by the implementation until explicitly approved.
- Role-derived grants are only a capability baseline. Approval status, authentication, module/record scope, ministry assignment, ownership constraints, and agreed safeguards still apply.
- **Owner-approved exception (2026-10-28):** a valid, authenticated, approved `superadmin` bypasses ordinary per-user overrides, including explicit per-user `DENY` and `ALLOW` values. Evaluate this path before per-user overrides. It does not bypass authentication, account integrity/approval, applicable record/ministry scope, database constraints, or audit safeguards.
- For non-superadmins, an explicit per-user `DENY` overrides role grants; an explicit per-user `ALLOW` never bypasses the safeguards above.
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

## Explicit role/module decision matrix (72 pairs)

Each of the six canonical roles is listed against each of the twelve canonical modules. All four CRUD decisions intentionally remain `PENDING`; this is a review aid, not an authorization decision. For each cell, the owner must replace `PENDING` with `ALLOW` or `DENY` after review. Any remaining `PENDING` must fail closed. Scope notes are guardrails, not grants.

| Role ID | Module ID | View | Create | Update | Delete | Scope / notes |
| --- | --- | --- | --- | --- | --- | --- |
| `superadmin` | `public_site` | PENDING | PENDING | PENDING | PENDING | PENDING — precedence exception does not itself grant this module/action; safeguards still apply. |
| `superadmin` | `member_portal` | PENDING | PENDING | PENDING | PENDING | PENDING — precedence exception does not itself grant this module/action; safeguards still apply. |
| `superadmin` | `congregation` | PENDING | PENDING | PENDING | PENDING | PENDING — precedence exception does not itself grant this module/action; safeguards still apply. |
| `superadmin` | `cell_groups` | PENDING | PENDING | PENDING | PENDING | PENDING — precedence exception does not itself grant this module/action; safeguards still apply. |
| `superadmin` | `children` | PENDING | PENDING | PENDING | PENDING | PENDING — precedence exception does not itself grant this module/action; safeguards still apply. |
| `superadmin` | `cms` | PENDING | PENDING | PENDING | PENDING | PENDING — precedence exception does not itself grant this module/action; safeguards still apply. |
| `superadmin` | `evangelism` | PENDING | PENDING | PENDING | PENDING | PENDING — precedence exception does not itself grant this module/action; safeguards still apply. |
| `superadmin` | `men` | PENDING | PENDING | PENDING | PENDING | PENDING — precedence exception does not itself grant this module/action; safeguards still apply. |
| `superadmin` | `praise_worship` | PENDING | PENDING | PENDING | PENDING | PENDING — precedence exception does not itself grant this module/action; safeguards still apply. |
| `superadmin` | `sunday_service` | PENDING | PENDING | PENDING | PENDING | PENDING — precedence exception does not itself grant this module/action; safeguards still apply. |
| `superadmin` | `women` | PENDING | PENDING | PENDING | PENDING | PENDING — precedence exception does not itself grant this module/action; safeguards still apply. |
| `superadmin` | `youth` | PENDING | PENDING | PENDING | PENDING | PENDING — precedence exception does not itself grant this module/action; safeguards still apply. |
| `church_council` | `public_site` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_council` | `member_portal` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_council` | `congregation` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_council` | `cell_groups` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_council` | `children` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_council` | `cms` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_council` | `evangelism` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_council` | `men` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_council` | `praise_worship` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_council` | `sunday_service` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_council` | `women` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_council` | `youth` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_admin` | `public_site` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_admin` | `member_portal` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_admin` | `congregation` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_admin` | `cell_groups` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_admin` | `children` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_admin` | `cms` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_admin` | `evangelism` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_admin` | `men` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_admin` | `praise_worship` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_admin` | `sunday_service` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_admin` | `women` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `church_admin` | `youth` | PENDING | PENDING | PENDING | PENDING | PENDING — owner decision required; do not infer from role/module names. |
| `ministry_leader` | `public_site` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_leader` | `member_portal` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_leader` | `congregation` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_leader` | `cell_groups` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_leader` | `children` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_leader` | `cms` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_leader` | `evangelism` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_leader` | `men` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_leader` | `praise_worship` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_leader` | `sunday_service` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_leader` | `women` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_leader` | `youth` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_volunteer` | `public_site` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_volunteer` | `member_portal` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_volunteer` | `congregation` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_volunteer` | `cell_groups` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_volunteer` | `children` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_volunteer` | `cms` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_volunteer` | `evangelism` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_volunteer` | `men` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_volunteer` | `praise_worship` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_volunteer` | `sunday_service` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_volunteer` | `women` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `ministry_volunteer` | `youth` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, limit to explicitly authorized ministry/record scope. |
| `member` | `public_site` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, preserve self/ownership scope for protected records. |
| `member` | `member_portal` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, preserve self/ownership scope for protected records. |
| `member` | `congregation` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, preserve self/ownership scope for protected records. |
| `member` | `cell_groups` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, preserve self/ownership scope for protected records. |
| `member` | `children` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, preserve self/ownership scope for protected records. |
| `member` | `cms` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, preserve self/ownership scope for protected records. |
| `member` | `evangelism` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, preserve self/ownership scope for protected records. |
| `member` | `men` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, preserve self/ownership scope for protected records. |
| `member` | `praise_worship` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, preserve self/ownership scope for protected records. |
| `member` | `sunday_service` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, preserve self/ownership scope for protected records. |
| `member` | `women` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, preserve self/ownership scope for protected records. |
| `member` | `youth` | PENDING | PENDING | PENDING | PENDING | PENDING — if approved, preserve self/ownership scope for protected records. |

## Additional decisions required

1. **Approval:** new accounts should default to unapproved; specify the trusted bootstrap process for the first approved superadmin.
2. **Role hierarchy:** decide whether hierarchy is required now. If yes, assign a unique, explicit hierarchy level to each canonical role ID and define whether larger or smaller numbers mean greater authority.
3. **Special capabilities:** define `manage`, `approve`, and `assign` independently of CRUD, including which roles may grant roles or approve members.
4. **Public content:** identify the exact public-site data sources and columns that anonymous visitors may read. Do not infer this from the `public_site` module alone.
5. **Ministry scope:** the agreed design is one primary leader via `ministries.leader_id`, with additional leaders represented by ministry-scoped `user_roles`; leadership-only access requires the records to agree. Decide which roles can appoint, replace, and remove leaders, and ensure those changes are transactional.
6. **Authentication:** current login is a demonstration form, so end-to-end authorization remains unverified until real Supabase Auth sign-in/session flows are implemented.

## Implementation gate

No permission rows, CRUD grants, RLS policies, or security-definer authorization functions should be generated from this template until the owner approves the matrix and the special-capability, approval, hierarchy, and bootstrap decisions.
