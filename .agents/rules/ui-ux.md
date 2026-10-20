---
trigger: model_decision
description: Use this rule when designing, implementing, or reviewing UI components, layouts, pages, design tokens, styling, or accessibility in ChurchConnect.
---

# UI/UX & Design Guidelines for ChurchConnect

These rules guide all UI/UX implementation in ChurchConnect. They ensure consistent quality, accessibility, visual harmony, and user-centered design across every screen.

---

## 1. Product Design Principles

1. **Design for Real People First:**
   * Build for church administrators, ministry leaders, volunteers, and elderly or non-technical congregation members—not for software engineers.
   * Interfaces must be calm, respectful, intuitive, and welcoming. Avoid developer jargon, raw database error dumps, or cryptic acronyms.
2. **Clarity Over Decorative Effects:**
   * Prioritize readability, clear visual hierarchy, accessible touch targets, and responsive behavior over flashy animations or gratuitous visual noise.
3. **Preserve the ChurchConnect Visual Direction:**
   * **Approved Identity:** **Forest Green + Sage + Warm Ivory**.
   * **Core Palette:** Deep Forest (`#142D25`), Forest Green (`#245747`), Sage Green (`#729985`), Soft Sage (`#DCE8DD`), Warm Ivory (`#FAF9F4`), White (`#FFFFFF`), Primary Text (`#1C2822`), Secondary Text (`#52635A`), Borders (`#E5E3DA`).
   * **Hierarchy:** Default to light, spacious interfaces with warm ivory backgrounds and white cards. Use deep forest for navigation headers and footers; forest green for primary actions; sage as a supporting accent (never default text on white).
   * Do not redesign the product or introduce a foreign visual identity without explicit user approval.
4. **Token-Driven Consistency:**
   * Always reference established design tokens for colors, typography, spacing, border radii, shadows, and interactive states. Avoid one-off arbitrary values.
5. **Reusable Components Over Duplication:**
   * Implement shared UI primitives (`Button`, `Input`, `Card`, `Badge`, `Modal`, `Table`, `Alert`) in `src/components/ui/`. Never copy-paste styled element blocks across pages.

---

## 2. The Three Experience Areas

Each section of ChurchConnect serves distinct user needs and contexts:

### A. Public Website (`/`)
* **Audience:** Visitors exploring the church, seekers, and congregation members looking for public info.
* **Tone & Feel:** Warm, welcoming, trustworthy, and community-centered.
* **Key Traits:**
  * High readability, generous spacing, and clear calls to action (e.g., "Join Us This Sunday", "Watch Sermons", "Plan Your Visit").
  * Fast load times, responsive mobile-first layouts, and accessible service times.
  * Appropriate media and text layouts for sermon archives, ministry overviews, and public church announcements.

### B. Member Portal (`/portal`)
* **Audience:** Registered and approved congregation members and volunteers.
* **Tone & Feel:** Personal, supportive, organized, and friendly.
* **Key Traits:**
  * Clean, digestible summary dashboard: upcoming scheduled serving duties, upcoming church events, and member-only announcements.
  * Mobile-optimized workflows: checking duty rosters, setting unavailable dates, submitting volunteer swap requests on a phone.
  * Intuitive profile and family account settings with transparent approval status notifications.

### C. Admin Dashboard (`/admin`)
* **Audience:** Church pastoral staff, ministry directors, church administrators, and SUPERADMINs.
* **Tone & Feel:** Productive, organized, focused, and secure.
* **Key Traits:**
  * Information-dense yet uncluttered layouts with clear visual structure.
  * Robust, filterable, and searchable tables with pagination and sorting.
  * Standardized Create/Edit modal drawers, consistent Form action bars (Save vs Cancel), and prominent confirmation modals for destructive operations.
  * High-visibility permission controls, role matrices, and strictly protected SUPERADMIN management.
  * Explicit feedback states: visible loading skeletons, informative empty states, clear validation errors, and dismissible success alerts.

---

## 3. Component & Interaction Standards

* **Meaningful Interactive Elements:**
  * Every button, link, and interactive control must perform a real, intended action. Never introduce dead buttons, non-functional links, or mock buttons that deceive the user.
