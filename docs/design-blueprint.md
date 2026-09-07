# Evipace ESG Portal — Design Blueprint

Status: approved redesign direction  
Brand accent: `#FE7001`  
Canonical theme: light, with a fully supported dark theme

## Product direction

The portal should feel calm, precise, trustworthy, and responsive. Its Apple-inspired quality comes from hierarchy, predictable behavior, immediate feedback, and careful detail—not decorative glow, excessive glass, or constant animation.

- Content is visually primary.
- Orange communicates intent, action, or an active process.
- Repeated data uses rows and tables instead of stacks of cards.
- Shadows communicate real elevation only.
- Motion explains cause and effect.
- Every interaction has visible feedback.
- Supabase queries, data flow, and business rules remain unchanged during the visual redesign.
- `AmbientGlow` is removed without a decorative replacement.

## Color system

Values below are the human-readable design source. Implementation may convert them to OKLCH, but CSS variables and Tailwind must use one consistent format.

### Light theme

| Token | Value | Use |
| --- | --- | --- |
| Background | `#F8F8F6` | Main page background |
| Surface | `#FFFFFF` | Cards, dialogs, special surfaces |
| Surface subtle | `#F1F1EE` | Sidebar, secondary controls, hover |
| Surface pressed | `#E8E7E2` | Pressed neutral state |
| Foreground | `#171716` | Primary text |
| Muted foreground | `#65645F` | Descriptions and metadata |
| Border subtle | `#D8D7D2` | Decorative separators |
| Control border | `#8C8A84` | Inputs and controls whose boundary must be visible |
| Brand | `#FE7001` | Primary actions and active progress |
| Brand hover | `#EA6300` | Primary hover |
| Brand pressed | `#D95700` | Primary pressed |
| Brand foreground | `#17120D` | Text on orange; contrast 6.67:1 |
| Brand text | `#B54700` | Accessible orange text on light surfaces |
| Focus ring | `#171716` | Keyboard focus |
| Destructive | `#B42318` | Errors and destructive actions |
| Success | `#237A45` | Explicit success confirmation |
| Warning | `#935700` | Warnings |

### Dark theme

| Token | Value | Use |
| --- | --- | --- |
| Background | `#11110F` | Main page background |
| Surface | `#191917` | Standard surfaces |
| Surface raised | `#22221F` | Dialogs and popovers |
| Surface subtle | `#292925` | Hover and secondary controls |
| Foreground | `#F5F4F0` | Primary text |
| Muted foreground | `#AAA8A1` | Descriptions and metadata |
| Border subtle | `#3B3B36` | Separators |
| Control border | `#6A6962` | Control boundaries |
| Brand | `#FE7001` | Primary actions and active progress |
| Brand hover | `#FF8126` | Primary hover |
| Brand pressed | `#E86200` | Primary pressed |
| Brand foreground | `#17120D` | Text on orange |
| Brand text | `#FF9A4D` | Orange text on dark surfaces |
| Focus ring | `#F5F4F0` | Keyboard focus |
| Destructive | `#FF7167` | Errors |
| Success | `#55B978` | Success |
| Warning | `#F0A44B` | Warning |

### Accent rules

Orange may be used for the primary action, a compact active-navigation indicator, active progress, states requiring attention, and the orange portion of the Evipace mark.

Orange is not used for large navigation fills, decorative lines, every status, processed-document success, section backgrounds, ambient glow, or page gradients. Semantic red, warning, and success colors remain separate from the brand.

### Token implementation

The current code stores complete `oklch(...)` values in variables but wraps them with `hsl(var(...))` in Tailwind. The redesign must use direct `var(--token)` references for complete OKLCH colors, or store channel-only HSL values. Do not mix the formats.

## Typography

Inter is the UI typeface for headings, body, navigation, forms, tables, buttons, statuses, metrics, and numbers. Enable optical sizing where supported.

GFS Didot is removed from product headings and metrics. A serif may be used later only inside the final Evipace wordmark. Until a clean wordmark exists, use the vector Evipace mark with a sans-serif “ESG Portal” descriptor.

| Role | Desktop | Mobile | Weight |
| --- | --- | --- | --- |
| Large metric | 48/52 | 40/44 | 600 |
| Page title | 32/38 | 28/34 | 600 |
| Section title | 20/26 | 19/25 | 600 |
| Surface title | 16/22 | 16/22 | 600 |
| Body | 15/22 | 15/22 | 400 |
| UI label | 14/20 | 14/20 | 500 |
| Metadata | 13/18 | 13/18 | 400 |
| Status/micro | 12/16 | 12/16 | 500 |

- Page headings use about `-0.025em` tracking; section headings about `-0.015em`.
- Body text uses normal tracking.
- Dates, periods, quantities, and metrics use tabular numerals.
- Avoid uppercase section headings.
- Layout must tolerate user text scaling.

## Layout

### Desktop

- Expanded sidebar: 248px; collapsed: 72px.
- Main content maximum width: 1200px.
- Horizontal content padding: 32–40px; top padding: about 36px.
- Major section spacing: 40–48px.
- Base spacing grid: 4px.

### Mobile

- Horizontal padding: 20px; top padding: 24px.
- Major section spacing: 32–40px.
- Primary touch targets: at least 44px.
- Reserve bottom space for navigation and safe-area insets.

## Navigation

### Desktop sidebar

- Solid `Surface subtle` background, subtle right separator, no glass or shadow.
- Evipace mark and “ESG Portal” at the top; utilities at the bottom.
- Row height: 40px; icons: 18–20px; radius: 10px.
- Active row: neutral fill, strong text, 2px orange indicator; never a full orange pill.
- Width transition: about 220ms without content jumps.
- Collapse trigger uses `aria-expanded`; collapsed icons have tooltips.

