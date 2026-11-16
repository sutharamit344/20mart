# 20Mart — P3 Production Readiness Report

Date: 2026-11-15 · Branch: `feat/p2-growth` (P0–P2 + P3 changes, uncommitted) · Runbook: [DEPLOYMENT.md](../DEPLOYMENT.md)

Status legend: **Done+Tested** = implemented and verified by automated test or measurement · **Done** = implemented, verified manually or by build only · **Partial** · **Pending** (needs an external system or your decision).

## Test environment
All measurements and end-to-end runs used:
- **production builds** (`next build` / `next start`);
- the scratch database `twentymart_p3_scratch`, restored from a backup of `twentymart_dev`, plus synthetic load data: 5,007 products, 5,002 customers, 30,003 orders, 60,004 order items.

The dev database was never written to. Email and Razorpay were disabled on the test servers so that no real email or payment call left the machine.

The machine is a shared Windows laptop. It was also running two dev servers, Postgres, an IDE and a browser, at 35–88% CPU from other work. Wall-clock timings are therefore noisy (±50% between identical runs). Treat DB-level profiles and same-moment A/B comparisons as the reliable numbers.

---

## 1. Audit findings (prioritised) and 2–3. Security issues and fixes

| # | Sev. | Finding | Fix | Status |
|---|---|---|---|---|
| 1 | High | **Timestamps skewed by the DB session time zone.** Columns are `timestamp(3)` in UTC, but raw SQL (`now()`, `Date` parameters) used the server session time zone (here Asia/Calcutta, +5:30). Effects: analytics chart, top products, categories, coupons, Fill-Your-Cart and repeat buyers were shifted 5 h 30 m against the KPI cards; raw `updatedAt` writes were stored in local time. The new maintenance job would have logged out active admins (caught by a test). | `@20mart/database` forces `TimeZone=UTC` per session. All raw SQL is time-zone independent. `/api/health` reports and flags a non-UTC session. PgBouncer path documented (`ALTER ROLE … SET timezone='UTC'`). | Done+Tested |
| 2 | High | **Rate limits bypassable.** Client IP came from the left-most (client-controlled) `X-Forwarded-For` entry, so login, checkout, contact and OAuth limits could be dodged and audit IPs forged. | Proxy-appended entry (`TRUST_PROXY_HOPS`), optional `CLIENT_IP_HEADER`, and IP format validation. | Done+Tested |
| 3 | High | **Whole-table aggregation on every list request.** Prisma relation `_count` compiles to an unfiltered `GROUP BY` over the child table. Hit: admin orders (OrderItem), customers (Order/redemptions/campaign joins), order detail, storefront order history, every product card and cart line (ProductVariant), inventory (StockMovement), payment start, order emails. | Per-page `groupBy … IN (ids)` (`counts.ts`); response shapes unchanged. | Done+Tested |
| 4 | High | **783 KB logo PNG (1810×840) on every page of both apps**, shown 32 px tall; main cause of the ~7 s mobile LCP. | `next/image` (≈4–9 KB AVIF/WebP), preloaded once (mobile header only). | Done+Measured |
| 5 | High | **`sharp` missing.** Next.js fell back to a WASM encoder: images were served as PNG only, and under load browser image requests stalled (found by responsive QA: admin pages never finished loading). | `sharp@0.33.5` added to both apps (pnpm `allowBuilds`). | Done+Tested |
| 6 | Med | No Content-Security-Policy and no HSTS. | CSP on both apps (admin: zero third-party origins; storefront: self + Razorpay Checkout only). HSTS on https origins. Admin COOP. `X-Robots-Tag: noindex` on private storefront routes. | Done+Tested |
| 7 | Med | Checkout price race: line prices read before the order transaction. | Re-check price/availability inside the transaction under `FOR SHARE` locks; 409 `PRICE_CHANGED`. | Done+Tested |
| 8 | Med | Campaign announcement made about 3 sequential queries per customer inside one HTTP request (times out at scale). | Batched `notifyMany` (500/batch, `createMany`), cursor paging, same preference rules. | Done+Tested |
| 9 | Med | No housekeeping: expired sessions, login-attempt rows and abandoned guest carts grew forever. | `POST /api/cron/maintenance` (bounded batch deletes). | Done+Tested |
| 10 | Med | **Email silently off.** Code read `EMAIL_FROM`, your `.env.local` sets `MAIL_FROM`. | `MAIL_FROM` accepted as an alias. | Done |
| 11 | Med | **Brand fonts not applied.** Storefront text used the system font (next/font Inter never wired to Tailwind). The admin loaded no web fonts; its render-blocking Google Fonts `@import` did nothing. | Tailwind stacks use the next/font variables. Admin self-hosts fonts via next/font (no third-party request). | Done+Verified in browser |
| 12 | Med | **Storefront pagination rendered one button per page** (209 on `/shop`): unusable on mobile, heavy DOM. | Windowed pagination (≤ 7 items), `<nav>`, labels, `aria-current`. | Done+Tested |
| 13 | Med | SEO missing: no sitemap/robots/canonical/OG/JSON-LD; 8 pages shared the root title. | See §6. | Done+Tested |
| 14 | Med | Monitoring: raw `console.error(err)` (could print connection strings), no error tracking, no health endpoint, cron failures unhandled. | See §7. | Done+Tested |
| 15 | Low | Accessibility: pinch-zoom disabled, unlabeled sort select and pagination arrows, low-contrast grey text, 15 px footer link targets, gallery ignored admin alt text, mismatched `aria-label`s. | All fixed. | Done+Measured |
| 16 | Low | README claimed ratings "4.6 stars / 328 reviews" and OTP login (neither exists). | Corrected. | Done |

