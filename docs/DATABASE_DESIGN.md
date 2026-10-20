# ChurchConnect — Database Architecture & Schema Design (Milestone 2)

This document establishes the verified database architecture, relational schema, data integrity invariants, and migration plan for ChurchConnect on Supabase PostgreSQL.

---

## 1. Verified Database Foundation

* **[VERIFIED] Database Engine:** PostgreSQL 15+ hosted on Supabase.
* **[VERIFIED] Authentication Integration:** Supabase Auth (`auth.users`) is the sole identity store.
* **[VERIFIED] Existing Public Tables:** 7 core tables are present in the active schema:
  1. `public.profiles` (`id` UUID PRIMARY KEY)
  2. `public.ministries` (`id` UUID PRIMARY KEY)
  3. `public.modules` (`id` TEXT PRIMARY KEY)
  4. `public.roles` (`id` TEXT PRIMARY KEY)
  5. `public.permissions` (`id` UUID PRIMARY KEY)
  6. `public.role_permissions` (composite `role_id` TEXT, `permission_id` UUID)
  7. `public.user_roles` (`id` UUID PRIMARY KEY, `user_id` UUID, `role_id` TEXT, `assigned_by` UUID)
* **[VERIFIED] Identifier Typing Conventions:**
  * User profile IDs match `auth.users.id` (UUID).
  * System roles and feature modules utilize stable, human-readable text identifiers (e.g. `'SUPERADMIN'`, `'registration'`).
  * Granular permission records and ministry entities use standard UUID primary keys.
* **[VERIFIED] Row Level Security:** RLS is enabled across existing tables with default-deny behavior for anonymous writes.

---

## 2. Core Relational Invariants

1. **User Identity & Lifecycle:**
   * **[VERIFIED]** Public profile data resides in `public.profiles`, where:
     `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`.
   * **[VERIFIED]** Custom `users` tables duplicating password hashes or credentials are strictly prohibited.
2. **Membership Gatekeeping:**
   * **[PROPOSED]** Member accounts require administrative approval:
     `profiles.is_approved BOOLEAN NOT NULL DEFAULT FALSE`.
   * **[PROPOSED]** Unapproved members are strictly barred by RLS from viewing other member profiles, directory details, or ministry rosters.
3. **Foreign Key Integrity & Deletion Invariants:**
   * **[PROPOSED]** Child records referencing users must specify either `ON DELETE CASCADE` (for private user data) or `ON DELETE SET NULL` (for audit trails like `assigned_by` or `created_by`).
4. **Immutability of System Roles:**
   * **[PROPOSED]** Built-in system roles are flagged `is_system_role = TRUE` and cannot be renamed or deleted.

---

## 3. Complete Target Relational Schema

### A. Identity & Access Management (IAM)

#### 1. `public.profiles` (User Profiles)
Extends `auth.users` with church membership attributes.
* `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` **[VERIFIED]**
* `full_name TEXT NOT NULL` **[VERIFIED]**
* `phone_number TEXT` **[PROPOSED]**
* `avatar_url TEXT` **[PROPOSED]**
* `is_approved BOOLEAN NOT NULL DEFAULT FALSE` **[PROPOSED]**
* `approval_date TIMESTAMPTZ` **[PROPOSED]**
* `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` **[VERIFIED]**
* `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` **[VERIFIED]**
* *Indexes:* `idx_profiles_is_approved ON profiles(is_approved)` **[PROPOSED]**

#### 2. `public.roles` (System & Administrative Roles)
* `id TEXT PRIMARY KEY` (e.g. `'SUPERADMIN'`, `'CHURCH_ADMIN'`) **[VERIFIED]**
* `name TEXT NOT NULL UNIQUE` **[VERIFIED]**
* `description TEXT` **[VERIFIED]**
* `hierarchy_level INT NOT NULL DEFAULT 50` **[PROPOSED]**
* `is_system_role BOOLEAN NOT NULL DEFAULT FALSE` **[PROPOSED]**
* `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` **[PROPOSED]**

#### 3. `public.modules` (Feature Modules)
Catalog of the 12 core platform areas.
* `id TEXT PRIMARY KEY` (e.g. `'registration'`, `'ministry'`, `'sunday_service'`) **[VERIFIED]**
* `name TEXT NOT NULL UNIQUE` **[VERIFIED]**
* `description TEXT` **[VERIFIED]**
* `is_active BOOLEAN NOT NULL DEFAULT TRUE` **[VERIFIED]**

