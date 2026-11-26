# UI modernization — Phase 6 QA report

Branch `feat/ui-modernization` (base `main` 31da55e, the current production commit). Date: 2026-11-26.
Scope: storefront (`apps/20mart`), admin (`apps/20martadmin`), shared UI (`packages/ui`), design tokens.

**Status: QA complete. No critical or high-severity defects open. Some checks were unavailable; see §6.**

## 1. Commits under test

| Commit | Phase | Summary |
|---|---|---|
| `8d6bb51` | 2 | Shared design tokens and primitives |
| `f462a95` | 3 | Storefront shared layout and components |
| `c0540a7` | 4 | Storefront pages |
| `7d689bc` | 5 | Admin experience |
| *(uncommitted)* | 6 | QA fixes, §4 |

## 2. Automated checks (run one at a time; 8 GB machine)

| Check | Result |
|---|---|
| Type-check: storefront / admin / `@20mart/ui` | Pass / pass / pass |
| Full test suite (`pnpm test`, server package) | **234 / 234 passed**, 21 files |
| Storefront production build (`next build`) | Pass |
| Admin production build (`next build`) | Pass |
| Lint | Not configured in either app (`next lint` only prompts for setup) |

Two analytics tests (`analytics-integration` CART_ITEM_ADDED, `analytics-product-daily` coverage) each failed once in earlier runs while the machine was under heavy load, and passed alone and in the final full run. They don't exercise UI code. Treat them as timing-sensitive.

## 3. Branch audit vs `main`

- 128 files changed, all under `apps/*/src/{app,components}`, `packages/ui/src`, `packages/config/tailwind.config.js` and `docs/design`, plus two toast containers in `lib/*store.tsx` (class names only).
- No changes to APIs, server, shared, database, middleware, auth, RBAC, pricing, cart, checkout or payment logic.
- No env files, secrets, build artifacts, dependency or lockfile changes, and no deleted files.
- Admin navigation-to-permission mapping is byte-identical to `main`. Diff lines that mention permissions changed class names only.

## 4. Defects found and fixed in this phase (uncommitted)

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | Medium | On a first visit (mobile), the consent banner covered the sticky purchase bar on product, cart and checkout pages | Sticky bars carry `data-mobile-action-bar`; the banner moves above them via `body:has(...)` |
| 2 | Low (a11y) | Utility-bar location button was 16px tall on mobile | `min-h-8` (32px) |
| 3 | Low (a11y) | Breadcrumb links were 15–16px tall | `min-h-6` (24px), in shared `Breadcrumb` |
| 4 | Low (consistency) | Legacy grey/emerald/amber/red classes in shared UI (Checkbox, DataTable, Tabs, Modal, gallery, image placeholder, Logo), toasts and the admin ARCHIVED badge | Mapped to design tokens; colours are equivalent |

## 5. Responsive and accessibility sweep (headless Edge, device emulation)

Each capture records horizontal overflow (`scrollWidth` vs viewport) and runs an automated probe: images without `alt`, controls without an accessible name, unlabelled inputs, duplicate ids, `<h1>` count, and mobile tap targets under 24px.

- **Interactive pages at 360 / 390 / 768 / 1280 / 1440:** home, shop, search, all categories, category, deals, product, cart, auth.
- **Static pages at 360 / 1440:** about, contact, FAQs, privacy, terms, shipping, returns, wishlist, order success, 404. Admin login at all five widths.
- **Results:** 67 captures. **No horizontal overflow on any app page.** Zero images without alt, zero unnamed controls, zero unlabelled inputs, zero duplicate ids, exactly one `<h1>` per page.
- **Tap targets:** the only consistent finding was items 2–3 above (now fixed). "Learn more" inside the consent text is an inline link in a sentence, which WCAG 2.2 exempts.

**Signed-in, desktop (1366px, Super Admin and customer sessions in Chrome, view only):**
- Storefront: cart, checkout (server minimum-order blocker shown, Pay disabled), orders list, order detail.
- Admin: dashboard, sidebar collapse/expand, account menu, orders, order detail, products plus search filter, product editor, inventory, warehouses, analytics, access management, coupons.
- No data-changing action was used.

**Checked earlier in the session:**
- Add to cart and the quantity stepper (Add → 1 → 2 → 1 → removed → Add again)
- Search suggestions with arrow keys and Escape
- Mobile menu with Escape
- Filter sheet and applied-filter chips
- Consent banner and sticky bars vs the bottom nav (no overlap)
- Signed-out admin routes redirect to `/login?next=…`

## 6. Follow-up session (dev servers restarted manually)

**Re-run 768px captures (previously failed because the dev servers stopped):**

| Page | Overflow | Probe |
|---|---|---|
| Auth (`/auth`) | none (768) | clean, 1 `<h1>` |
| Cart (`/cart`, guest) | none (768) | clean, 1 `<h1>`. A first capture caught the "Loading your cart…" state; the re-capture after load is clean |
| Search (`/shop?q=paper`) | none (768) | clean, 1 `<h1>` |

**Super Admin access (live, your Chrome session):**
- The sidebar shows all 18 sections, matching the full permission mapping.
- All 18 section pages return 200 with no access-denied content: 8 opened visually, 10 checked by same-origin request.

**Sign-out endpoint:**
- `GET /api/admin/auth/logout` returns 405 (POST only).
- The header menu's "Sign out" calls the shell's existing `logout()` (POST, then redirect to `/login`), unchanged from `main`.

## 7. Check status

| Check | Status |
|---|---|
| Type-checks (3), full test suite (234), both production builds | **Tested: pass** |
| Branch audit (scope, secrets, env files, artifacts, dependencies, deletions) | **Tested: pass** |
| Public storefront pages: overflow + automated a11y probe, 360–1440 | **Tested: pass.** Interactive pages at 5 widths; static pages at 360 and 1440 (reduced to limit load on the 8 GB machine) |
| Admin login page, 360–1440 | **Tested: pass** |
| Signed-in storefront and admin pages at desktop (1366px) | **Tested: pass** (view only) |
| Super Admin navigation and page access | **Tested: pass** |
| Signed-out route protection (redirect to `/login?next=…`) | **Tested: pass** |
| Cart stepper, search keyboard, mobile menu, filter sheet, consent vs bottom nav | **Tested: pass** (signed out, headless) |
| Signed-in pages at mobile/tablet widths | **Unavailable.** Chrome is maximised (resize has no effect) and both apps send `X-Frame-Options`; not bypassed. Reviewed in code only |
| Lower-privilege admin roles (menu visibility, access denied) | **Unavailable.** Only a Super Admin account exists. Covered by the server RBAC tests and the unchanged permission mapping |
| Live admin sign-out | **Untested** on purpose (it would end your session and need your password to restore). Endpoint method check passed; code path unchanged |
| Static pages at 390 / 768 / 1280 | **Untested** (reduced scope, see above) |
| Lint | **Unavailable** (not configured in either app) |

## 8. Recommendation

No release blockers in the application code. Commit the §4 fixes and this report as `fix(ui): final responsive and accessibility polish`. The unavailable checks need a resizable browser window and a lower-privilege test admin; consider them as post-release smoke items, or run them before release if those can be provided.
