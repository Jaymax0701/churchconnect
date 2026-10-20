# ChurchConnect — System Architecture

This document outlines the high-level architecture of ChurchConnect. It records confirmed architectural facts and highlights items that remain to be decided (**TBD**).

---

## 1. Confirmed Technology Stack

* **Frontend:** React 19 (`react` 19.2.8, `react-dom` 19.2.8) with TypeScript 6.0.2 and Vite 8.3.0.
* **Backend Platform:** Supabase (PostgreSQL 15+ database and Supabase Auth).
* **Linter & Code Standards:** Oxlint (`oxlint` 1.81.0).
* **Target Users:** Church administrators, ministry leaders, volunteers, and congregation members.

---

## 2. High-Level Architectural Layers

```
┌────────────────────────────────────────────────────────┐
│  Client Tier (Browser / React 19 SPA)                  │
│  - Presentation, interactive forms, responsive views   │
│  - Client-side routing and visual permission toggling  │
│  - Communicates directly with Supabase API             │
└──────────────────────────┬─────────────────────────────┘
                           │ Supabase Client (Anon Key + User JWT)
┌──────────────────────────▼─────────────────────────────┐
│  Database Tier (Supabase PostgreSQL)                   │
│  - Supabase Auth (auth.users)                          │
│  - Row Level Security (RLS) enforcement                │
│  - Security Definer authorization functions & triggers │
└──────────────────────────┬─────────────────────────────┘
                           │ Privileged operations only
┌──────────────────────────▼─────────────────────────────┐
│  Serverless Tier (Supabase Edge Functions) [TBD]       │
│  - Reserved for operations requiring service_role key  │
└────────────────────────────────────────────────────────┘
```

---

## 3. Experience Areas

* **Public Website (`/`):** Welcoming community-oriented landing pages, service times, public event calendars, and sermon directory.
* **Member Portal (`/portal`):** Authenticated area for approved members to view duty rosters, submit volunteer swap requests, and manage personal profiles.
* **Admin Dashboard (`/admin`):** Information-dense management console for church administration, user approval queues, role assignments, and permission matrices.

---

## 4. Architectural Invariants

1. **Defense in Depth:** The frontend provides UI convenience, but the database (PostgreSQL RLS) is the sole authority for security.
2. **Secret Hygiene:** High-privilege tokens (such as `service_role` keys) are strictly forbidden in client-side code.
3. **Additive Permissions:** User permissions grant access; roles provide baseline access.

---

## 5. Architectural Status & Pending Decisions

| Component / Layer | Status | Confirmed Details / Pending Questions |
| :--- | :--- | :--- |
| **Frontend Framework** | **CONFIRMED** | React 19 + TypeScript + Vite |
| **Client Routing** | **TBD** | `react-router-dom` v6/v7 recommended; package not yet installed |
| **State Management** | **TBD** | Context API proposed for Auth/Permissions; global store TBD |
| **Serverless Functions** | **TBD** | Scope of Supabase Edge Functions (e.g., transactional emails) |
| **File / Media Storage** | **TBD** | External URLs (YouTube/Vimeo) vs Supabase Storage buckets |
