# 20Mart – Complete E-commerce Platform & Admin

> **Your Everyday Value Market** – Curated household, kitchenware, cleaning supplies, and daily utility essentials with doorstep delivery in Ahmedabad.

---

## 🏗️ Architecture & Monorepo Structure

Built with **Turborepo** and **pnpm workspaces**:

```
20mart/
├── apps/
│   ├── 20mart/            # Storefront (Next.js 14 App Router, Tailwind CSS, Responsive Desktop & Mobile)
│   └── 20martadmin/       # Administrative Application (Next.js 14 App Router, Full Business Engine)
│
├── packages/
│   ├── ui/                # Centralized Design System (Buttons, Inputs, Cards, Badges, Modals, Tables)
│   ├── shared/            # Types, Zod Schemas, Configurations, and Real Mock Datasets
│   ├── config/            # Shared Tailwind Tokens & TypeScript Presets
│   ├── database/          # Prisma schema, migrations, seeds
│   └── server/            # Server-only services: auth, RBAC, catalog, inventory, storage (+ tests)
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

---

## 🎨 Visual Identity & Reference Fidelity

- **Primary Action Color**: Orange (`#F95700`)
- **Primary Brand Color**: Dark Green (`#0B5643` / `#073D2F`)
- **Neutral Surfaces**: Clean White (`#FFFFFF`) & Soft Light Gray (`#F8F9FA`)
- **Distinctive Logo**: Arched shopping bag motif with orange "20" and dark green "Mart"

### Storefront Pages Implemented (All 19 Desktop & 14 Mobile screens)
1. **Homepage** (`/`) – Hero banner with basket, 4 value pillars, shop by category circular icons, trending products, daily deals under ₹50, early access campaign.
2. **Shop – All Products** (`/shop`) – Multi-facet category & price filters, rating filter, popular sort, pagination.
3. **Category Detail** (`/category/[slug]`) – Category banner, sub-category pills, product grid.
4. **Product Details** (`/product/[slug]`) – Multi-image gallery, rating (4.6 stars, 328 reviews), quantity stepper, Add to Cart, Wishlist toggle, similar items.
5. **My Wishlist** (`/wishlist`) – Item cards, move all to cart, delete.
6. **Shopping Cart** (`/cart`) – Stepper quantities, Free Delivery tracker (> ₹199), coupon drawer, order breakdown.
7. **Checkout** (`/checkout`) – 3-step progress (Address -> Delivery -> Payment), address modal, delivery method selection, UPI/Card/COD.
8. **Order Success** (`/order-success`) – Bag celebration illustration with green checkmark, Order ID, delivery date, track order action.
9. **My Orders** (`/account/orders`) – Order cards with status pills (Processing, Out for Delivery, Delivered).
10. **Order Tracking Details** (`/account/orders/[id]`) – 4-step timeline tracker with dates & checkmarks.
11. **My Profile** (`/account`) – User profile card with initials "AK", verified phone & email badges, edit profile.
12. **Login / Register** (`/auth`) – Indian mobile +91 input, OTP verification modal with instant demo code.
13. **Coupons & Rewards** (`/coupons`) – Reward wallet, ₹50 Launch coupon (`WELCOME50`), ₹50 survey coupon (`SURVEY50`).
14. **Product Interest Survey** (`/survey`) – 3-question survey unlocking ₹50 bonus coupon.
15. **About 20Mart** (`/about`) – Brand story, core pillars, early access banner.
16. **Contact Us** (`/contact`) – Support form, email, phone, Ahmedabad location.
17. **FAQs** (`/faqs`) – Frequently asked questions accordions.
18. **Terms & Privacy** (`/terms`) – Legal policies.

