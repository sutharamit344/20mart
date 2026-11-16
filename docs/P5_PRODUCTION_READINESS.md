# 20Mart — Phase 5 Production Readiness Report

Date: 2026-11-16 · Branch `feat/p2-growth` · Changes are **uncommitted** and **not deployed**.

P3 (docs/P3_LAUNCH_REPORT.md) already completed a full security, performance, SEO, monitoring and backup pass. P5 therefore re-audited:
- everything added since then: P4 warehouses, procurement and fulfilment, and the Vercel deployment commits;
- the dependency tree;
- payments and the integrity of the critical paths.

It then re-verified the whole system with tests, the end-to-end (E2E) suite, a production build and a restore test.

---

## 1. Audit findings and remediation

| # | Sev. | Area | Finding | Fix | Status |
|---|---|---|---|---|---|
| 1 | **Critical** | Dependencies | **Next.js 14.2 had 3 critical unauthenticated RCE advisories** (Image Optimization API: AVIF/SVG; Windows hosts), plus about 25 high/moderate ones: DoS, SSRF, middleware bypass, cache poisoning. Next 14 is end-of-life, so no 14.x patch exists. | Upgraded to **Next 15.5.29 + React 19.1**. Migrated 36 pages/`generateMetadata` and 2 media routes to async `params`/`searchParams`. The shared `adminRoute`/`customerRoute` wrappers now await route params, and `session.ts` awaits `cookies()`. Renamed `serverComponentsExternalPackages` → `serverExternalPackages`. | Done + Tested |
| 2 | High | Dependencies | `sharp` 0.33 bundled a vulnerable libvips/libheif/librsvg (3 high advisories). | `sharp` 0.35.5. | Done + Built |
| 3 | High | Security | **Next 15 removed `req.ip`.** The rate limiter used it as the trusted client IP on Vercel. | On Vercel, the platform-set `X-Real-IP` is used instead (Vercel overwrites any client-supplied value). Elsewhere, the proxy-appended `X-Forwarded-For` entry is used, as before. | Done + Tested |
| 4 | High | Security | JSON request bodies had no size cap: 22 routes call `req.json()` directly. Zod 3 has a memory-exhaustion advisory for oversized collections. | Both route wrappers reject non-multipart bodies over 256 KB with **413** before buffering. Uploads keep their own 5 MB limit. | Done + Tested |
| 5 | High | Dependencies | `image-size` 1.1.1 has a DoS advisory (infinite loop). It was reachable only by admins uploading, after magic-byte sniffing. | `image-size` 2.1.0. Dimension checks re-tested. | Done + Tested |
| 6 | Medium | Payments | The payment **currency** was never verified (only the amount). | `markPaymentCaptured` rejects non-INR captures (`CURRENCY_MISMATCH`). The browser verify path and the webhook both pass the provider currency through. | Done + Tested |
| 7 | Medium | Payments | A captured webhook whose amount or currency mismatched threw an error, so the event was never recorded. Razorpay would retry it indefinitely and eventually disable the webhook. | The mismatch is never applied to the order. It is reported through `captureException` (`payment.capture_mismatch`) for a human to review, the event is recorded, and Razorpay gets a 200. | Done + Tested |
| 8 | Medium | Reliability | Razorpay REST calls and the Google token exchange had **no timeout**. A hung provider would hold the request open. | 15 s timeout (Razorpay), 10 s timeout (Google). Geocoding and Resend already had timeouts. | Done |
| 9 | Medium | QA | The E2E script (`scripts/e2e/run.mjs`) had a syntax error from its P4 update (duplicate `const wh`) and had never been run since. | Fixed, then run: 74/74. | Done + Tested |
| 10 | Medium | Ops (Vercel Hobby) | Cron jobs run once a day. Expiring abandoned payments is also triggered on every checkout and admin order list, so stock is not stuck. Emails are sent inline, so the cron only **retries failed emails**, at most daily. | None needed for launch. A Pro plan or an external scheduler gives sub-hourly retries. | Accepted |
| 11 | High | Security | The rate limiter kept its counts **in memory, per process**. On Vercel serverless, every instance has its own counter, so the limits on checkout, coupons, contact and OAuth were weak. | `rateLimit()` now uses a **shared Upstash Redis store** (REST API, no SDK, 1 s timeout) when `UPSTASH_REDIS_REST_URL`/`_TOKEN` (or Vercel's `KV_REST_API_URL`/`_TOKEN`) are set. If the store is unreachable it falls back to the in-memory limiter and logs `ratelimit.store_unavailable`. On Vercel, /api/health warns until the store is connected. | Done + Tested · **you must connect Upstash** |
| 12 | Moderate (open) | Dependencies | `postcss` (bundled inside `next`) and `deepmerge-ts` (inside the Prisma CLI) have advisories. Both run **at build time only**, on our own source. `zod` 3: see #4. | The upgrade to Zod 4 is a breaking API migration and is deferred. | Accepted |
| 13 | Low | SEO | Unknown product/category/campaign slugs returned HTTP **200** (soft 404): the root `loading.tsx` streamed every page before the 404 was decided. | The skeleton moved to `components/PageSkeleton.tsx` and is used by `loading.tsx` in /shop, /deals, /search and /account only. Missing slugs now return a real **404** to browsers and crawlers. | Done + Tested |

Re-verified with no change needed:
- **Admin access control:** every admin API route goes through `adminRoute(permission)`. The only exceptions are login, logout and health.
- **Goods receiving:** the purchase order row is locked (`FOR UPDATE`), a repeated submit with the same idempotency key is applied once, receipts are capped at the outstanding quantity, and inventory rows are locked in a fixed order.
- **Stock holds:** state transitions (RESERVED → COMMITTED / RELEASED) use conditional updates, so stock is never deducted twice.
- **Cancellation:** releases or restocks inventory, reverses the coupon use and requests a refund, all in one transaction.
- **Warehouse zone mappings:** scoped by warehouse id.
- **Public P4 endpoints** (availability, location, reverse geocode, delivery interest): validated and rate-limited.
- **Production build script:** `vercel-migrate.mjs` only runs `migrate deploy` (never a reset) and the idempotent seed, and only when `VERCEL_ENV=production`.

## 2. Breaking-change notes (Next 15 / React 19)

- **Route params:** handler context `params` is now a Promise. Use `adminRoute`/`customerRoute`, which await it for you. A raw handler must `await props.params`.
- **Pages:** `params`/`searchParams` props are Promises. Every existing page has been migrated.
- **Caching defaults:** GET route handlers and `fetch` are no longer cached by default. Every API route here was already dynamic, and the ISR catalog pages keep their explicit `revalidate`.
- **Bundle size:** first-load JS shared by all routes is 102 kB in both apps.
- **Peer dependency:** `@20mart/server` now requires `next ^15.5.29`.

## 3. Tests executed (all actually run in this session)

| Check | Result |
|---|---|
| `pnpm type-check` (5 packages) | ✅ pass. Before the upgrade, the admin app failed on an `@types/react` mismatch. |
| Server unit/integration tests (`pnpm test`, `twentymart_test` DB) | ✅ **155/155**, 17 files. New tests: payment currency and mismatch handling; body cap; Vercel IP source; image dimensions (image-size 2); shared rate limiter and its fallback. |
| Production build of both apps (`next build`, Next 15.5.29) | ✅ The admin build first failed on a transient Google Fonts download; it passed on retry. |
| E2E against production builds (scratch DB `twentymart_p5_scratch`, restored from a dev backup; email and Razorpay off) | ✅ **74/74** (re-run after the rate-limit and 404 changes): customer and admin workflows, RBAC, IDOR, duplicate checkout, concurrent last-item purchase, forged webhooks, session revocation, PIN/warehouse fulfilment. |
| Page smoke test on the Next 15 build (home, shop, search, deals, category, product, auth, sitemap, robots, terms, admin login/redirect) | ✅ 200 / 307 as expected. CSP, X-Frame-Options and Referrer-Policy headers are present. |
| Backup + restore test (`db:backup` → `db:restore-verify`) | ✅ 9/9 integrity checks, restored in about 2 s (local dev DB). |
| `pnpm audit --prod` | Before: 36 advisories (3 critical, 18 high). After: **8** (0 critical; 6 high, 2 moderate; see #11–12). |

Not executed in this phase:
- Lighthouse and responsive/accessibility passes. These were done in P3; P5 changed no UI.
- Live Razorpay test-mode payment and refund.
- Real Google sign-in.
- A restore test of **production (Neon)** backups.
- Load testing on production hardware.

## 4. Remaining risks

1. Shared rate limiting is inactive until Upstash is connected (#11).
2. Brand orange `#FF7A00` fails WCAG AA contrast (carried over from P3).
3. The CSP still needs `'unsafe-inline'` for scripts.
5. Zod 3 remains (#12), mitigated by the body cap.
6. Daily cron only on Vercel Hobby (#10).
7. Daily delivery capacity is a soft cap (P4).

## 5. Pending external credentials and verification

- **Razorpay:** test-mode keys and a webhook pointing at `https://<store>/api/payments/razorpay/webhook`. Run one successful payment, one failed payment and one refund end to end, then switch to live keys.
- **Google OAuth:** a production client, with callback `https://<store>/api/auth/google/callback`. A human must test sign-in.
- **Resend:** a verified sending domain and its webhook.
- **Neon:** confirm PITR retention, then run one restore into a branch and run `restore-verify` checks against it.
- **Vercel Blob:** confirm `STORAGE_PUBLIC_BASE_URL`/media host and test an upload in production.
- **Sentry DSN** (optional). Without it, errors go to Vercel logs only.
- **Upstash Redis:** connect it in Vercel → Storage. That sets `KV_REST_API_URL`/`KV_REST_API_TOKEN` automatically.

## 6. Deployment and rollback

**Deploy:**
1. Take a Neon branch/snapshot first.
2. Push. The production build runs `migrate deploy` and the seed. There is no new migration in P5.
3. Run `pnpm verify:deploy --store … --admin … --health-secret … --admin-user … --admin-pass …`.
4. Do the manual checklist in DEPLOYMENT.md §8.

**Rollback:** use Vercel "Promote" on the previous deployment (instant). P5 has no schema change, so no database rollback is needed. For future risky migrations, restore from the pre-deploy Neon branch.

## 7. Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | No unresolved critical vulnerabilities | ✅ (0 critical). #11 needs Upstash connected |
| 2 | Authentication and RBAC | ✅ tests + E2E |
| 3 | Server-side authorisation on sensitive APIs | ✅ |
| 4 | Orders and inventory consistent under concurrency | ✅ tests + E2E race |
| 5 | Payment verification and webhooks reliable | ✅ code + forged/duplicate/mismatch tests; ⏳ live provider test |
| 6 | Duplicate operations handled safely | ✅ |
| 7 | Backups restored in a test | ✅ local; ⏳ production (Neon) |
| 8 | Important APIs performance-reviewed | ✅ P3 (no regression measured in P5) |
| 9 | Responsive UI | ✅ P3; not re-run |
| 10 | Critical journeys pass E2E | ✅ 74/74 |
| 11 | Logging and monitoring operational | ✅ structured logs; ⏳ alerting destination (Sentry) |
| 12 | SEO technical configuration | ✅ (soft-404 noted) |
| 13 | Production environment variables validated | ⏳ needs access to the Vercel project |
| 14 | Deployment and rollback documented | ✅ |
| 15 | Business operations ready | ⏳ owner checklist below |

**Business checklist (owner):**
- Real stock received into an ACTIVE warehouse.
- The placeholder PRIMARY (PIN 000000) warehouse configured or replaced.
- Delivery areas limited to PIN codes you can actually serve.
- Delivery charges and estimates reviewed.
- Prices and margins reviewed.
- Packaging and returns/refund process defined.
- Support phone/email published on /contact.
- Policy pages (terms, privacy, shipping, returns, cancellation) reviewed by you.

## 8. GO / NO-GO

| Stage | Decision |
|---|---|
| Staging / internal testing on Vercel | **GO** once this branch is deployed and `verify:deploy` passes |
| Limited customer pilot (invite-only, one serviceable area, COD or Razorpay test → live) | **GO, conditional** on: (a) one live Razorpay payment and refund verified; (b) a human-tested Google sign-in; (c) Upstash Redis connected (Vercel → Storage → Upstash), and /api/health no longer warns about `UPSTASH_REDIS_REST_URL` |
| Public launch | **NO-GO** until the pilot conditions above are met, a Neon restore test is done, error alerting has a destination, and the owner checklist is complete |

A successful build is not, on its own, a production-readiness signal. The code-level critical issues are resolved. What remains is external verification and business operations.
