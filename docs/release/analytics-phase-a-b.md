# Release plan — Analytics Phase A + B

Status: **prepared, awaiting approval.** Nothing has been merged, pushed, migrated or deployed.

| | |
|---|---|
| Release branch | `feat/p2-growth` |
| Production today | `main` = `4d71c46` (bulk product import) |
| Release commits | `1486ca8` Phase A · `a1793aa` merge of main · `e80cc65` test fixtures · `886d592` Phase B · release-prep commit (this document, build hook, RBAC sync) |
| Merge type | Fast-forward: `feat/p2-growth` already contains `main` |
| Database change | 1 migration, `20261118090000_analytics_foundation` (4 new tables, 3 new enum types, indexes) |
| New env vars | None |

## 1. What changes in production

**Shoppers**
- A consent banner ("Allow analytics" / "Essential only") and a "Privacy choices" link in the footer.
- Browsing events are sent only after "Allow analytics". Global Privacy Control and Do Not Track are honoured.
- Existing flows (cart, checkout, payment, orders, wishlist, coupons, delivery check) now record operational events after the response. They are not otherwise changed, except:
  - A refused guest "add to cart" no longer creates an empty cart.
  - Removing or changing cart lines updates the cart's activity time.
  - Two simultaneous quantity changes on one line: each records its own delta. In the extreme case, after 5 consecutive collisions the request returns "Your cart was just changed. Please try again."

**Admins**
- New permission `analytics.manage`, granted to Super Admin only.
- New endpoints:
  - Analytics settings: view needs `analytics.view`; changes need `analytics.manage`.
  - Abandoned-cart summary: `analytics.view`.
  - Unfulfilled demand: `analytics.view`.

**Platform**
- The daily `/api/cron/maintenance` job also purges analytics data past its retention period. Defaults: behavioural data 180 days; operational data anonymised, then deleted, per settings.
- **Build hook change.** Production storefront builds no longer run the full seed. See §5.

## 2. Pre-requisites (before the release window)

1. **Approvals:** this plan, and the release-prep commit (§8).
2. **No other merge into `main` first.** The `fix/price-grid` work (in `D:\Project\20Mart-bulk`) must not reach `main` before this release. If it does, merge `main` into `feat/p2-growth` again and re-run all checks.
3. **Production database access for the operator.** Use the **direct (unpooled)** Neon connection string, in a git-ignored file such as `.env.import.local`. It is marked Sensitive in Vercel and cannot be pulled with the CLI.
4. **Record the current Vercel production deployments** of `20mart` and `20mart-admin`, for Instant Rollback.
5. **Release window:** a quiet period. There is no maintenance page; the release causes no downtime.

## 3. Backup

1. **Neon:** Console → project → Branches → *Create branch* from the production branch at "now", named `pre-analytics-<date>`. This is an instant copy-on-write snapshot.
   - Keep it for at least 7 days.
   - Point-in-time restore is the second line of defence; its window depends on the Neon plan.
2. **Note the timestamp.** Restoring the branch loses every write after it (orders, payments, customers), so it is a **last resort** only.
3. **No backup needed for Vercel:** Instant Rollback keeps previous deployments.

## 4. Controlled release sequence

The migration is backward compatible: today's production code runs unchanged on the migrated schema (rehearsal §6). So the database goes first, as its own step, and the new code only afterwards.