**Verified sound (no change needed):**
- Google OAuth: PKCE, signed state, nonce, ID-token signature/issuer/audience, verified email only, never merges accounts by email.
- Admin auth: Argon2id, generic errors, DB-backed throttling and lockout, session rotation, 12 h absolute / 2 h idle expiry.
- Deactivation revokes sessions immediately.
- Separate cookies: Lax for customers, Strict for admins, `__Host-` over HTTPS.
- Every admin API is permission-gated.
- Role management blocks privilege escalation (you can't grant what you don't hold, change your own roles, or remove the last Super Admin; Super Admin needs re-auth).
- Ownership checks on orders, addresses and cart lines.
- Order placement: advisory lock, conditional stock updates, idempotency key.
- Coupon rows locked with `FOR UPDATE`.
- Payment: signature, provider re-fetch and amount check; webhook HMAC over the raw body plus dedupe.
- Refunds: claimed before the provider call; marked processed only after provider confirmation.
- Uploads: magic-byte, size and dimension checks; random keys.
- Media route: traversal-safe.
- Money: integer paise throughout.
- No card data is stored.

## 4. Performance measurements

**Lighthouse (mobile, simulated slow 4G, median of 2–3 runs).** Baseline is the pre-P3 production build; P3 is the final build.

| Page | Perf | LCP | TBT | Page weight | Accessibility | SEO / Best practices |
|---|---|---|---|---|---|---|
| Home | 52 → see A/B (first baseline run was under heavier load) | 7.41 s → **3.53 s** | 2,527 → 405–1,200 ms (noisy) | 1,120 → **450 KB** | 86 → **96** | 100 / 100 both |
| Shop | 72 → A/B | 7.08 s → **4.12 s** | 807 → 441–1,138 ms | 1,037 → **414 KB** | 76 → **95** | 100 / 100 |
| Category | 79 → A/B | 7.08 s → **3.82 s** | 520 → 854–985 ms | 1,039 → **417 KB** | 76 → **95** | 100 / 100 |
| Product | 76 → A/B | 6.34 s → **3.31 s** | 910 → 516–548 ms | 1,025 → **416 KB** | 86 → **96** | 100 / 100 |

