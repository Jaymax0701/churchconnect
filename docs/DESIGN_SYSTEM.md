# ChurchConnect — Design System Specification

This document defines the official design system for ChurchConnect. All components, layouts, and styles must adhere to these design tokens and conventions.

---

## 1. Design Direction & Core Philosophy

ChurchConnect balances the welcoming, peaceful warmth of a local church community with the clean organization needed for administrative operations.

*   **Official Brand Aesthetic:** **Forest Green + Sage + Warm Ivory**.
*   **Design Values:** Default to light, spacious interfaces with warm ivory backgrounds and white cards. Use deep forest for navigation, strong headings on dark surfaces, and footer sections; forest green for primary actions; sage as a supporting accent (never default text on white).
*   **Minimal Dependency Rule:** Styles are implemented using modern Vanilla CSS custom properties (design tokens) and CSS Modules. We avoid heavy external UI libraries to prevent bundle bloat and ensure fast load times on mobile devices.

---

## 2. Color Palette & Semantic Tokens

### 2.1 Brand Palette (Primitive Tokens)

```css
:root {
  /* Brand Greens & Sage */
  --color-deep-forest:   #142d25;  /* Navigation, strong headers on dark surfaces, footers */
  --color-forest-green:  #245747;  /* Primary brand & primary interactive buttons */
  --color-forest-hover:  #1b4336;  /* Primary hover state */
  --color-sage-green:    #729985;  /* Supporting accent & icons (not default body text) */
  --color-soft-sage:     #dce8dd;  /* Accent badges, soft pills, active tint */

  /* Canvas & Card Surfaces */
  --color-warm-ivory:    #faf9f4;  /* Canvas background (light & spacious) */
  --color-white:         #ffffff;  /* Content cards, inputs, modal containers */
  --color-ivory-subtle:  #f3f1e9;  /* Secondary surface & table header row */

  /* Neutral Typography */
  --color-text-primary:   #1c2822;  /* Primary body text & headings */
  --color-text-secondary: #52635a;  /* Secondary metadata, subtitles, muted labels */
  --color-text-inverse:   #ffffff;  /* Text on dark forest backgrounds */

  /* Borders & Dividers */
  --color-border:        #e5e3da;  /* Card dividers, input borders, table rules */
  --color-border-hover:  #729985;  /* Interactive hover outline */

  /* Semantic Feedback & State Colors */
  --color-success-bg:     #eef8f2;
  --color-success-border: #b8e6ca;
  --color-success-text:   #1b6e3e;

  --color-warning-bg:     #fef8ec;
  --color-warning-border: #fbdca6;
  --color-warning-text:   #8a5806;

  --color-danger-bg:      #fdf2f2;
  --color-danger-border:  #f7baba;
  --color-danger-text:    #9e2a2b;

  --color-info-bg:        #f0f6fa;
  --color-info-border:    #bcd7e8;
  --color-info-text:      #1f577a;
}
```

### 2.2 Semantic Color Mapping

| Semantic Variable | Assigned Value | Usage Context |
| :--- | :--- | :--- |
| `--bg-page` | `var(--color-warm-ivory)` | Overall page background canvas |
| `--bg-surface` | `var(--color-white)` | Card background, modal dialogs, data table container |
| `--bg-surface-subtle`| `var(--color-ivory-subtle)` | Table header rows, sidebar active backgrounds, callouts |
| `--bg-nav-dark` | `var(--color-deep-forest)` | Primary navigation header & footer dark background |
| `--border-default` | `var(--color-border)` | Standard card dividers, table borders, input borders |
| `--border-focus` | `var(--color-forest-green)` | Input focus-visible outline and focus ring |
| `--text-primary` | `var(--color-text-primary)` | Page titles, primary body text, table cell text |
| `--text-secondary` | `var(--color-text-secondary)` | Secondary metadata, dates, breadcrumbs, helper hints |
| `--text-inverse` | `var(--color-text-inverse)` | Text on deep forest navigation and dark buttons |
| `--primary` | `var(--color-forest-green)` | Primary call-to-action buttons, active navigation indicator |
| `--primary-hover` | `var(--color-forest-hover)` | Hover state for primary interactive elements |
| `--accent-sage` | `var(--color-sage-green)` | Supporting icon accents and badge borders |
| `--badge-soft-sage` | `var(--color-soft-sage)` | Soft badge background for tags and status pills |

