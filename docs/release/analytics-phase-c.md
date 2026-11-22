# Release plan — Analytics Phase C (product demand)

Status: **prepared, awaiting approval.** Nothing has been merged, pushed, migrated, backfilled or deployed.

| | |
|---|---|
| Release branch | `feat/analytics-phase-c` (from `main` `20361c2`) |
| Commits | C1 `55b0513` aggregation · C2 `0bfb360` admin APIs · C3 `052405b` admin UI · C4 release prep (this doc, rollback/verify SQL, responsive fixes) |
| Migration | `20261121174444_analytics_product_daily` (additive) |
| New permission | none (uses existing `analytics.view`) |

## 1. What changes in production

- **Database (additive only):** new enum `AnalyticsCoverage`; new tables `ProductDailyAnalytics`, `InventoryDailySnapshot` (+4 indexes); new nullable column `AnalyticsSettings.trackingStartedAt`. No existing row is modified; no column is dropped or retyped.
- **Nightly maintenance cron** (storefront, 03:00 IST) additionally aggregates finished IST days: up to 7 missing days per run (35-day lookback) and refreshes the last 3 days. A failure is logged and never blocks the other maintenance steps.
- **Admin:** Analytics → *Product demand* (list, detail, compare, CSV export) behind `analytics.view`. CSV exports are rate-limited (10 per admin per 10 min) and audit-logged.
- **Customer flows:** unchanged. Aggregation runs only from the cron or the backfill script and only reads business tables.

## 2. Pre-requisites

1. **Neon backup branch** (Console → project → Branches → *Create branch* from production at "now", name `pre-analytics-c-<date>`). Record the timestamp.
2. **Vercel production env check:** `RUN_PRODUCTION_SEED` must be **absent**; `SKIP_BUILD_MIGRATIONS` absent (or `1` if the migration is run manually first and you want the build hook off); no `INITIAL_ADMIN_*`.
3. **Production direct (unpooled) Neon URL** for the operator, in a git-ignored file (e.g. `packages/database/.env.release.local`), only for steps 4 and 7. It is never committed or printed.
4. Record the current production deployment IDs of both Vercel projects (for Instant Rollback).

## 3. Rehearsal (done, local copy of the dev database)

| Check | Result |
|---|---|
| Pre-release state reproduced (rollback SQL on a copy) | `migrate status`: exactly 1 pending — this migration |
| `prisma migrate deploy` | Applied in ~9 s |
| Schema drift (`migrate diff` DB vs `schema.prisma`) | None |
| Business data fingerprint (Order, OrderItem, Product, Inventory, StockMovement, counts) | Identical before / after migration, after backfill, after rollback |
| Indexes / enum / column | 6 indexes; `{NONE,PARTIAL,FULL}`; nullable `timestamp(3)` |
| Backfill safeguard | Non-local URL refused without `--confirm-production` |
| Backfill (8 days, 94 products) | ~5 s total; 0 failed; rerun skipped all 8 (idempotent) |
| Coverage / honesty | NONE before tracking start, PARTIAL on first tracked day, FULL after; 0 event counts on NONE days |
| Sales reconciliation (verify C5) | 0 difference on every day |
| Stock replay | 0 inconsistent snapshots |
| Rollback SQL | Objects + `product-daily` job rows removed; migration pending again; business data identical; re-apply + backfill rebuilt all 8 days |

## 4. Release sequence