| Step | Who | Action | Pass criteria |
|---|---|---|---|
| 0 | Dev | Commit the release-prep changes on `feat/p2-growth`; run tests, type-checks and both builds | All green |
| 1 | Operator | Neon backup branch (§3); record deployment IDs | Branch exists |
| 2 | Operator | From a `feat/p2-growth` checkout, with the production direct URL as `DATABASE_URL`: `pnpm --filter @20mart/database exec prisma migrate status` | Exactly 1 pending: `20261118090000_analytics_foundation` |
| 3 | Operator | `pnpm --filter @20mart/database db:deploy` | "All migrations have been successfully applied" |
| 4 | Operator | `pnpm --filter @20mart/database exec tsx ./src/sync-rbac.ts` | `1 new permission(s) (analytics.manage)` |
| 5 | Operator | Verify (SQL in §9.1); check the live site still works on the old code | 4 empty analytics tables; store normal |
| 6 | Dev | `git push origin feat/p2-growth:main` (fast-forward) | Push accepted |
| 7 | Vercel | `20mart` and `20mart-admin` build and deploy independently. Order no longer matters: the schema is already in place. | Both deployments Ready |
| 8 | Dev | Check the `20mart` build log | `No pending migrations to apply`; `[sync-rbac] done: 0 new permission(s)`; `full seed skipped` |
| 9 | Dev + Owner | Smoke tests (§9) | All pass |
| 10 | Dev | Watch logs for 24 h, through the next maintenance cron (03:00 IST) | No `analytics.record_failed` bursts; no cron errors |

**If step 3 fails:**
- Prisma runs the migration in a transaction and marks it *failed*. The site keeps running on the old code.
- Fix the cause, run `prisma migrate resolve --rolled-back 20261118090000_analytics_foundation`, then retry step 3.
- **Do not merge.**

**Safety net:** if steps 2–4 are skipped by mistake, the storefront build still applies the migration before its own deployment goes live. The admin deployment does not wait for it, though: its three analytics screens could fail for a few minutes. This is why the controlled step comes first. To disable in-build migrations entirely, set `SKIP_BUILD_MIGRATIONS=1` in Vercel.

## 5. Build hook change: starter drafts re-created

**Cause.** `scripts/vercel-migrate.mjs` ran `db:seed` on every production build. The seed upserts its 12 starter products by SKU (`create` only), so any starter product deleted in the admin came back as a hidden draft on the next deploy. In the rehearsal, a database missing one starter SKU went from 94 → 95 products after the old hook.

**Fix (release-prep commit).** Production builds now run:
1. `prisma migrate deploy` — unless `SKIP_BUILD_MIGRATIONS=1`.
2. `src/sync-rbac.ts` — permissions, system roles and grants only. Same rules as the seed's RBAC part; never touches catalog, coupons, stock or orders.
3. The full seed **only** when `RUN_PRODUCTION_SEED=1` is set for that build.

Rehearsal result: the new hook left 94 products at 94.

> ⚠ Uncommitted work in the working tree (not part of this release) rewrites `seed.ts` to publish a "real catalogue" and to delete or archive the demo SKUs. Before this change, it would have run automatically on the next production deploy once committed. Now it runs only with `RUN_PRODUCTION_SEED=1`. Do not set that variable on production without reviewing the seed in that build.

## 6. Migration rehearsal report

**Environment**
- Local PostgreSQL 18.7.
- Scratch database built from production's own migration set (`origin/main`, 5 migrations).
- Loaded with a production-like dataset from the development database: 60 tables, including 94 products with images, 94 inventory rows, 31 stock movements, 4 orders with items, payments and status history, 7 carts, customers, addresses, coupons, roles (166 grants) and the admin audit log.
- `analytics.manage` was removed to match production.

**Migration result**

| Check | Result |
|---|---|
| `migrate status` before | 1 pending (the analytics migration) |
| Apply | Success; 55 ms inside the database (about 5.5 s including the Prisma CLI) |
| Existing data | **All 60 pre-existing tables byte-identical**: row count plus an MD5 of all row contents, compared before and after |
| New objects | `AnalyticsEvent`, `AnalyticsSession`, `AnalyticsSettings`, `AnalyticsJobRun` (empty), 3 enum types, 11 indexes |
| Changes to existing tables | None: no `ALTER`, and no foreign keys between new and existing tables |
| Locks | Only new, empty objects are created, so no lock on existing tables |
| Schema drift | None: `prisma migrate diff` (database vs `schema.prisma`) is empty |
| `migrate status` after | Up to date |
| New build hook (simulated `VERCEL_ENV=production`) | Migration no-op; `analytics.manage` created and granted to Super Admin only; seed skipped. Changed only `Permission` (+1), `RolePermission` (+1) and `Role` (timestamps refreshed, as the old seed did) |
| Old code (`main` Prisma client) on migrated DB | 60/60 models readable; cart write and delete OK |
| New code on migrated DB | Settings row created (24 h threshold); server event stored and duplicate ignored; browser event accepted; demand and abandonment reports OK |
| Rollback SQL | Store tables unchanged; analytics objects removed; `migrate status` shows the migration pending again; re-applying succeeds |