**Same-moment A/B** (baseline and P3 builds served side by side, runs interleaved, median of 3). This is the reliable comparison:

| Page | Perf base → P3 | FCP | LCP | TBT | Weight |
|---|---|---|---|---|---|
| Home | 81 → **81** | 1.39 → 2.31 s | 3.48 → 3.53 s | 497 → **290** ms | 1,150 → **450 KB** |
| Shop | 67 → **71** | 1.12 → 2.14 s | 7.07 → **4.12 s** | 370 → 513 ms | 1,038 → **414 KB** |
| Category | 60 → **67** | 1.23 → 2.15 s | 7.07 → **4.13 s** | 651 → 721 ms | 1,039 → **417 KB** |
| Product | 73 → **85** | 1.10 → 2.00 s | 6.03 → **3.28 s** | 640 → **370** ms | 1,026 → **416 KB** |

**Why FCP is later.** The baseline never loaded the Inter font: its text silently fell back to system fonts (finding 11). P3 renders the intended typography, so 132 KB of Inter is fetched before the observed first paint: 48 KB latin plus 84 KB latin-ext, the latter only because every price contains "₹". Lighthouse's throttling model charges this to FCP. Unthrottled, the observed first paint is 378 ms, and with `font-display: swap` text paints immediately in a metric-matched fallback. Ruled out by blocking tests: the logo, font preloads, and CSS size (identical). Option, for you to decide: serve Inter from `next/font/local` with a latin-only file plus a tiny ₹ subset (≈ −80 KB), or accept system fonts (fastest, off-brand).

CLS is 0 everywhere. Shared JavaScript is unchanged at 87.3 kB (no new client JS).

**Server response times (p50 / p95 ms, 15 runs, same scratch DB).** Baseline is the first column; "after" is the run with the CPU least loaded.

| Endpoint | Baseline | After |
|---|---|---|
| Admin orders page | 637 / 1,071 | **85 / 109** |
| Admin orders API | 359 / 694 | **25 / 27** |
| Admin customers page | 151 / 674 | **87 / 115** |
| Admin analytics page (30 d) | 501 / 975 | **151 / 519** |
| Storefront listing API (filter + sort) | 62 / 86 | **27 / 33** |
| Storefront text search API | 110 / 223 | **59 / 69** |
| Product page | 15 / 20 | 10 / 14 |
| `sitemap.xml` (5,015 URLs) | 404 | **10 / 14** |

Later runs at 35–88% CPU from other applications were 1.5–3× slower across *all* endpoints, including untouched ones. That's machine contention: direct service profiling at the same time showed no regression.

**DB-level (query profiler, scratch DB)**

| Function | Before | After |
|---|---|---|
| `listAdminOrders` | 130 ms DB / 135 ms wall | **12 ms / 18 ms** |
| `getAnalytics(30d)` | 249 ms wall | **94–125 ms** |
| `listCustomers` | 22 ms | **9–11 ms** |

The repeat-buyer query no longer ships every buyer id back to the database.

## 5. Database optimisations
- Per-page counts instead of whole-table `_count` aggregates (11 call sites).
- Analytics repeat buyers: one index-backed query.
- Price checks under `FOR SHARE` in the order transaction; lock order is product → coupon → inventory, so no deadlock cycle with admin edits.
- UTC session enforcement; time-zone-independent raw SQL.
- Batched broadcast writes.
- Maintenance purge in bounded 5,000-row batches.
- Existing indexes reviewed: trigram GIN for search, `(userId, createdAt)`, `(status, createdAt)` and unique/FK rules are adequate. **No new indexes or migrations were needed.**
- Pool sizing, `sslmode`, PgBouncer and least-privilege role documented; health warns when `connection_limit` is missing.