| # | Who | Action | Expected |
|---|---|---|---|
| 1 | Operator | Backup branch + env check (§2); run verify **Section A** in the Neon SQL editor and save the output | Fingerprint saved |
| 2 | Operator | From a `feat/analytics-phase-c` checkout with the production direct URL as `DATABASE_URL`: `pnpm --filter @20mart/database exec prisma migrate status` | Exactly 1 pending: `20261121174444_analytics_product_daily` |
| 3 | Operator | `pnpm --filter @20mart/database exec prisma migrate deploy` | "Applying migration `20261121174444_analytics_product_daily`" — "All migrations have been successfully applied." (~10 s) |
| 4 | Operator | Verify **Section B** and **Section A** again | B as described in the file; A identical to step 1 |
| 5 | Operator | `git checkout main && git merge --ff-only feat/analytics-phase-c && git push origin main` | Vercel builds both projects. Storefront build log: migrate deploy "No pending migrations", RBAC sync, "full seed skipped" |
| 6 | Operator | Wait for both deployments to be **Ready** | Admin shows Analytics → Product demand |
| 7 | Operator | Backfill — dry run: `pnpm --filter @20mart/server analytics:backfill --dry-run --confirm-production` then run: `pnpm --filter @20mart/server analytics:backfill --confirm-production` | Prints tracking start / sales / stock dates; "Done: N aggregated, 0 skipped, 0 failed." where N = days from the first data day to yesterday (IST) |
| 8 | Operator | Verify **Section C** (C1–C7) | No failed days; 0 invented event rows; C5 diffs 0; C6 empty or explainable |
| 9 | Operator | Admin smoke (§6) | All pass |

**Why the database goes first:** the new admin code reads `AnalyticsSettings.trackingStartedAt`. If the admin deployment went live before the migration, the existing Analytics settings/abandoned-cart screens would error until it is applied. The old production code is unaffected by the migrated schema (additive; Prisma selects named columns only).

**Simpler alternative (no production URL needed):** skip steps 2–4 and 7. The storefront production build applies the migration before its deployment goes live (build hook); redeploy the admin project after the storefront deployment is Ready to avoid the window above. Historical days are then filled by the nightly cron: up to 7 missing days per night within a 35-day lookback, so production history (which starts in mid-November 2026) is complete after one or two nights. Days older than 35 days would need the backfill script.

## 5. Rollback

| Level | When | How | Data impact |
|---|---|---|---|
| **L1: app** | Any problem with the new screens/cron | Vercel → each project → Instant Rollback to the recorded deployment | None. Old code ignores the new tables |
| **L2: branch** | Right after L1 | `git revert` the Phase C commits on `main` (or reset `main` to `20361c2` with a force-push, if agreed) | None |
| **L3: schema** | Only if the new objects must go | After L1/L2, run `docs/release/rollback-analytics-phase-c.sql` (one transaction: drops the 2 tables, column and enum; deletes `product-daily` job rows and the migration history row) | Deletes derived aggregates only; rebuildable by re-applying + backfill. Store data untouched (rehearsed) |
| **L4: restore** | Only for unexpected data corruption elsewhere | Restore from the Neon backup branch | Loses every write since the backup (orders, payments) |

`prisma migrate resolve --rolled-back` does not work for an applied migration (P3012); the SQL removes the history row itself.

## 6. Production smoke tests

1. Admin with `analytics.view` (e.g. Marketing Manager): Analytics → Product demand loads; coverage bar shows tracking start (IST) and any not-aggregated days; KPI groups show Actual sales separate from Estimated lost demand.
2. Filters, sort, pagination; open a product detail; compare 2 products.
3. CSV export downloads; verify **C8** shows the audit row.
4. An admin without `analytics.view` (e.g. Order Manager): the page shows "Access denied"; the API returns 403.
5. Storefront regression: browse, add to cart, checkout (COD) unchanged — no new customer-facing code.
6. Next morning: verify **C1** shows the previous day `done` (nightly cron).

## 7. Released files (vs `main`)

- Database: `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/20261121174444_analytics_product_daily/migration.sql`
- Server: `src/tracking/product-daily.ts`, `src/tracking/product-demand.ts`, `src/tracking/index.ts`, `src/maintenance.ts`, `src/audit.ts`, `scripts/analytics-backfill.ts`, `package.json` (script), tests `analytics-product-daily.test.ts`, `analytics-product-demand.test.ts`
- Admin: `api/admin/analytics/products/{route,[id]/route,compare/route,export/route}.ts`; `(dashboard)/analytics/{page.tsx,AnalyticsTabs.tsx}`; `(dashboard)/analytics/products/**`; `components/charts.tsx`
- Docs: this file, `rollback-analytics-phase-c.sql`, `verify-analytics-phase-c.sql`
