---
trigger: model_decision
description: Use this rule when running build verification, TypeScript checks, Oxlint analysis, writing tests, or verifying allowed versus denied permission states.
---

# ChurchConnect Testing & Verification Rules

These rules ensure that all ChurchConnect code is empirically validated, stable, and secure before being considered complete.

## 1. The Verification Gate (No Unverified Claims)
* **Empirical Proof Required:** Never claim that code compiles, lints, or passes tests without running the exact verification command and observing the output.
* **Standard Verification Suite:**
  * **Type Checking:** Run `npx tsc -b` (or `npm run build`) to ensure zero TypeScript type errors.
  * **Linting:** Run `npm run lint` (using Oxlint) to catch code quality and hook usage violations.
  * **Runtime Dev Build:** Ensure the Vite development server compiles and serves bundles without runtime console errors or module resolution failures.

## 2. Dual-Path Authorization Testing
When implementing or modifying features involving permissions, roles, or RLS:
* **Test the Allowed Path:** Confirm that an authorized user (e.g., an approved `MINISTRY_LEADER` or user with `can_create = TRUE`) can successfully view, create, or update the resource.
* **Test the Denied Path:** Confirm that an unauthorized user (e.g., anonymous visitor, unapproved member, or standard member without grants) is rejected.
  * Verify that the UI gracefully disables or hides the action.
  * Verify that direct API/database attempts receive a `403 Forbidden` or PostgreSQL permission denied error.

## 3. UI and Visual Verification
* **Inspect the Rendered Output:** When modifying page layouts, forms, or navigation, run the application and visually inspect the rendered UI at both desktop (`1280px`) and mobile (`375px`) viewports.
* **Inspect All States:** Verify that loading skeletons render smoothly during network latency, empty states appear when data sets are empty, and error banners render when simulated network requests fail.
* **Truthful Reporting:** If visual inspection tools (e.g., browser preview or subagent screenshot tools) were not executed, report that visual inspection remains pending; do not claim visual verification.