## 6. SEO
- `sitemap.xml`: live products (up to 45k), active categories, live campaigns and static pages; regenerated hourly.
- `robots.txt`: private routes excluded; links the sitemap. The admin has its own disallow-all `robots.txt`.
- `metadataBase`, canonical URLs (listing filter, sort and page variants canonicalise to the base page), Open Graph and Twitter cards, unique titles and descriptions on every public page.
- JSON-LD, built from real data only: Organization + WebSite (with SearchAction); Product + Offer/AggregateOffer (availability from stock); BreadcrumbList on product and category pages. **No ratings or reviews.** The serializer is escaped against `</script>` injection, with a test.
- `noindex` (meta and `X-Robots-Tag`): account, checkout, cart, wishlist, auth, order success, search, all `/api/*` and the whole admin.
- Product gallery uses the admin-entered alt text.

## 7. Monitoring configuration
- `observability.ts`: JSON log lines (`ts, level, event, service, env, category …`). Secrets, tokens, cookies, signatures and card fields are removed by key; emails and phone numbers in text are masked. Verified: no cookies, passwords or emails in the production-server logs from the E2E run.
- Errors are forwarded to **Sentry** (`SENTRY_DSN`, envelope API) and/or `MONITORING_WEBHOOK_URL`. Fire-and-forget with a 3 s timeout. Tested with a mocked endpoint, **not against a real Sentry project**.
- Covered:
  - every API 5xx, with a `reference` id in the response;
  - auth, CSRF, permission and 429 denials;
  - payment, order and webhook rejections;
  - OAuth failures;
  - catalog and DB failures;
  - cron failures;
  - slow requests (`SLOW_REQUEST_MS`).
- `GET /api/health` on both apps: DB round-trip; with the secret it adds migrations, session time zone, integrations and a production config review (booleans only).

## 8. Backup verification — Done+Tested
- `scripts/db/backup.mjs`: pg_dump custom format, SHA-256 manifest with row counts and migrations, readability check, retention pruning.
- `scripts/db/restore-verify.mjs`: restores into a **new** DB only (refuses the source DB, existing DBs and production by default), then verifies checksum, all table row counts, migrations and business invariants.
- Test restore of the dev DB: **53 tables / 368 rows identical, 4 migrations, all invariants pass, restore 1.4 s**. Restoring into the live DB is refused (tested).
- Schedule, off-site encrypted copy, PITR, RPO/RTO and the incident procedure are in DEPLOYMENT.md §6.

## 9. Test results
- **Unit/integration: 139/139 passing** (118 existing + 21 new P3 tests: redaction, Sentry/webhook forwarding, client IP, JSON-LD escaping, price race, per-page counts, analytics, batched announcement, maintenance purge, cron auth, health, security headers).
- **End-to-end against production builds (`scripts/e2e/run.mjs`): 71/71**
  - Admin, 23 checks: login (cookie flags, generic error), dashboard, create/update/publish product, image upload incl. disguised non-image rejection, opening stock and negative-stock refusal, coupons (valid and expired), Fill Your Cart campaign and analytics, view customer, the full order lifecycle to Delivered (stock committed, COD marked paid), backwards transition refused, analytics.
  - Customer, 25 checks: OAuth start (PKCE, state, nonce), forged callback refused, browse, search, cart add/update, client prices ignored, invalid/expired/valid coupon, address, serviceability, checkout summary, COD order, concurrent duplicate submit gives one order, unsigned webhook and fake client payment refused, history, detail, tracking timeline.
  - Edge cases, 23 checks: insufficient stock, price change shown in the cart and charged at the new price, two customers racing for the last units (exactly one wins, no oversell), IDOR on order, cancel, cart line and address, foreign address at checkout, session boundaries both ways, CSRF on both apps, RBAC (no inventory access, no self-escalation), inactive admin (session revoked, login refused), logout invalidation on both apps.
