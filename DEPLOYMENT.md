# 20Mart — Deployment & Operations Runbook

Two Next.js apps share one PostgreSQL database:

| App | Package | Port (`next start`) | Public origin (example) |
|---|---|---|---|
| Storefront | `@20mart/storefront` (`apps/20mart`) | 3000 | `https://shop.example.in` |
| Admin | `@20mart/admin` (`apps/20martadmin`) | 3001 | `https://admin.example.in` |

The admin **must** be served from a different origin than the storefront (separate cookies, stricter CSP, `noindex`).

---

## 1. Environments

| | Development | Staging | Production |
|---|---|---|---|
| Purpose | Local work | Release candidate, real integrations in test mode | Real customers |
| Database | `twentymart_dev` (local) | Separate server/DB, **restored from a recent production backup** (PII-scrubbed if shared) | Managed PostgreSQL 16+, automated backups + PITR |
| Migrations | `db:migrate` (creates migrations) | `db:deploy` only | `db:deploy` only, after a fresh backup |
| `NODE_ENV` | development | production | production |
| Origins | `http://localhost:3000/3001` | `https://staging-shop…`, `https://staging-admin…` | `https://shop…`, `https://admin…` |
| Google OAuth | Test client, `http://localhost:3000/api/auth/google/callback` | Separate client or extra redirect URI | Production client, verified consent screen |
| Razorpay | Test keys (`rzp_test_…`) | Test keys | Live keys (`rzp_live_…`) |
| Email (Resend) | Off, or a test domain | Verified staging sender | Verified production domain (SPF/DKIM) |
| Storage | `local` | `s3` (own bucket) | `s3`/R2 + CDN (own bucket) |
| Monitoring | Logs only | `SENTRY_DSN` (`SENTRY_ENVIRONMENT=staging`) | `SENTRY_DSN` (`SENTRY_ENVIRONMENT=production`) |
| Secrets | `.env.local` files (git-ignored) | Platform secret store | Platform secret store; never in files or the repo |

Never point staging or development at the production database. Every secret (`AUTH_SECRET`, `CRON_SECRET`, `REVALIDATE_SECRET`, webhook secrets) is **different per environment**.

---

## 2. Production environment variables

All variables are listed with comments in [`.env.example`](.env.example). Production specifics:

- `DATABASE_URL` — least-privilege role (not `postgres`), TLS and an explicit pool size:
  `postgresql://twentymart_app:<pw>@<host>:5432/twentymart?schema=public&sslmode=require&connection_limit=5&pool_timeout=20`
  - Pool sizing: `instances × connection_limit × 2 apps` must stay well below `max_connections` (leave room for migrations, backups and psql).
  - Serverless or many instances: put PgBouncer (transaction mode) in front, add `&pgbouncer=true`, and use a direct (non-pooled) URL for `prisma migrate deploy`.
- **Database time zone must be UTC.** All columns are `timestamp(3)` holding UTC. The app forces `TimeZone=UTC` per session, except behind PgBouncer, which rejects startup options. Behind a pooler, run once:
  ```sql
  ALTER ROLE twentymart_app SET timezone = 'UTC';
  ```
  `GET /api/health` (detailed) reports `sessionTimeZone` and flags anything other than UTC as an error.
- `AUTH_SECRET`, `CRON_SECRET`, `REVALIDATE_SECRET`: 32+ random bytes each, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
- `APP_URL`, `ADMIN_APP_URL`: exact `https://` origins (no trailing path). They drive the OAuth redirect URI, CSRF origin checks, canonical URLs, the sitemap, HSTS and `__Host-` Secure cookies.
- `STORAGE_DRIVER=s3` with `S3_*`, and `STORAGE_PUBLIC_BASE_URL` = the **https** CDN/bucket URL that serves images. Local storage needs a persistent disk shared by every instance.
- `TRUST_PROXY_HOPS` / `CLIENT_IP_HEADER`: how the real client IP reaches the app. It's used for rate limits and audit logs.
  - One nginx/ALB in front: `TRUST_PROXY_HOPS=1` (default).
  - Cloudflare: `CLIENT_IP_HEADER=cf-connecting-ip`.
  - Vercel: nothing (it provides `req.ip`).
- Set `SERVICE_NAME` (`storefront` / `admin`) and `APP_RELEASE` (git SHA) on each app.

Check a running deployment's configuration (booleans and warnings only, never values):
```bash
curl -s -H "x-health-secret: $CRON_SECRET" https://shop.example.in/api/health | jq .
```

---

## 3. Build & release

```bash
pnpm install --frozen-lockfile
pnpm --filter @20mart/database db:generate
pnpm build                      # both apps (turbo)
# run
pnpm --filter @20mart/storefront start   # :3000
pnpm --filter @20mart/admin start        # :3001
```