### 20MartAdmin Management Portal
- **Dashboard** (`/`) – Gross revenue, total orders, active customers, active coupons, weekly sales bar chart, low stock alerts, recent orders table.
- **Product Management** (`/products`) – Product catalog table, Add Product modal with validation, Edit Product modal, delete.
- **Inventory Management** (`/inventory`) – Stock levels, low stock warnings, Stock Adjustment modal (+ / -) with reason logging.
- **Orders & Fulfillment** (`/orders`) – Order list with status filters, detailed inspection drawer, status updates.
- **Customer Directory** (`/customers`) – Customer directory, lifetime spend, order count, account suspension.
- **Coupon Engine** (`/coupons`) – Create coupon vouchers, min order rules, toggle status.
- **Product Questions** (`/questions`) – Survey questions bank, options, completion analytics.
- **Promotions & Banners** (`/promotions`) – Hero banner scheduler, daily deals manager.
- **11 Business Configuration Modules** (`/configurations`) –
  1. General Settings
  2. Shopping Settings
  3. Product Settings
  4. Coupon Settings
  5. Question Settings
  6. Reward Settings
  7. Delivery Settings
  8. Payment Settings
  9. Notification Settings
  10. Feature Flags
  11. Platform Settings
  *With floating unsaved changes notification bar, history log, and discard/save actions.*
- **Access & RBAC** (`/access`) – Role permissions matrix (Super Admin, Operations, Catalog Manager, Support Agent), user switcher.
- **Audit Logs** (`/audit`) – Activity trail by admin staff.

---

## 🚀 Local Development

### Prerequisites
- Node.js 22+, pnpm 12
- PostgreSQL 16+ (developed against 18)

### 1. Database
Create a least-privilege role and two databases (dev + a disposable test DB):

```sql
CREATE ROLE twentymart_app LOGIN CREATEDB PASSWORD '<strong-password>';  -- CREATEDB only for Prisma's dev shadow DB
CREATE DATABASE twentymart_dev  OWNER twentymart_app;
CREATE DATABASE twentymart_test OWNER twentymart_app;
```

### 2. Environment
Copy `.env.example` into the four (git-ignored) locations it lists and fill in values:
`packages/database/.env`, `apps/20mart/.env.local`, `apps/20martadmin/.env.local`, `packages/server/.env.test`.

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | all | `packages/server/.env.test` must point at the **test** DB |
| `AUTH_SECRET` | both apps | ≥ 32 random chars; signs the OAuth state cookie |
| `APP_URL`, `ADMIN_APP_URL` | both apps | Public origins; used for OAuth redirect + CSRF origin checks |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | storefront | Customer Google sign-in |
| `REVALIDATE_SECRET` | both apps | Admin → storefront cache refresh |
| `STORAGE_DRIVER` | both apps | `local` (dev) or `s3` (AWS S3 / Cloudflare R2) |
| `STORAGE_LOCAL_DIR`, `STORAGE_PUBLIC_BASE_URL` | both apps | Local uploads are served by the storefront at `/media/*` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | both apps | Only when `STORAGE_DRIVER=s3` |
| `INITIAL_ADMIN_USERNAME/EMAIL/PASSWORD` | bootstrap script | One-time use; remove the password afterwards |

### 3. Install, migrate, seed
```bash
pnpm install
pnpm --filter @20mart/database db:deploy     # apply migrations (non-destructive)
pnpm --filter @20mart/database db:seed       # permissions, roles, 4 categories, price points (idempotent)
pnpm --filter @20mart/database db:seed:demo  # OPTIONAL, dev only: 9 draft demo products with 0 stock
```

### 4. Create the first Super Admin
```bash
INITIAL_ADMIN_USERNAME=owner INITIAL_ADMIN_EMAIL=owner@example.com INITIAL_ADMIN_PASSWORD='<12+ chars>' \
  pnpm --filter @20mart/server admin:bootstrap
```
- Works only while **no** Super Admin exists; later runs refuse (exit code 2). Further admins are created in the admin UI (**Access management**).
- The password is never printed. Remove `INITIAL_ADMIN_PASSWORD` from your shell/env afterwards.
- **Recovery** (forgotten password / locked out): `INITIAL_ADMIN_PASSWORD='<new>' pnpm --filter @20mart/server admin:bootstrap --recover <username>` resets the password, reactivates the account and revokes its sessions.