### Mobile bottom navigation

- Five stable destinations, 64px high plus safe-area inset.
- Nearly opaque material with 16–18px blur and low/no added saturation.
- Active icon is orange; label stays readable; use a small orange indicator, not an orange pill.
- More Sheet is the only strongly gesture-driven surface.

## Components

### Buttons

Variants: primary, secondary, outline, ghost, destructive.

- Primary uses orange with dark text.
- Heights: 32px small, 36–40px default, 44px large/mobile primary.
- Feedback begins on press. Hover: 160–180ms; pressed: 100–140ms.
- No bounce for ordinary controls. Scale, if useful, is limited to `0.985–0.99`.
- Loading preserves width. Keyboard focus is visible and offset.

### Form controls

- Input, select, and textarea share height, radius, border, and focus behavior.
- Standard height: 40px; touch height: 44px.
- Use solid backgrounds and clear control borders.
- Validation appears beside the field with icon and text, not color alone.
- Search includes an inset search icon.

### Cards

Cards are reserved for conceptually independent areas: settings groups, the progress summary, warnings, and modal tasks.

- Radius: 12px; subtle border; no default shadow.
- No hover if the whole card is not interactive.
- Never use one card per repeated document or datapoint row.

### List rows and tables

- Repeated rows use one shared ListRow primitive, 56–64px high, separated by one subtle line.
- Hover appears only on genuinely interactive rows.
- Desktop tables are used where users compare columns: Documents and Data Review.
- Downloads remains a structured list.
- Mobile layouts reflow the same content without duplicate DOM trees.

### Status

Status always combines text with an icon or distinct shape.

- Queued: neutral hollow dot.
- Processing: orange spinner or indicator.
- Processed: neutral check and label.
- Needs review: warning icon and label.
- Failed: destructive icon and label.

### Progress and empty states

- Progress uses semantic ARIA values, a visible neutral track, and orange fill.
- Animate actual value changes in 300–400ms; do not replay them on every navigation.
- Replace ambiguous `0/0` with meaningful empty-state copy.
- Empty states use a simple icon, short title, one explanatory sentence, and an action only when useful.

### Dialogs and sheets

- Use solid or almost-solid raised surfaces with a dimming scrim.
- Shadow is allowed because the surface is elevated.
- Opening and closing follow the same spatial path.
- Close controls have visible focus; focus returns to the trigger on close.
- A drag handle appears only when the sheet can actually be dragged.

## Motion

- Instant, 0–120ms: pressed state, checkbox, switch, inline validation.
- Standard, 160–220ms: hover, focus, active navigation, small state changes.
- Spatial, 300–400ms: sheets, dialogs, progress changes, list removal.
- Springs are reserved for surfaces the user physically drags.
- Reduced-motion mode removes movement and scale while retaining functional feedback.

## Pilot 1: Dashboard

The screen must immediately answer: how much is complete, what is missing, what changed recently, and what should the user do next?

### Structure

1. Header with small greeting, company name, and reporting period.
2. One progress summary surface with metric, label, and progress track.
3. Open gaps as separated rows with one clear Resolve action.
4. Compact completion state when no gaps remain.
5. Recently confirmed data as compact rows with period and value.

### Behavior

- Long company names wrap gracefully.
- `total = 0` shows “Trenutno ni odprtih zahtev” instead of `0/0`.
- Resolving a gap first confirms success, then removes the row smoothly.
- Provide undo only when the underlying action is safely reversible.
- Mobile rows prioritize the value over the reporting year.
- Bottom navigation never overlaps the last item.

## Pilot 2: Documents

The screen must help the user choose a location, upload a document, understand processing, find an existing file, and recover from errors.

### Upload

- Desktop dropzone: approximately 180–200px high; mobile: 160–180px.
- Dashed boundary, clear title, supported-file hint, and secondary/outline picker button.
- Drag-over uses a restrained orange border and background response.
- Each selected document appears immediately with upload progress.
- Upload success transitions to processing; failures stay visible with Retry.

### Toolbar

- Desktop: search, status filter, sorting, and location where applicable.
- Mobile: full-width search, with compact separate filter and sort controls.
- Do not place an unstyled native select tightly beside the search field.

### Desktop document table

Preferred columns: Document, Location, Status, Date, Actions.

- Filename receives the most space.
- Dates use tabular numerals.
- Preview and download remain accessible.
- Extra actions may move into an overflow menu.
- Omit a column if it would require new data queries solely for the redesign.

### Mobile document rows

- File icon and filename, maximum two lines.
- Status and date below the filename.
- One primary row action; secondary actions in overflow where appropriate.
- Touch-safe targets and no separate card shadow per row.

### States

- Loading affects the list; keep upload available where possible.
- Empty state avoids duplicating the upload call to action.
- Errors attach to the affected file or area and offer a concrete recovery action.

## Evipace mark

- Use the vector mark at 28–32px in the sidebar and 40–48px on authentication screens.
- Do not use glow or repeat the mark as a document-row icon.
- Prepare the complete light and dark SVG wordmark later as a separate brand task.

## Pilot definition of done

- Dashboard and Documents work in light and dark themes.
- Verified at 390px, 768px, 1024px, and wide desktop widths.
- All controls work with keyboard navigation and visible focus.
- Loading, empty, success, disabled, and error states are covered.
- Reduced motion preserves functional feedback.
- Mobile navigation never obscures content.
- No Supabase query, business-rule, or data-flow change is introduced solely by the redesign.
- Tests, typecheck, and production build pass.
- Before-and-after screenshots show clearer hierarchy and less visual noise.