- **Responsive QA: 392 page×width checks** (49 pages: 15 public, 12 signed-in customer, 22 admin × 360/375/390/430/768/1024/1280/1440 px): **0 horizontal overflow, 0 console errors, 0 CSP violations, 0 error statuses**. Screenshots were reviewed at 360 and 1280 px.
- **Deployment verifier (`scripts/verify-deployment.mjs`)** against the local production builds: **0 failures** (TLS checks skipped: http).

## 10. Production build — Done
`next build` succeeds for both apps (storefront 98 static pages, sitemap and robots generated). Type-check is clean for `@20mart/server`, `@20mart/ui`, the storefront and the admin.

## 11. Deployment result — **Pending (not deployed)**
The existing Vercel deployment (`https://20mart-xi.vercel.app/`) still runs the old `main`. P0–P3 are uncommitted and **were not deployed**. Deploying needs your approval plus the hosted Postgres, env vars, storage and integrations below. Deployment-verification step 12 is therefore **not done**. Run `pnpm verify:deploy --store https://… --admin https://… --health-secret … --admin-user … --admin-pass …` after deploying, then the manual checklist in DEPLOYMENT.md §8.

## 12. Remaining risks
1. **Brand orange `#FF7A00` fails WCAG AA contrast** (2.4–2.6:1) for orange text and white-on-orange buttons. Left unchanged per "preserve the brand theme"; a darker orange (about `#C2410C`) for text and buttons would fix it.
2. Simulated FCP ≈ 2.1–2.3 s on slow 4G, caused by the brand font files (see §4); a font subsetting decision is pending.
3. CSP still needs `'unsafe-inline'` for scripts (Next 14 inline RSC payload); nonce-based CSP would require dynamic rendering of every page.
4. The in-memory rate limiter is per process. With several instances, add a shared limiter (Redis/edge). Admin login is additionally throttled in the DB.
5. Campaign banners and admin list thumbnails still use raw `<img>` (full-size originals). Switching to `next/image` needs a decision about arbitrary banner URLs.
6. If a Razorpay refund call times out after the provider created the refund, a retry is possible. Razorpay rejects refunds above the captured amount, so the risk is low.
7. Dev-DB rows written by raw SQL before the UTC fix have `updatedAt` 5 h 30 m ahead (cosmetic).
8. Wall-clock performance should be re-measured on production hardware.

## 13. Pending external integrations
- Hosting + domains + TLS + http→https redirect.
- Managed PostgreSQL with PITR; role time zone UTC; `connection_limit`/PgBouncer.
- S3/R2 bucket + CDN (`STORAGE_DRIVER=s3`).
- Production Google OAuth client and published consent screen; **real Google sign-in tested by a human**.
- Razorpay live keys + webhook, plus a test-mode end-to-end payment and refund (not exercised in this session by design).
- Resend verified domain + webhook.
- Sentry project (`SENTRY_DSN`).
- Cron scheduler for the three jobs.
- Off-site encrypted backup bucket.

## Acceptance criteria

| Criterion | Status |
|---|---|
| Critical security issues resolved | ✅ |
| Auth separation verified | ✅ (E2E) |
| RBAC verified | ✅ (tests + E2E) |
| Customer ownership protection | ✅ (E2E) |
| Inventory concurrency | ✅ (tests + E2E race) |
| Payment security | ✅ signatures, amount checks and forged calls (tests/E2E); live provider flow ⏳ |
| Backup tested | ✅ |
| Production build | ✅ |
| Customer and admin workflows | ✅ (except real Google sign-in ⏳) |
| SEO | ✅ |
| Monitoring | ✅ logs; Sentry ⏳ DSN |
| Mobile responsiveness | ✅ |
| **Production deployment verified** | ⏳ not deployed |

**Verdict:** the code is ready for a staging deployment. Production launch still depends on the pending integrations and a successful `verify:deploy` run on the real domains.