**Not covered by the rehearsal**
- Neon's own PostgreSQL version: the SQL is standard (`CREATE TYPE`/`TABLE`/`INDEX`).
- Production data volume.
- Network latency to Neon.

None of these affect an additive migration on new, empty tables.

## 7. Rollback plan

Choose the smallest level that resolves the problem.

| Level | When | How | Data impact |
|---|---|---|---|
| **L1: code** | Any app problem after step 7 | Vercel → each project → Deployments → the recorded previous production deployment → *Instant Rollback* (`20mart` and `20mart-admin`) | None. The schema stays; old code is compatible (§6). Analytics rows stay inert. |
| **L2: branch** | Right after L1 | `git revert` the release commits on `main` (or reset `main` to `4d71c46` with a force-push, if agreed) so the next push doesn't redeploy the release | None |
| **L3: schema** | Only if the analytics tables themselves must go | After L1, run `docs/release/rollback-analytics-foundation.sql`. It drops the 4 tables and 3 types and deletes the migration's history row in one transaction. | **Destroys all analytics data.** Store data untouched. |
| **L4: restore** | Only for data corruption elsewhere (not expected from this release) | Restore from the Neon backup branch | **Loses every write since the backup**, including orders and payments |

**Limits of rolling back an additive migration**
- **No "down" migration exists** in Prisma. L3 is a hand-written script, verified in the rehearsal.
- **`prisma migrate resolve --rolled-back` doesn't apply.** It only accepts *failed* migrations; a successful one gives error P3012. That's why the script deletes the `_prisma_migrations` row itself.
- **Dropping tables is irreversible.** Events recorded between release and rollback are lost unless the backup branch is used. Re-applying the migration creates empty tables.
- **Some changes are not undone** by L3:
  - The `analytics.manage` permission and its Super Admin grant stay. Old code ignores unknown keys; an optional cleanup is in the script.
  - Shoppers' consent and analytics cookies stay in their browsers. Old code ignores them.
- **Never run L3 while the new code is live.** Old code needs nothing from these tables, but new code expects them. Event writes would fail quietly; the consent and analytics endpoints would return errors.

## 8. Changed files (release preparation)

| File | Change |
|---|---|
| `scripts/vercel-migrate.mjs` | Full seed opt-in (`RUN_PRODUCTION_SEED=1`); permissions sync instead; `SKIP_BUILD_MIGRATIONS=1` kill switch |
| `packages/database/src/sync-rbac.ts` | **New**: access-control-only sync (no catalog data) |
| `docs/release/analytics-phase-a-b.md` | **New**: this plan |
| `docs/release/rollback-analytics-foundation.sql` | **New**: verified L3 rollback |

## 9. Production smoke tests (after step 7)

Use a fresh private/incognito window unless stated. Where money is involved, use the cheapest product. Refund afterwards.

### 9.1 Database checks (Neon SQL editor)
```sql
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 2;
SELECT (SELECT count(*) FROM "AnalyticsEvent") ev, (SELECT count(*) FROM "AnalyticsSession") ses, (SELECT count(*) FROM "AnalyticsSettings") st;
SELECT r.key FROM "RolePermission" rp JOIN "Role" r ON r.id = rp."roleId" JOIN "Permission" p ON p.id = rp."permissionId" WHERE p.key = 'analytics.manage';
-- after the tests below:
SELECT name, category, "userId" IS NOT NULL AS has_user, "visitorId" IS NOT NULL AS has_visitor, "occurredAt"
  FROM "AnalyticsEvent" ORDER BY "occurredAt" DESC LIMIT 30;
```