- Node.js 22, behind a TLS-terminating reverse proxy or platform. Redirect `http → https` at the proxy.
- `sharp` is a dependency of both apps and is required for production image optimisation.
  - Without it, Next.js falls back to a slow WASM encoder and images can stall for seconds under load.
  - Install on the target OS/arch (`pnpm install` on the server or in the Docker image, not copied `node_modules` from Windows/macOS).
  - The startup log must not show `sharp-missing-in-production`.
  - Persist or warm `.next/cache/images` across deploys where possible.
- `NEXT_DIST_DIR=.next-prod` lets you build next to a running `next dev` without clobbering it.
- The admin needs `experimental.serverActions.bodySizeLimit` 6 MB and the proxy must allow 6 MB request bodies (image uploads).

### Release order (zero data loss)
1. **Backup** production (section 6) and keep the file until the release is verified.
2. `pnpm --filter @20mart/database db:status`: review pending migrations. Read their SQL. Anything destructive (drop/rename column, type change) must be split into expand → migrate data → contract releases.
3. `DATABASE_URL=<direct url> pnpm --filter @20mart/database db:deploy` (= `prisma migrate deploy`; never `migrate reset`, `migrate dev` or `db push` against shared data).
4. Deploy the storefront, then the admin.
5. Run the verification (section 8). If it fails, roll back the app version. Roll back the schema only with a reviewed down-migration, or by restoring the pre-release backup after approval.

`db:seed` is idempotent and safe to re-run (permissions, roles, base categories and starter coupons only if missing). `db:seed:dev-delivery` refuses to run in production.

---

## 4. External integrations

| Integration | Configure | Verify |
|---|---|---|
| **Google OAuth** | Authorised origin `https://shop…`. Redirect URI `https://shop…/api/auth/google/callback`. Consent screen published. | `GET /api/auth/google` redirects to Google with `code_challenge_method=S256`, then sign in with a real account. |
| **Razorpay** | `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`. Webhook `https://shop…/api/payments/razorpay/webhook` for `payment.captured, payment.failed, order.paid, refund.processed, refund.failed`. Enable *Online* in Admin → Delivery & Payments. | Test-mode payment end to end, a failed payment, and a refund. Check the webhook delivery log in Razorpay shows 200. |
| **Resend** | `RESEND_API_KEY`, `EMAIL_FROM` on a verified domain (SPF + DKIM). Webhook `https://shop…/api/email/resend/webhook` for `email.delivered, email.bounced, email.complained` → `RESEND_WEBHOOK_SECRET`. | Admin → Notifications shows *Sent*, then *Delivered*. |
| **Image storage** | S3/R2 bucket with public read on the image path (or a CDN in front), CORS not needed. | Upload an image in admin, then check it loads on the product page. |
| **Monitoring** | `SENTRY_DSN` (or `MONITORING_WEBHOOK_URL`) | Section 7 |

Card data never touches 20Mart: Razorpay Checkout collects it in its own iframe. The server stores only provider order, payment and refund ids.

---

## 5. Scheduled jobs

All are `POST` with header `x-cron-secret: $CRON_SECRET` (use your platform scheduler, a cron container, or GitHub Actions):

| Schedule | Endpoint | Purpose |
|---|---|---|
| every 5 min | `/api/cron/expire-reservations` | Fail unpaid online orders after the payment window; release reserved stock and coupon uses |
| every 5 min | `/api/cron/notifications` | Send queued emails, retry transient failures |
| daily 03:15 | `/api/cron/maintenance` | Purge expired customer and admin sessions, login-throttle rows older than 30 days, and guest carts idle for 30+ days |
| daily (DB host) | `scripts/db/backup.mjs` | Logical backup (section 6) |

A failed job returns HTTP 500 with a `reference` id and is reported to monitoring.

---

## 6. Backup & recovery

**Layers**
1. **Managed provider snapshots + point-in-time recovery** (RDS, Cloud SQL, Neon, Supabase…): enable 7–35 days PITR. This is the primary recovery path.
2. **Daily logical backup** (portable, provider-independent):
   ```bash
   PG_BIN=/usr/lib/postgresql/16/bin node --env-file=/etc/20mart/backup.env scripts/db/backup.mjs --out /var/backups/20mart --keep-days 14 --keep-min 7
   ```
   - Writes `20mart-<db>-<timestamp>.dump` (pg_dump custom format, compressed) plus a `.json` manifest: SHA-256, per-table row counts and applied migrations. It confirms the archive is readable and prunes old files.
   - Read-only against the database. The password is passed via `PGPASSWORD`, never on the command line.
3. **Off-site copy**: upload each dump and manifest to a separate, private, encrypted bucket in a different account or region, with object lock or versioning (e.g. `aws s3 cp --sse AES256`). Keep 30 daily + 12 monthly copies. Restrict read access to on-call owners.

**Before every migration**, take an on-demand backup (logical dump or provider snapshot) and record its file name in the release notes.

