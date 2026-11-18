# 20Mart – Live Production Test Report

Read-only verification of the live deployment. No production data was created, changed or deleted: no orders, payments, stock changes, admin logins or account changes. All write-type probes used invalid or cross-origin inputs that the server rejects before reaching the database.

## A. Environment

| Item | Value |
|---|---|
| Storefront | https://20mart-xi.vercel.app |
| Admin | https://20mart-admin.vercel.app (confirmed by `X-Robots-Tag: noindex`, admin CSP, `/login`) |
| Intended production commit | `origin/main` = `1ef8962` (fix(build): self-host Inter/Poppins) |
| Deployed commit | **Not observable.** `/api/health` reports `"release": null` |
| Next.js | 15.5.x (React 19), per P5 |
| Region | Vercel `bom1` edge → `sin1` functions |
| Test date | 2026-11-17 |
| Local repo note | Local `main` has 3 commits not on `origin/main` (`4ad1491`, `cd327e9`, `159b1f4`), so they are **not deployed**. Working branch `feat/p2-growth` = `1ef8962`. |

Tools used: `scripts/verify-deployment.mjs` (read-only), curl probes (≤3 requests per endpoint), Chrome (desktop, signed-in customer browser, no actions taken), server test suite on the local `*test*` DB, `turbo type-check` / `lint`.

## B. Summary

| Status | Count |
|---|---:|
| PASS | 22 |
| FAIL | 8 |
| BLOCKED | 14 |
| NOT TESTED | 4 |

## C. Module results

| Module | Status | Evidence | Issues |
|---|---|---|---|
| Customer application | PASS (infra) / FAIL (content) | `/`, `/shop`, `/deals`, `/search`, `/category/*`, `/about`, `/contact`, `/faqs`, `/shipping-policy`, `/returns-policy`, `/terms`, `/privacy` → 200. Unknown product/category → 404. No console errors, failed requests or broken images on the home page. | LP-01 |
| Admin application | PASS (unauth surface) / BLOCKED (signed-in) | `/login` 200. `/`, `/orders`, `/products`, `/inventory`, `/users`, `/settings` → 307 `/login?next=…`. robots `Disallow: /`, noindex. | Login flow needs test credentials |
| Authentication | PASS (negative paths) / BLOCKED (positive paths) | Customer APIs return 401 without a session or with a forged cookie. Google start uses PKCE + state, and its `redirect_uri` is fixed to the origin even when `returnTo=https://evil.example`. A forged callback `state` → `/auth?error=expired`. Logout via GET → 405. Admin login: cross-origin POST → 403, invalid body → 400 validation. | Admin login/logout/lockout and the full Google round trip are blocked (see E) |
| RBAC | PASS (automated) / BLOCKED (live) | `rbac.test.ts` and `auth.admin.test.ts` pass. 13 admin API groups return 401 unauthenticated. A customer cookie on an admin API → 401. | No per-role test accounts in production |
| Product catalog | **FAIL** | `/api/catalog/products` → `{"items":[],"total":0}`. The sitemap has no product URLs. `/shop` shows “0 items available”. Validation works (`pageSize>48` and an unknown `sort` → 400). | LP-01 |
| Warehouse availability | **FAIL** | PINs 110001, 400001, 302001 and 380015 → `NOT_SERVICEABLE`. Invalid PINs (`000000`, `12345`, `abcdef`) → `INVALID`. `p4-fulfillment.test.ts` passes (available = onHand − reserved − safety, inactive/out-of-area warehouses excluded). | LP-02, LP-04 |
| Cart | PASS (validation) / BLOCKED (happy path) | Guest `GET /api/cart` 200. Non-UUID product → 400. Unknown UUID → 404. qty < 1 → 400. Guest coupon → 401. Cross-origin → 403. 400 KB body → 413. `cart.test.ts` and `coupons.test.ts` pass. | No purchasable product to add |
| Checkout | **FAIL** / BLOCKED | `/checkout` → sign-in redirect. `/api/checkout/summary` 401 unauthenticated. `/api/store-info` returns `paymentMethods: []`. Server-side recalculation is covered by `checkout-orders.test.ts`. | LP-01, LP-02, LP-03 |
| Payments | **FAIL** (config) / PASS (automated) | Unsigned webhook → **503** (secret not configured; a configured secret should give 401). `/verify` unauthenticated → 401. `payments.test.ts` passes (signature, currency, amount, duplicate webhook). | LP-03 |
| Orders | PASS (authz) / BLOCKED (lifecycle) | `/api/orders` and `/api/orders/{n}` → 401 unauthenticated. `order-routes.test.ts` and `checkout-orders.test.ts` pass (IDOR, idempotency, reservation release). | No live orders created, by design |
| Procurement | PASS (automated) / BLOCKED (live) | `/api/admin/suppliers` and `/api/admin/purchase-orders` → 401. `p4-fulfillment.test.ts` covers PO without stock change, GRN increment, over-receipt and duplicate receipt. | Admin credentials required |
| API security | PASS, with minor findings | CSRF origin check, 405 on wrong methods, cron/revalidate 401 without a secret, SQLi/XSS strings in search return safe empty results, consistent JSON error shape. | LP-05 |
| Performance | PASS (sampled) / NOT TESTED (Lighthouse) | Warm TTFB: home 0.24–0.43 s, `/shop` 0.40 s (1.38 s cold), search 0.35–0.42 s, category 0.38–0.47 s, catalog API 0.30–0.49 s, health 0.34 s, admin login 0.35–0.44 s. Home page: DCL 728 ms, load 2.6 s, JS 168 KB transferred. | Measured with an empty catalog, so not representative of real load |
| Database | PASS (reachability) / BLOCKED (detail) | Health: DB ok (2–199 ms). The verifier's migration/time-zone checks need the health secret. | Migration status, indexes and integrity not verified |
| Integrations | Mixed | See section G | LP-03, LP-04 |
| Backup and recovery | BLOCKED | No Neon access from this session. P5's open item “Neon restore” is still open. | — |
| Responsive UI | PASS (desktop 1366) / NOT TESTED (mobile, tablet) | No horizontal scroll, `lang="en"`, `<main>` present, all images have `alt`. The window resize to 390 px did not take effect. | LP-07 |