### 9.2 Consent
1. **Fresh window.** The banner appears, and there are no `/api/analytics/events` requests in DevTools → Network.
2. **Essential only.** The `20m_consent` cookie ends in `.denied`. There is no `20m_vid` cookie, and browsing sends no events.
3. **Allow analytics** (via Privacy choices). APP_OPENED is sent (202) and the `20m_vid` cookie is set.
4. **Withdraw** (Privacy choices → Essential only), then navigate away immediately:
   - The consent request completes.
   - No further events are sent.
   - That visitor's behavioural rows are deleted (§9.1 query).
5. **Brave, or Firefox with GPC on:** nothing is stored, even after "Allow".

### 9.3 Event ingestion
With consent, visit home → a category → a product → a search from the header → the cart. Expect HOME_VIEWED, CATEGORY_VIEWED, PRODUCT_VIEWED, PRODUCT_SEARCHED (once per term) and CART_VIEWED.

### 9.4 Cart
1. Add, change quantity and remove an item: CART_ITEM_ADDED / CART_ITEM_REMOVED with the correct unit deltas.
2. As a guest with no cart, try adding an out-of-stock item twice:
   - The refusal works.
   - No new cart is created.
   - One OUT_OF_STOCK_ADD_ATTEMPT is recorded.

### 9.5 Checkout and payment
1. Open checkout: CHECKOUT_STARTED is recorded, once per cart per day.
2. Place an order with the cheapest enabled method:
   - The order is created, stock decreases, and PURCHASE_COMPLETED is recorded once per line.
   - If paying online with Razorpay: verify, then check that a duplicate webhook doesn't duplicate the purchase. Then refund it in the admin: REFUND_PROCESSED is recorded once.
3. Cancel an order (customer or admin): ORDER_CANCELLED is recorded, with no free-text reason stored.

### 9.6 Admin permissions
1. **Super Admin:** can view and change analytics settings. Products, Bulk import, Inventory and Orders work as before.
2. **Admin role:** can view analytics but changing settings returns 403.
3. **Marketing Manager:** sees unfulfilled demand. **Order Manager:** gets 403.
4. **Roles screen:** existing custom role edits are unchanged.

### 9.7 Regression
- Customer Google sign-in
- Wishlist add
- Delivery PIN check
- Coupon apply
- Order history and tracking
- Next maintenance cron: the `analytics` key is present in its log entry, with no error

## 10. Outstanding risks

| Risk | Severity | Mitigation |
|---|---|---|
| Neon restore has never been tested on this project | Medium | L1–L3 don't need it; take the backup branch anyway |
| Controlled step needs the production direct URL locally | Low | Git-ignored file; delete it after the release |
| Storefront and admin deploy independently | Low (with §4) | Schema first; deploy order no longer matters |
| `fix/price-grid` work could reach `main` first | Medium | Coordinate; re-merge `main` and re-verify if it does |
| Uncommitted destructive seed (§5) | High if run | No longer runs automatically; never set `RUN_PRODUCTION_SEED=1` blindly |
| Consent banner shown to every shopper | Low (UX) | Expected; review copy and design on live |
| Online payment smoke test uses real money | Low | Cheapest item, refunded immediately; or COD only |
| Rehearsal used local PostgreSQL 18, not Neon | Low | Standard SQL; additive only |

## 11. Go / no-go

**Go, once these four conditions are met:**
1. The release-prep changes (§8) are approved and committed. Without the hook change, the merge deploy would re-create the starter drafts.
2. A Neon backup branch exists and the deployment IDs are recorded.
3. The operator has the production direct URL for steps 2–4.
4. Nothing else has been merged into `main` since `4d71c46`.
