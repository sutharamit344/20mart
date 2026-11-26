# 20Mart design system

One visual language for the storefront (`apps/20mart`) and the admin (`apps/20martadmin`).
Tokens live in `packages/config/tailwind.config.js` (shared by both apps). Shared components live in
`packages/ui`; admin-only primitives live in `apps/20martadmin/src/components/ui.tsx`.

## 1. Brand colours (unchanged values)

| Token | Value | Use |
|---|---|---|
| `brand-orange` | `#FF7A00` | Primary customer actions (Add to cart, Checkout, Explore), prices on promos, key highlights |
| `brand-orange-600` | `#E66E00` | Hover/pressed for orange |
| `brand-orange-50/100/200/700` | Tailwind-style tints | Soft orange surfaces (discount badges, secondary buttons), text on soft orange |
| `brand-green` | `#0B5D3B` | Brand chrome: admin sidebar, admin primary actions, trust/brand accents on the storefront, focus in admin |
| `brand-green-900` | `#074028` | Deep surfaces (admin sidebar) |
| `brand-green-hover` | `#08492E` | Hover/pressed for green |
| `brand-cream` | `#FFF6E9` | Warm promotional backgrounds (use sparingly) |

Rules:
- **One loud colour per region.** A card has at most one orange element (usually the primary button or the price badge).
- **Never hard-code brand hex in classes.** Use the tokens (`bg-brand-orange`, `text-brand-green/80`, `ring-brand-orange/10`). Hex is only allowed where a class is impossible (SVG, `<meta theme-color>`, third-party SDK options).
- Brand colours are not status colours: success is `success`, not brand green.

## 2. Neutrals and status

| Token | Value | Use |
|---|---|---|
| `ink` / `ink-800` / `ink-700` / `ink-600` / `ink-500` / `ink-400` | `#111827` … `#9CA3AF` | Headings & body / strong body / labels / secondary / meta / placeholders & icons |
| `line` / `line-subtle` / `line-strong` | `#E5E7EB` / `#EEF0F2` / `#D1D5DB` | Default borders / card & table dividers / input hover, outline buttons |
| `surface` / `surface-page` / `surface-muted` / `surface-sunken` | `#FFF` / `#F8F9FA` / `#F3F4F6` / `#F1F3F2` | Cards / app background & table headers / wells, search, hover rows / image wells |
| `success` · `warning` · `danger` · `info` (+ `-soft`, `-line`) | green 700 · amber 700 · red 600 · sky 700 | Status text/icons, soft backgrounds, borders |

## 3. Typography

- Fonts: headings `font-heading` (Poppins), body `font-sans` (Inter), both self-hosted.
- Scale: `text-2xs` (11/16, **minimum size**: labels, table headers, meta) · `text-xs` (12) · `text-sm` (14, default body & controls) · `text-base` (16) · `text-lg` (18, card/page titles on mobile) · `text-xl` (20, page titles) · `text-2xl`+ only for storefront hero/marketing.
- Weights: 400 body, 500 meta emphasis, 600 labels/buttons/section titles, 700 page titles & prices. Avoid `font-extrabold`/`font-black` outside the hero and big KPI numbers.
- Numbers: prices, quantities and KPIs use `tabular-nums`. Currency via the existing `formatINR`/`formatPrice` helpers.
- Section title pattern: `text-base sm:text-lg font-semibold text-ink` + optional `text-xs text-ink-500` subtitle; "See all" link `text-sm font-semibold text-brand-orange`.

## 4. Spacing, radius, elevation

- Spacing on the 4px grid. Page gutters `px-4 sm:px-6`; section gaps `space-y-6 sm:space-y-8` (storefront), `space-y-3 sm:space-y-4` (admin). Card padding `p-3 sm:p-4`.
- Radius: controls `rounded-xl` (size sm and admin dense controls `rounded-lg`), cards/panels/dialogs `rounded-2xl`, chips/pills/avatars `rounded-full`, image wells inside cards `rounded-xl`.
- Elevation: `shadow-card` (resting cards), `shadow-card-hover` (interactive hover), `shadow-pop` (menus, toasts, dialogs). No heavy drop shadows on resting content.
- Borders: cards `border border-line-subtle`; inputs `border-line` → `hover:border-line-strong`.

## 5. Controls

| Control | Height | Notes |
|---|---|---|
| Button `sm` / `md` / `lg` | 32 / 40 / 44–48 | Variants: `primary` (orange, customer CTA), `brand` (green, admin CTA), `secondary` (soft orange), `outline`, `ghost`, `danger` |
| Input / Select / Search (storefront) | 40 | `rounded-xl`, focus `border-brand-orange ring-4 ring-brand-orange/10` |
| Admin input/select (`inputCls`) | 36 | `rounded-lg`, focus in brand green |
| Touch targets | ≥ 40×40 on mobile | Icon buttons get `aria-label` |

Focus: every interactive element shows a visible ring on keyboard focus (`focus-visible:ring-2`), never removed without a replacement.

## 6. Feedback states

- Loading: `Skeleton` (shapes match content), `Loader2` spinner only inside buttons/inline.
- Empty: `EmptyState` (icon in soft brand tile, title, one-line description, optional action).
- Errors: inline `role="alert"` text under fields; page/section errors in a `danger-soft` box with a retry when retrying can help.
- Success: `Toast` (`shadow-pop`, `animate-pop-in`), auto-dismiss.
- Motion: 150–160 ms `fade-in` / `pop-in` only. No parallax, glassmorphism or decorative gradients on content surfaces.

## 7. Data display (admin)

- Tables: header `bg-surface-page text-2xs uppercase tracking-wide text-ink-500`; rows `divide-line-subtle`, hover `bg-surface-page`; numbers right-aligned `tabular-nums`; wide tables scroll inside their panel, never the page.
- KPI cards: label `text-2xs uppercase text-ink-500`, value `text-lg/xl font-bold tabular-nums`, optional hint `text-2xs text-ink-400`.
- Charts: single brand series (`charts.tsx`), recessive gridlines, table view for every chart, missing data never drawn as zero.

## 8. Responsive

Breakpoints tested: 375, 430, 768, 1024, 1280, 1440. No page-level horizontal scroll; storefront is mobile-first with the bottom navigation; admin uses the drawer sidebar below `lg`.
