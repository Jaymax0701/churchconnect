---
trigger: model_decision
description: Use this rule when developing, modifying, or reviewing React 19 components, TypeScript types, UI layouts, forms, error/loading states, accessibility, and client-side routing in ChurchConnect.
---

# ChurchConnect Frontend Development Rules

These rules govern all React, TypeScript, and styling work across the ChurchConnect user interfaces.

## 1. Architecture & Component Reusability
* **Modern Stack:** ChurchConnect utilizes **React 19 + TypeScript + Vite** with client-side routing.
* **Modular Structure:** Code is organized by domain modules under `src/modules/` (`auth`, `public-site`, `member-portal`, `events`, `sermons`, `ministries`, `admin`), with shared primitives in `src/components/ui/`.
* **DRY (Don't Repeat Yourself):** Always reuse primitive UI components (`Button`, `Input`, `Card`, `Badge`, `Modal`, `DataTable`, `Alert`). Do not copy-paste raw styling blocks or HTML structures across pages.
* **TypeScript Strictness:** Avoid `any`. Explicitly type component props, hook return values, and data models matching the Supabase database schema.

## 2. Component Lifecycle & State Coverage
Every data-driven view and interactive component must explicitly handle all 5 states:
1. **Loading State:** Display animated skeleton placeholders or inline loading spinners. Never display an empty white screen or unformatted blank container.
2. **Empty State:** When query results are empty, provide an informative message, a friendly icon, and a primary action (e.g., "No upcoming events scheduled. Create your first event.").
3. **Error State:** Catch query and submission failures gracefully. Display user-friendly error alerts with a retry action. Never display raw JSON error responses or database error codes to users.
4. **Success State:** Confirm successful create/update/delete operations with clear, dismissible feedback (toasts or visual banners) only after the backend operation resolves.
5. **Populated State:** The standard, cleanly formatted layout.

## 3. Form Handling & Interactive Controls
* **Semantic Labels:** Every `<input>`, `<select>`, and `<textarea>` must have an associated `<label>` using `htmlFor` and matching `id`.
* **Predictable Actions:**
  * Save and Cancel actions must maintain consistent ordering and styling across the app: Primary action (Save/Submit) followed by Secondary (Cancel).
  * Destructive actions (Delete, Revoke) must be visually distinct (danger styling) and require an explicit confirmation modal.
  * No dead buttons: Every interactive element must perform a real action. Never include placeholder controls that imply data was saved when it was not.

## 4. Accessibility (a11y) & Responsiveness
* **WCAG 2.1 AA Compliance:** Maintain a minimum 4.5:1 contrast ratio for normal text and 3:1 for large text and UI boundaries.
* **Never Rely on Color Alone:** Combine status colors with unambiguous text labels or descriptive icons (e.g., green dot + "Approved", amber dot + "Pending").
* **Keyboard Navigation:** Ensure all interactive elements have visible `:focus-visible` rings with proper contrast and offset. Ensure modal dialogs trap focus and can be dismissed via `Escape`.
* **Responsive Breakpoints:**
  * Support Mobile (`< 640px`), Tablet (`640px - 1023px`), and Desktop (`>= 1024px`).
  * On mobile viewports, transform data tables into thumb-friendly stacked card lists to prevent horizontal overflow and poor readability.
* **Reduced Motion:** Honor `prefers-reduced-motion` media queries for animations and transitions.