#### 4. `public.user_roles` (User-Role Assignments)
* `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` **[VERIFIED]**
* `user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` **[VERIFIED]**
* `role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE` **[VERIFIED]**
* `assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL` **[VERIFIED]**
* `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` **[VERIFIED]**
* *Constraints:* `UNIQUE(user_id, role_id)` **[PROPOSED]**
* *Indexes:* `idx_user_roles_user ON user_roles(user_id)` **[PROPOSED]**, `idx_user_roles_role ON user_roles(role_id)` **[PROPOSED]**

#### 5. `public.role_module_permissions` (Role Default CRUD Permissions)
* `role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE` **[PROPOSED]**
* `module_id TEXT NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE` **[PROPOSED]**
* `can_view BOOLEAN NOT NULL DEFAULT FALSE` **[PROPOSED]**
* `can_create BOOLEAN NOT NULL DEFAULT FALSE` **[PROPOSED]**
* `can_update BOOLEAN NOT NULL DEFAULT FALSE` **[PROPOSED]**
* `can_delete BOOLEAN NOT NULL DEFAULT FALSE` **[PROPOSED]**
* *Primary Key:* `PRIMARY KEY (role_id, module_id)` **[PROPOSED]**

#### 6. `public.user_module_permissions` (Granular User Override Grants)
* `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` **[PROPOSED]**
* `user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` **[PROPOSED]**
* `module_id TEXT NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE` **[PROPOSED]**
* `can_view BOOLEAN` (NULL = inherit role, TRUE = explicit grant, FALSE = explicit deny) **[PROPOSED]**
* `can_create BOOLEAN` **[PROPOSED]**
* `can_update BOOLEAN` **[PROPOSED]**
* `can_delete BOOLEAN` **[PROPOSED]**
* `granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL` **[PROPOSED]**
* `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` **[PROPOSED]**
* `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` **[PROPOSED]**
* *Constraints:* `UNIQUE(user_id, module_id)` **[PROPOSED]**

---

### B. Core Domain Entities

#### 7. `public.ministries` (Church Ministries & Teams)
* `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` **[VERIFIED]**
* `name TEXT NOT NULL UNIQUE` **[VERIFIED]**
* `description TEXT` **[VERIFIED]**
* `leader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL` **[PROPOSED]**
* `is_active BOOLEAN NOT NULL DEFAULT TRUE` **[VERIFIED]**
* `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` **[VERIFIED]**

#### 8. `public.ministry_members` (Ministry Membership & Rostering)
* `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` **[PROPOSED]**
* `ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE` **[PROPOSED]**
* `user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE` **[PROPOSED]**
* `role_in_ministry TEXT DEFAULT 'MEMBER'` **[PROPOSED]**
* `joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` **[PROPOSED]**
* *Constraints:* `UNIQUE(ministry_id, user_id)` **[PROPOSED]**

#### 9. `public.events` (Church Events & Services)
* `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` **[PROPOSED]**
* `title TEXT NOT NULL` **[PROPOSED]**
* `description TEXT` **[PROPOSED]**
* `start_time TIMESTAMPTZ NOT NULL` **[PROPOSED]**
* `end_time TIMESTAMPTZ NOT NULL` **[PROPOSED]**
* `location TEXT` **[PROPOSED]**
* `is_public BOOLEAN NOT NULL DEFAULT TRUE` **[PROPOSED]**
* `ministry_id UUID REFERENCES public.ministries(id) ON DELETE SET NULL` **[PROPOSED]**
* `created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL` **[PROPOSED]**
* `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` **[PROPOSED]**
* *Constraints:* `CHECK (end_time > start_time)` **[PROPOSED]**
* *Indexes:* `idx_events_time ON events(start_time, end_time)` **[PROPOSED]**

#### 10. `public.sermons` (Sermon Recordings & Outlines)
* `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` **[PROPOSED]**
* `title TEXT NOT NULL` **[PROPOSED]**
* `speaker TEXT NOT NULL` **[PROPOSED]**
* `series TEXT` **[PROPOSED]**
* `scripture_reference TEXT` **[PROPOSED]**
* `date_preached DATE NOT NULL DEFAULT CURRENT_DATE` **[PROPOSED]**
* `media_url TEXT` (e.g. YouTube live stream or Vimeo link) **[PROPOSED]**
* `notes_url TEXT` **[PROPOSED]**
* `is_published BOOLEAN NOT NULL DEFAULT TRUE` **[PROPOSED]**
* `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` **[PROPOSED]**

