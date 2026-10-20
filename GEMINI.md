# ChurchConnect — Project Rules & Guidelines

Welcome to ChurchConnect, a church website and management platform designed for church administrators, ministry leaders, volunteers, and congregation members.

All AI agents (Gemini, Antigravity, ChatGPT, ILMU) and developers working in this repository must adhere to the following principles:

## 1. Project Identity & Stack Integrity
* **Platform Purpose:** ChurchConnect provides a public church website, content management (sermons, announcements, events), member registration and directory, ministry scheduling, and fine-grained administrative controls.
* **Stack Adherence:** The approved foundation is **React 19 + TypeScript + Vite** on the frontend, with **Supabase Auth and PostgreSQL** on the backend. Do not replace, swap, or introduce alternative core technologies (e.g., Next.js, Prisma, external auth libraries) without explicit user approval.
* **Inspect First:** Always inspect actual project code, existing dependencies in `package.json`, and database artifacts before proposing or making changes. Never assume or invent files or tables.

## 2. Engineering Discipline & Communication
* **Small, Testable Milestones:** Never attempt to implement large multi-feature blocks at once. Break work into small, independently verifiable increments.
* **Plain-Language Explanations:** Explain significant architectural decisions and trade-offs in accessible, plain language suited for someone learning software development.
* **Empirical Verification Only:** Never claim that a build, lint check, test, database migration, or server deployment succeeded unless its execution and output have been directly observed and verified.
* **Post-Task Reporting:** After completing each task, always report:
  1. Files changed or created.
  2. Verification checks performed and their exact outputs.
  3. Results achieved.
  4. Known limitations or pending items.
  5. The recommended next step.

## 3. Security, Authorization & Secret Management
* **Zero Secret Exposure:** Never commit, log, or expose secret credentials, database passwords, or the Supabase `service_role` key in frontend code or client bundles. Only the public anon/publishable key (`VITE_SUPABASE_PUBLISHABLE_KEY`) is permitted client-side.
* **Server-Side Authorization Authority:** Database authorization must be strictly enforced server-side using correctly configured PostgreSQL Row Level Security (RLS) policies, triggers, and table grants. 
* **Frontend Checks Are Not Security Controls:** Frontend role checks, disabled buttons, and conditionally hidden UI components are user experience conveniences only; they are never treated as security controls.
* **Dual-Tier Permission Architecture:** The long-term authorization model cleanly separates administrative authority (determined by roles such as `ADMIN` or `MINISTRY_LEADER`) from explicit per-user module CRUD permissions (`can_view`, `can_create`, `can_update`, `can_delete`).
* **SUPERADMIN Protection:** Hardened protection for the `SUPERADMIN` role must be enforced inside PostgreSQL via table constraints and triggers, never relying solely on frontend logic.
* **Destructive Operation Protection:** Never modify production database records, drop tables, truncate data, or execute destructive SQL without explicit user consent.

## 4. Database & Migration Management
* **Version-Controlled Schemas:** Review existing schema scripts and migrations before proposing new ones. All database changes must be version-controlled and reproducible.
* **No Unplanned Migrations:** Do not generate or apply database migrations unless the architectural plan and schema have been reviewed and approved.
