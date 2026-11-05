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
│   └── database/          # Prisma ORM & PostgreSQL Schema (26 modular relational models)
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

```bash
# 1. Install all monorepo dependencies
pnpm install

# 2. Generate Prisma Client
pnpm db:generate

# 3. Start both applications simultaneously
pnpm dev

# Or run applications individually:
pnpm dev:store   # Storefront on http://localhost:3000
pnpm dev:admin   # Admin Portal on http://localhost:3001
```

---

## 🗄️ Database Integration (Prisma & PostgreSQL)

The schema in `packages/database/prisma/schema.prisma` includes all 26 relational entities:
- `Customer`, `Address`
- `Category`, `Brand`, `Product`, `ProductVariant`
- `Inventory`, `InventoryMovement`
- `Cart`, `CartItem`
- `Order`, `OrderItem`, `Payment`
- `Coupon`, `CouponRule`, `CouponRedemption`
- `Question`, `QuestionOption`, `QuestionResponse`
- `AdminUser`, `AdminRole`, `AdminPermission`, `AdminAuditLog`
- `SystemSettings`, `BusinessConfigurations`, `ConfigurationHistory`