Automated tests (local `twentymart_test` DB): **155/155 passed** (17 files). Type-check **5/5 passed**. Lint **fails to run** (LP-06). E2E suite **not run** (it needs local servers on a scratch DB).

## D. Issues

### LP-01 — Critical — Product catalog is empty in production
- **Steps:** `GET /api/catalog/products?pageSize=48`; open `/shop`; read `/sitemap.xml`.
- **Expected:** Active products are listed and sellable.
- **Actual:** `total: 0`; `/shop` shows “0 items available”; the sitemap has no product URLs; the home page shows “Coming Soon”.
- **Evidence:** API response and Chrome screenshot of `/shop`.
- **Fix:** Create or publish products in admin. Possibly they exist but none are visible (they need active status plus stock in an active warehouse). Check in admin which applies.

### LP-02 — Critical — No PIN code is serviceable
- **Steps:** `GET /api/delivery/check?pincode=110001` (also tried 400001, 302001 and 380015 from the live header).
- **Expected:** PINs in the delivery area are serviceable.
- **Actual:** `NOT_SERVICEABLE` for every PIN tried.
- **Fix:** Configure and activate at least one real warehouse with delivery-area PINs. The P4 migration moved stock to placeholder warehouse `PRIMARY` (PIN 000000, inactive), so it must be configured or replaced.

### LP-03 — Critical — No payment method enabled; Razorpay not configured
- **Steps:** `GET /api/store-info`; `POST /api/payments/razorpay/webhook` with a bad signature.
- **Expected:** At least one payment method is enabled, and the webhook rejects a bad signature with 401.
- **Actual:** `paymentMethods: []`. The webhook returns 503, meaning the webhook secret is not configured.
- **Fix:** Set the Razorpay key ID, secret and webhook secret in Vercel Production (test keys first), register the webhook URL in the Razorpay dashboard, and enable the method(s) in store settings.

### LP-04 — Medium — GPS location lookup unavailable
- **Steps:** `POST /api/location/reverse {"lat":28.6,"lng":77.2}`; `GET /api/location`.
- **Actual:** 503 `GEOCODING_UNAVAILABLE`; `gpsAvailable: false`. The UI falls back to manual PIN entry, which works.
- **Fix:** Configure the geocoding provider key, or accept manual PIN entry only for launch.

### LP-05 — Low — `/api/inquiries` bypasses the 256 KB body cap
- **Steps:** `POST /api/inquiries` with a 400 KB JSON body (same origin).
- **Expected:** 413, as on `customerRoute` endpoints (the cart returns 413).
- **Actual:** The body is fully parsed and rejected with 400. The route calls `req.json()` directly (`apps/20mart/src/app/api/inquiries/route.ts`). The rate limit (5 per 10 min) and the CSRF check still apply.
- **Fix:** Wrap the route in `customerRoute` or apply the shared body-size guard.

### LP-06 — Low — Lint is not configured
- **Steps:** `pnpm turbo run lint`.
- **Actual:** `next lint` opens an interactive setup prompt and exits 1 in both apps. No ESLint config exists, and `next lint` is deprecated.
- **Fix:** Add an ESLint flat config (`eslint-config-next`) and switch the scripts to `eslint .`.