* **Complete State Coverage:**
  * Every interactive control must provide distinct, accessible states:
    * `Default`: Clear visual affordance (looks clickable/actionable).
    * `Hover`: Subtle contrast shift or elevation indicator.
    * `Focus-Visible`: 2px high-contrast focus ring with offset for keyboard navigation.
    * `Active`: Pressed state feedback.
    * `Disabled`: Reduced opacity (`0.5`), `not-allowed` cursor, removed pointer events, and `aria-disabled="true"`.
    * `Loading`: Inline spinner with button text preserved or replaced with action indicator (e.g., "Saving..."), maintaining original button dimensions to prevent layout shifts.
* **Form & Validation Patterns:**
  * Every input must possess an explicitly associated `<label>` (using `htmlFor` and `id`).
  * Required fields must be indicated clearly both visually and programmatically (`aria-required="true"`).
  * Field-level validation errors must appear directly below the affected input with an error icon, red descriptive text, and `aria-describedby` linkage.
  * Never wipe user input on validation failure. Keep valid data intact.
* **Destructive & Reversible Actions:**
  * Destructive actions (e.g., Delete Event, Revoke Role, Reject Registration) must be styled in semantic danger colors and require an explicit confirmation dialog explaining the irreversible consequence.
  * Form action buttons must maintain consistent ordering across the entire application: **Primary (Save/Submit)** followed by **Secondary (Cancel)**.
* **Authentic Feedback:**
  * Avoid fake or premature success notifications. Only display success toasts or alerts after the backend or storage operation has actually resolved successfully.

---

## 4. Accessibility (a11y) & Responsive Standards

* **Semantic Structure:**
  * Use semantic HTML elements (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`, `<table>`).
  * Exactly one `<h1>` per page representing the page title, with strictly ordered heading hierarchy (`<h2>` through `<h6>`).
* **Contrast & Color Safety:**
  * Maintain WCAG 2.1 AA compliance: Minimum 4.5:1 contrast ratio for normal text, 3:1 for large headings and UI boundaries.
  * **Never communicate status using color alone.** Always pair color badges with clear text labels or descriptive icons (e.g., green dot + "Approved", amber dot + "Pending Approval").
* **Keyboard Navigation:**
  * All interactive elements must be reachable and operable using `Tab`, `Shift+Tab`, `Enter`, and `Space`.
  * Modals must trap focus while open and close reliably on `Escape`, returning focus to the trigger element upon close.
* **Responsive Breakpoints & Touch Targets:**
  * Mobile `< 640px`, Tablet `640px - 1023px`, Desktop `>= 1024px`.
  * Touch targets on mobile devices must measure at least 44x44px.
  * Data tables must gracefully transition to stacked mobile card views on small viewports so content is never horizontally squashed or clipped.
* **Motion Preferences:**
  * Wrap animations and transitions with `@media (prefers-reduced-motion: reduce)` to disable non-essential motion for sensitive users.

---

## 5. Design & Verification Workflow

Before reporting any UI task as completed, the following workflow must be followed:

1. **User & Task Identification:** Determine who is using the screen (Visitor, Member, Ministry Leader, Admin) and the exact job to be done.
2. **Token & Primitive Reuse:** Assemble the view using existing design tokens from `DESIGN_SYSTEM.md` and shared primitives in `src/components/ui/`.
3. **State Completeness:** Implement and verify all five lifecycle states:
   * Loading state (skeletons or spinners)
   * Empty state (helpful graphic/icon, friendly text, primary call to action)
   * Error state (human-friendly message with retry action)
   * Success state (clear confirmation)
   * Populated state (the standard data view)
4. **Visual & Responsive Inspection:**
   * Run the local application and inspect the rendered view at desktop (1280px), tablet (768px), and mobile (375px) widths.
   * If browser preview or subagent tools are available, capture and inspect visual output. Never claim visual verification if the rendered page was not actually inspected.
5. **Quality Gate:** Fix alignment, contrast, overflow, focus, and interaction flaws before requesting user review.
