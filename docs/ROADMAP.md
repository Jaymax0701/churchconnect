# ChurchConnect — Implementation Roadmap

This document outlines the phased development plan for ChurchConnect. Work proceeds in sequential, testable milestones.

---

## 1. Roadmap Overview

```
Phase 1: Foundation & App Shell (Frontend only) ◄── [CURRENT FOCUS]
  │
  ▼
Phase 2: Database Schema & RLS Security Engine
  │
  ▼
Phase 3: Public Website & Announcement Hub
  │
  ▼
Phase 4: Member Portal & Admin Approval Queue
  │
  ▼
Phase 5: Content Management (Events & Sermons)
  │
  ▼
Phase 6: Ministry Teams & Volunteer Rosters
  │
  ▼
Phase 7: Administration Console & Permission Matrix UI
```

---

## 2. Phase Breakdown & Acceptance Criteria

### Phase 1: Foundation & App Shell
* **Status:** Ready for implementation
* **Scope:** React Router integration, modular folder structure (`src/modules/`), shared UI layout components (Navbar, Footer, Shell), and an AuthContext state harness.
* **Acceptance Criteria:**
  1. Vite dev server builds and runs cleanly without TypeScript or Oxlint errors.
  2. Public (`/`), Member Portal (`/portal`), and Admin (`/admin`) routes are navigable.
  3. UI accurately adheres to design tokens in `docs/DESIGN_SYSTEM.md`.

### Phase 2: Database Schema & RLS Security Engine
* **Status:** Planned (**TBD**)
* **Scope:** Version-controlled SQL migration establishing `profiles`, `roles`, `app_modules`, `role_module_permissions`, and `user_module_permissions`, with initial RLS policies and `SECURITY DEFINER` helper functions.
* **Acceptance Criteria:**
  1. Supabase Auth trigger automatically seeds `public.profiles` on user sign-up.
  2. RLS policies block unapproved users from viewing other members' directory data.
  3. Non-superadmins cannot assign the SUPERADMIN role.

### Phase 3: Public Website & Announcement Hub
* **Status:** Planned (**TBD**)
* **Scope:** Public homepage, church service times, about page, and public announcements feed.
* **Acceptance Criteria:**
  1. Anonymous visitors can view published service times and announcements.
  2. Internal or draft announcements are excluded from public responses.

### Phase 4: Member Registration, Sign-In & Approval Queue
* **Status:** Planned (**TBD**)
* **Scope:** Member sign-up form, login/logout workflows, member profile editing, and church admin approval queue.
* **Acceptance Criteria:**
  1. New sign-ups receive `is_approved = false` and see an "Awaiting Approval" message.
  2. Admin can approve members via the admin UI.
  3. Approved members gain access to member directory and portal features.

### Phase 5: Content Management (Events & Sermons)
* **Status:** Planned (**TBD**)
* **Scope:** Church events calendar and sermon archive with media links.
* **Acceptance Criteria:**
  1. Users with `can_create = true` on `events` can post new church events.
  2. Delete operations are enforced by RLS; unauthorized delete requests receive `403 Forbidden`.

### Phase 6: Ministry Teams & Volunteer Rosters
* **Status:** Planned (**TBD**)
* **Scope:** Porting volunteer scheduling, availability tracking, and shift swap workflows from the prototype.
* **Acceptance Criteria:**
  1. Ministry leaders can assign qualified volunteers to service rosters.
  2. Volunteers can confirm assignments and request shift swaps.

### Phase 7: Administration Console & Permission Matrix UI
* **Status:** Planned (**TBD**)
* **Scope:** Interactive administrative grid for managing role assignments and per-user CRUD toggles.
* **Acceptance Criteria:**
  1. Live permission changes apply immediately upon user navigation.
  2. SUPERADMIN account protections cannot be bypassed in the UI or via direct SQL queries.