### 5. Run
```bash
pnpm dev:store   # Storefront   http://localhost:3000
pnpm dev:admin   # Admin portal http://localhost:3001  (sign in at /login)
pnpm --filter @20mart/server test   # test suite (uses the test DB only)
pnpm build                           # production build of both apps
```

---

## 🛒 Shopping, orders & payments (P1)

- **Cart:** server-side and DB-backed for customers, with guest carts behind an HttpOnly `20m_cart` cookie merged on sign-in. Every read is re-priced and stock-checked on the server.
- **Checkout:** totals are computed only on the server. Orders are placed in one transaction that reserves stock per line (no overselling) and is idempotent per checkout attempt.
- **Delivery:** only PIN codes listed as serviceable in **Admin → Delivery & Payments** can order. The fee, free-delivery threshold, minimum order, estimate hours and operating hours are configured there.
- **Payments:** COD and online are both **off** by default.
  - Dev: `pnpm --filter @20mart/database db:seed:dev-delivery` enables COD and adds Ahmedabad PIN codes (dev only).
  - Razorpay: set the env vars above, add the webhook URL in the Razorpay dashboard, then enable it in admin. Payments are confirmed only after signature + provider fetch + amount checks (or a signed webhook).
- **Stock:** reserved at placement, committed when an order is confirmed (COD) or paid (online), and released or restocked on cancellation or expiry.
  - Abandoned online payments expire after the configured window via `POST /api/cron/expire-reservations` (header `x-cron-secret`). This also runs opportunistically.
- **Refunds:** cancelling a paid order creates a refund request. Admins with `orders.refund` initiate it with the provider (or record a cash refund reference). It shows as completed only after provider confirmation.

## 🔐 Google OAuth setup (customers)

1. Google Cloud Console → **APIs & Services → OAuth consent screen**: External, app name "20Mart", scopes `openid`, `email`, `profile`.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorised JavaScript origins: `http://localhost:3000` and your production storefront origin.
   - Authorised redirect URIs: `http://localhost:3000/api/auth/google/callback` and `https://<your-domain>/api/auth/google/callback`.
3. Put the client ID/secret into `apps/20mart/.env.local` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) and restart the storefront.

Customers are identified by Google's stable subject id (`sub`); only verified emails are accepted and accounts are never merged by email. Admins **never** use Google — they sign in with username/email + password on the admin app.

---

## 🗄️ Database (Prisma & PostgreSQL)

- Schema: `packages/database/prisma/schema.prisma`; all money is **integer paise** (₹20 = 2000).
- Constraints Prisma can't express (non-negative stock, price ≤ MRP, one primary image, one inventory row per product/variant) live in the migration SQL.
- **Development:** `pnpm --filter @20mart/database db:migrate` (creates new migrations).
- **Production:** only ever run `pnpm --filter @20mart/database db:deploy` (= `prisma migrate deploy`). Never run `migrate reset` or `db push` against a database with real data.
- Check state with `pnpm --filter @20mart/database db:status`.

## 🛡️ Security model (summary)
- Separate customer (`20m_session`, SameSite=Lax) and admin (`20m_admin`, SameSite=Strict) sessions; only SHA-256 hashes of tokens are stored; `__Host-` + Secure cookies over HTTPS.
- Every admin API verifies origin (CSRF), session, ACTIVE account and the required permission on the server; roles/permissions are DB-managed (`Role`, `Permission`, `RolePermission`, `AdminUserRole`).
- Admin passwords: Argon2id; generic login errors; per-identifier/IP throttling with lockout; session rotation; 12 h absolute / 2 h idle expiry; deactivation revokes sessions immediately.
- Uploads: magic-byte type check (JPEG/PNG/WebP/AVIF), 5 MB limit, dimension limits, random keys; DB rows are written only after storage confirms.
- Inventory: every change is a `StockMovement` + audit log entry inside one transaction; atomic conditional updates and a DB CHECK prevent negative stock.