#### 11. `public.announcements` (Church Bulletins)
* `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` **[PROPOSED]**
* `title TEXT NOT NULL` **[PROPOSED]**
* `body TEXT NOT NULL` **[PROPOSED]**
* `publish_date TIMESTAMPTZ NOT NULL DEFAULT NOW()` **[PROPOSED]**
* `expire_date TIMESTAMPTZ` **[PROPOSED]**
* `is_pinned BOOLEAN NOT NULL DEFAULT FALSE` **[PROPOSED]**
* `is_public BOOLEAN NOT NULL DEFAULT TRUE` **[PROPOSED]**
* `created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL` **[PROPOSED]**
* `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` **[PROPOSED]**

---

## 4. Standard Seed Data Specifications

### A. The 12 Approved Functional Modules **[PROPOSED]**

| Module ID | Display Name | Category | Scope Description |
| :--- | :--- | :--- | :--- |
| `registration` | Registration | Administration | Member onboarding, sign-up approvals |
| `ministry` | Ministry | Church Life | Ministry teams, rosters, scheduling |
| `cms` | MainPage CMS | Content | Landing page banners, announcements |
| `portal` | Member Portal | Community | Member dashboard, personal duty rosters |
| `cell_groups` | Cell Groups | Discipleship | Small group directory, weekly meetings |
| `youth` | Youth | Ministry | Youth fellowship, campfire, camp events |
| `children` | Children | Ministry | Sunday school, nursery, child safety |
| `women` | Women | Fellowship | Women's fellowship, prayer breakfasts |
| `men` | Men | Fellowship | Men's breakfast, brotherhood outreach |
| `evangelism` | Evangelism | Outreach | Community food drives, mission trips |
| `praise_worship` | Praise & Worship | Worship | Worship team songs, setlists, rehearsals |
| `sunday_service` | Sunday Service | Core | Order of worship, bulletins, live stream |

### B. The 6 Approved System Roles **[PROPOSED]**

| Role ID | Role Name | Hierarchy | System Role | Baseline Scope |
| :--- | :--- | :---: | :---: | :--- |
| `SUPERADMIN` | SUPERADMIN | 0 | TRUE | Unrestricted authority, protected against self-demotion |
| `COUNCIL` | Church Council | 10 | TRUE | Governance oversight, read-all, executive approvals |
| `ADMIN` | Church Admin | 20 | TRUE | User management, member approvals, general operations |
| `LEADER` | Ministry Leader | 30 | TRUE | Department roster scheduling, ministry team management |
| `VOLUNTEER` | Ministry Volunteer | 40 | TRUE | Shift duties, volunteer swap requests, team notes |
| `MEMBER` | Member | 50 | TRUE | Member directory, public RSVPs, sermon downloads |

---

## 5. Migration Sequence & Execution Phases

```
┌──────────────────────────────────────────────────────────┐
│ Step 0: Backup Snapshot Verification                    │
│ Execute Supabase DB snapshot prior to any migration.     │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│ Step 1: Schema Extension Migration                       │
│ - Add is_approved, approval_date to profiles             │
│ - Add hierarchy_level, is_system_role to roles           │
│ - Create role_module_permissions & user_module_perms     │
│ - Add leader_id to ministries                            │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│ Step 2: Seed Invariant System Records                    │
│ - Seed 6 standard roles into public.roles                │
│ - Seed 12 standard modules into public.modules           │
│ - Seed baseline role_module_permissions matrix          │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│ Step 3: Security-Definer Helper Functions                │
│ - Deploy is_superadmin()                                 │
│ - Deploy is_approved_member()                            │
│ - Deploy has_module_permission(module, action)           │
│ - Deploy protect_last_superadmin() trigger function      │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│ Step 4: Granular RLS Policy Application                  │
│ - Define per-operation policies (SELECT, INSERT, etc.)   │
│ - Shield profiles.is_approved against self-update        │
│ - Shield user_roles against unauthorized assignment      │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Rollback Considerations

* **Additive Migrations:** Adding columns (`is_approved`, `hierarchy_level`) is backward-compatible and does not break existing code.
* **Rollback Script:** A paired `rollback_0001.sql` will accompany any migration, dropping added columns, views, or triggers cleanly if a staging test fails.
* **Data Preservation:** Existing rows in `profiles`, `ministries`, and `roles` will remain untouched during additive migration.