---

## 3. Typography Scale & Hierarchy

We use a modern system font stack that ensures instant loading, natural rendering, and maximum cross-platform legibility.

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
  --font-serif: Georgia, Cambria, "Times New Roman", Times, serif; /* Optional: For church quotes & scripture */
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
```

### 3.1 Type Scale

| Token | Size | Line Height | Weight | Typical Application |
| :--- | :--- | :--- | :--- | :--- |
| `--text-xs` | `0.75rem` (12px) | `1.33` | 500 | Table column labels, micro tags, status timestamps |
| `--text-sm` | `0.875rem` (14px) | `1.42` | 400 / 500 | Form labels, table cells, secondary descriptions, buttons |
| `--text-base`| `1.0rem` (16px) | `1.5` | 400 | Primary body copy, input text, dialog content |
| `--text-lg` | `1.125rem` (18px) | `1.44` | 600 | Card titles, modal header titles, section subheadings |
| `--text-xl` | `1.25rem` (20px) | `1.4` | 600 | Subsection headings (`<h3>`), member portal widgets |
| `--text-2xl`| `1.5rem` (24px) | `1.33` | 700 | Page headings (`<h2>`), dashboard section titles |
| `--text-3xl`| `1.875rem` (30px) | `1.26` | 700 | Primary page titles (`<h1>`) |
| `--text-4xl`| `2.25rem` (36px) | `1.2` | 700 | Public hero section titles |

---

## 4. Spacing, Layout & Elevation

### 4.1 Spacing Scale (4px/8px Grid)

```css
:root {
  --space-1:  0.25rem; /* 4px  - Micro gap, badge padding */
  --space-2:  0.5rem;  /* 8px  - Compact gap, input padding vertical */
  --space-3:  0.75rem; /* 12px - Standard form field gap, button padding */
  --space-4:  1.0rem;  /* 16px - Base layout padding, card interior */
  --space-6:  1.5rem;  /* 24px - Section spacing, modal padding */
  --space-8:  2.0rem;  /* 32px - Page container padding desktop */
  --space-12: 3.0rem;  /* 48px - Major section division */
  --space-16: 4.0rem;  /* 64px - Hero block margins */
}
```

### 4.2 Border Radii & Shadows

```css
:root {
  --radius-sm: 4px;   /* Checkboxes, micro badges */
  --radius-md: 8px;   /* Buttons, text inputs, dropdown menus */
  --radius-lg: 12px;  /* Cards, modals, notification containers */
  --radius-full: 9999px; /* Pill badges, avatar icons */

  --shadow-sm: 0 1px 2px 0 rgba(44, 32, 26, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(44, 32, 26, 0.08), 0 2px 4px -2px rgba(44, 32, 26, 0.04);
  --shadow-lg: 0 10px 15px -3px rgba(44, 32, 26, 0.1), 0 4px 6px -4px rgba(44, 32, 26, 0.05);
  --shadow-modal: 0 20px 25px -5px rgba(44, 32, 26, 0.2), 0 8px 10px -6px rgba(44, 32, 26, 0.1);
}
```

---

## 5. Responsive Breakpoints

| Breakpoint | Range | Target Device | Layout Adjustments |
| :--- | :--- | :--- | :--- |
| `sm` (Mobile) | `< 640px` | Phones (Portrait) | Single column layout, full-width inputs, stacked table cards, mobile drawer menu |
| `md` (Tablet) | `640px - 1023px`| Tablets / Small Laptops | 2-column grids, collapsed sidebar icons, responsive table horizontal scroll |
| `lg` (Desktop)| `1024px - 1279px`| Standard Monitors | Full sidebar navigation, multi-column forms, standard data tables |
| `xl` (Wide) | `>= 1280px` | Large Desktop Displays | Centered container max-width: `1240px` |

---

## 6. Component Inventory & Standards

### 6.1 Buttons (`<Button>`)
*   **Variants:**
    *   `primary`: Forest Green background (`--color-forest-green`), white text. Used for main action (Save, Submit, Join, Register).
    *   `secondary`: Soft Ivory/Sage background (`--color-ivory-subtle`), forest green text (`--color-forest-green`), border (`--color-border`). Used for secondary actions (Cancel, Back, Filter).
    *   `danger`: Crimson border/background (`--color-danger-text`), white text. Used strictly for destructive actions (Delete, Revoke Access).
    *   `ghost`: Transparent background, hover tint. Used for table row action triggers, close buttons (`✕`).
*   **States:**
    *   `hover`: Brightness reduction on primary (`--color-forest-hover`), clear background shift on ghost.
    *   `focus-visible`: 2px forest green ring with 2px offset.
    *   `disabled`: Opacity `0.5`, `cursor: not-allowed`, no click handler execution.
    *   `loading`: Inline SVG spinner with "Processing..." label.

### 6.2 Form Inputs (`<Input>`, `<Select>`, `<Textarea>`)
*   Always wrapped in a `<FormField>` containing `<label>`, optional `<span class="hint">`, and conditional `<div class="error-msg">`.
*   Height: Standard `40px` (ensures touch target accessibility).
*   Border: `1px solid var(--border-default)`.
*   Focus state: `border-color: var(--color-forest-green)` with `outline: 2px solid var(--color-soft-sage)`.

### 6.3 Badges (`<Badge>`)
*   Used for roles, approval statuses, and category indicators.
*   Must combine a color tint with unambiguous text:
    *   `Approved` / `Active`: Green tint (`--color-success-bg`, text `--color-success-text`).
    *   `Pending`: Amber tint (`--color-warning-bg`, text `--color-warning-text`).
    *   `Admin`: Soft Sage tint (`--color-soft-sage`, text `--color-forest-green`).
    *   `Superadmin`: Deep forest tint (`--color-deep-forest`, text `--color-white`) with padlock icon.

### 6.4 Confirmation Dialogs (`<ConfirmModal>`)
*   Triggered whenever an action cannot be easily undone (e.g., deleting an event, revoking permissions).
*   Modal header must clearly state the action (e.g., "Delete Sunday Service Event?").
*   Body text must explain what will happen (e.g., "This will remove the event from the church calendar and notify 4 scheduled volunteers.").
*   Actions must clearly differentiate between the destructive button ("Delete Event") and safe button ("Keep Event / Cancel").

### 6.5 Tables (`<DataTable>`)
*   **Desktop:** Clean alternating or cleanly bordered rows with clear column sorting headers, search bar, and pagination.
*   **Mobile (< 640px):** Must transform into stacked card views where each record is displayed as a clean, thumb-friendly card rather than overflowing horizontally off-screen.

---

## 7. Lifecycle States (Required on All Data Views)

Every data-driven page or widget must explicitly implement and handle all 5 states:

1.  **Loading State:** Display animated skeleton placeholders that mimic the expected card or table rows. Never display a blank white flash.
2.  **Empty State:** When no records exist (e.g., "No upcoming events scheduled"), display a friendly illustration or icon, a clear heading, an informative sentence, and a primary action button ("Create First Event").
3.  **Error State:** When an API request fails, show an alert banner with a plain-language explanation (e.g., "Unable to load the sermon directory. Please check your internet connection.") and a "Retry" button. Never dump raw SQL/JSON error stacks.
4.  **Success State:** When an action succeeds, display a temporary toast notification or visual checkmark confirming that the save was verified by the database.
5.  **Disabled / Unauthorized State:** If a member views a feature they do not have permission to modify, edit/delete controls must be cleanly omitted or disabled with an explanatory tooltip (e.g., "Requires Ministry Leader authorization").

---

## 8. Status of Design Decisions

| Category | Decision Item | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Colors** | Warm cream canvas (`#fdfcf9`) & Terracotta accent (`#c85a32`) | **CONFIRMED** | Preserves ChurchConnect established visual direction |
| **Typography**| Native system font stack | **CONFIRMED** | Zero font download latency, optimal rendering |
| **Breakpoints** | 640px, 1024px, 1280px | **CONFIRMED** | Standard responsive divisions |
| **Component Library** | Vanilla CSS Tokens + React 19 UI Primitives | **CONFIRMED** | No heavy third-party UI framework |
| **Dark Mode** | Dark mode color mapping | **TBD** | Deferred to post-MVP to prioritize high-contrast daylight church use |
| **Icon Set** | SVG Icon library (e.g., Lucide React vs raw SVGs) | **TBD** | Will select lightweight SVG icon set in Phase 1 |
| **Sermon Player** | Embedded YouTube/Vimeo vs custom HTML5 audio | **TBD** | Dependent on media hosting decision (see Section F of Restart Plan) |