### LP-07 — Low — Search inputs have no accessible label
- **Evidence:** Both header search inputs (desktop and mobile) have only a placeholder: no `<label>`, `aria-label` or `aria-labelledby`.
- **Fix:** Add `aria-label="Search products"`.

### LP-08 — Low — Deployed commit cannot be verified
- **Actual:** `/api/health` reports `release: null`, so the live commit cannot be matched to `1ef8962`.
- **Fix:** Expose `VERCEL_GIT_COMMIT_SHA` (short form) as `release`.

## E. Blocked tests

| # | Test | Needs |
|---|---|---|
| 1 | Admin login success, logout, session expiry | Dedicated admin test account (credentials supplied out-of-band) |
| 2 | Account lockout / DB-backed login throttling (live) | Disposable admin test account |
| 3 | Per-role RBAC: SUPER_ADMIN, ADMIN, PRODUCT/INVENTORY/CONTENT_MANAGER | One test account per role |
| 4 | Google OAuth full round trip, session creation, logout, revocation | Manual verification (the browser used already had a customer session, which suggests sign-in has worked) |
| 5 | Customer cross-account IDOR on live orders | Two test customer accounts with orders |
| 6 | Add to cart → checkout happy path, coupon apply, delivery fee | LP-01 and LP-02 resolved, plus a test product |
| 7 | Razorpay order creation, payment, failure, refund | LP-03 resolved with **test-mode** keys |
| 8 | Order lifecycle, warehouse assignment, reservation release | Test order, after 6 and 7 |
| 9 | Procurement / goods receipt (live) | Admin credentials and an isolated test warehouse/product |
| 10 | Multi-warehouse priority and inactive-warehouse exclusion (live) | Configured warehouses |
| 11 | Migration status, indexes, referential integrity, duplicates | Health secret or read-only DB access |
| 12 | Backup retention and restore to an isolated Neon branch | Neon console access |
| 13 | Resend, Vercel Blob, Upstash, error monitoring connectivity | Health secret or provider dashboards |
| 14 | Deployed commit identity | LP-08 or Vercel dashboard |

**Not tested:** E2E suite (`scripts/e2e/run.mjs`, needs local servers on a scratch DB), mobile/tablet layouts, keyboard navigation and colour contrast, Lighthouse.

## F. Final launch assessment

**NO-GO.**

The platform's security surface is solid: TLS, headers, CSRF, auth enforcement on every customer and admin API probed, input validation and safe error handling all held, and 155/155 server tests pass. However, a customer **cannot currently buy anything**:

- There are no products (LP-01).
- No PIN code is serviceable (LP-02).
- No payment method is enabled (LP-03).

In addition, no purchase, payment, order or admin workflow has been verified live.

The status moves to **CONDITIONAL GO** once:

1. LP-01 to LP-03 are fixed.
2. Blocked tests 1, 3, 4, 6, 7 and 8 pass using test accounts and Razorpay test mode.
3. Blocked test 12 (Neon restore) is completed.

## G. Integrations

| Integration | Configured | Verified | Result / action |
|---|---|---|---|
| Google OAuth | Yes | Start redirect + state/PKCE verified | Full round trip needs manual check |
| Razorpay | **No** (webhook 503, no payment methods) | — | LP-03 |
| Geocoding | **No** (503) | — | LP-04 |
| Neon PostgreSQL | Yes | Health DB ok | Migrations not verified |
| Vercel | Yes | Both apps live, TLS valid 73 days, HTTP→HTTPS 308 | — |
| Upstash rate-limit store | Per P5 notes | Not verified live (would need a burst of requests) | Check via health secret |
| Resend email | Unknown | — | Blocked #13 |
| Vercel Blob | Unknown (catalog empty, no product images) | — | Blocked #13 |
| Error monitoring | Unknown | — | Blocked #13 |

## H. Proposed remediation plan (not executed)

1. **P0 – Make the store sellable:** configure a real warehouse and delivery PINs (LP-02), publish products with stock (LP-01), and configure Razorpay **test** keys plus the webhook (LP-03).
2. **P0 – Live verification:** create admin role test accounts and two test customers, then re-run this report's blocked tests with `verify-deployment.mjs --admin-user/--admin-pass --health-secret`. Run a full Razorpay test-mode purchase, then refund it.
3. **P1:** restore a Neon branch and record the result (#12); decide on GPS geocoding (LP-04); expose the release SHA (LP-08).
4. **P2:** inquiries body cap (LP-05), ESLint setup (LP-06), search input labels (LP-07), and a mobile/a11y pass plus Lighthouse.
5. Then switch Razorpay to live keys and do one small real-money transaction you authorize and refund yourself.
6. Decide whether the 3 unpushed local `main` commits should ship, and re-verify after deploying.