**Restore drill (monthly, and after any backup change)**: always into a NEW database, never over production.
```bash
node --env-file=packages/database/.env scripts/db/restore-verify.mjs --file <dump> --target twentymart_restore_check [--keep]
```
The script:
- refuses to target the source database or an existing database, and refuses `NODE_ENV=production` unless `ALLOW_PRODUCTION_RESTORE=yes`;
- verifies the archive checksum;
- restores with `--exit-on-error`;
- compares every table's row count and the migration list with the manifest;
- checks business invariants: non-negative stock, `total = subtotal + delivery − discount + tax`, `subtotal = Σ items`, coupon `usedCount` = applied redemptions, orders → users FK.

The scratch DB is dropped afterwards unless `--keep`.

**Real recovery (production incident)** needs explicit approval from the owner:
1. Stop writes: put both apps in maintenance (scale to 0 or proxy 503), and pause cron jobs.
2. Prefer provider PITR to a timestamp just before the incident, into a **new** instance.
3. Otherwise restore the latest good dump into a new DB with `restore-verify.mjs --keep`.
4. Point `DATABASE_URL` at the restored DB, run `db:status` and `/api/health`, then verify (section 8).
5. Reconcile payments made after the restore point with the Razorpay dashboard: webhooks are idempotent and can be re-sent from Razorpay.

Recovery objectives with the above: **RPO** ≤ 5 min with PITR (24 h with dumps only); **RTO** about 30–60 min.

---

## 7. Monitoring & logging

- Every server log line is JSON (`ts, level, event, service, env, category, …`) on stdout/stderr. Ship them with your platform's log drain.
- Categories: `api, db, auth, payment, order, webhook, notification, cron, perf, storage`.
- Errors (`level=error`) go to Sentry (envelope API, no SDK) and/or `MONITORING_WEBHOOK_URL`. Forwarding is fire-and-forget with a 3 s timeout.
- 5xx API responses include `error.reference`, the event id to search for.
- Logged as warnings:
  - `*.denied`: 401/403/429, bad webhook signatures, CSRF blocks;
  - `auth.google_signin_rejected`;
  - `perf.slow_request`: API requests slower than `SLOW_REQUEST_MS`.
- Business rejections (out of stock, invalid coupon, payment not captured) are `info` events (`order.rejected`, `payment.rejected`).
- **Never logged:** passwords, session tokens, cookies, authorization headers, signatures, API keys and card fields (removed by key). E-mail addresses and Indian phone numbers inside messages are masked (`a***@domain`, `******3210`). Request bodies are never logged.
- Suggested alerts:
  - any `level=error` with `category` in `payment|webhook|order|db`;
  - more than 20 `auth.denied` per minute;
  - `/api/health` non-200 for 2 minutes;
  - `perf.slow_request` more than 10 per minute.
- Uptime monitor: `GET https://shop…/api/health` and `GET https://admin…/api/health`. They return 200 only when PostgreSQL answers.

---

## 8. Post-deployment verification

```bash
node scripts/verify-deployment.mjs --store https://shop.example.in --admin https://admin.example.in \
  --health-secret "$CRON_SECRET" --admin-user <ops-admin> --admin-pass '<password>'
```
It checks:
- TLS validity and expiry, http→https redirect;
- CSP, HSTS, `nosniff` and frame headers; admin `noindex`;
- health, DB time zone, failed migrations and production config errors;
- `robots.txt` and `sitemap.xml` (no private URLs); Product/Organization JSON-LD with no ratings; product image delivery;
- catalog and cart APIs; CSRF block; `/account` and order API require sign-in;
- Google OAuth redirect with PKCE; unsigned webhook rejected;
- admin login, cookie flags, dashboard API, and server-side logout.

Then manually (cannot be automated safely):
- [ ] Sign in with a real Google account → profile → sign out.
- [ ] Place a COD order to a serviceable PIN → admin moves it to Delivered → the customer sees the timeline.
- [ ] (Online enabled) Razorpay test-mode payment → order Confirmed; a failed payment → retry; refund from admin → *Processed* after the webhook.
- [ ] (Email enabled) Order email arrives; Admin → Notifications shows *Delivered*.
- [ ] Sentry receives events: on **staging**, stop the database briefly and call `GET /api/health` (a `db.health_check_failed` event must appear), or use Sentry's "Send test event" for the project.
- [ ] Backup job ran and the off-site copy exists.

---

## 9. Local production-mode testing

```bash
# Separate build dir so it does not disturb `pnpm dev`
NEXT_DIST_DIR=.next-prod pnpm --filter @20mart/storefront build && NEXT_DIST_DIR=.next-prod pnpm --filter @20mart/storefront exec next start -p 3100
# Scratch copy of the dev DB for destructive tests
node --env-file=packages/database/.env scripts/db/restore-verify.mjs --file <dump> --target twentymart_p3_scratch --keep
DATABASE_URL=<scratch url> node scripts/perf/seed-load.mjs        # synthetic load data (scratch/perf DBs only)
DATABASE_URL=<scratch url> STORE=http://localhost:3100 ADMIN=http://localhost:3101 ADMIN_USER=… ADMIN_PASS=… node scripts/e2e/run.mjs
STORE=… ADMIN=… ADMIN_USER=… ADMIN_PASS=… node scripts/perf/measure.mjs --runs 15
```
