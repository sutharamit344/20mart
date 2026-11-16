# Phase 4 – Warehouses, Location-Based Fulfilment & Procurement

Status: **P4-A and P4-B implemented in code** (uncommitted, not deployed). P4-C (stock transfers, advanced analytics) intentionally not built; the schema is ready for it.

## 1. What changed and why

| Area | Before | Now |
|---|---|---|
| Inventory | One row per product/variant | One row per **warehouse** × product/variant, plus `safetyStock`. Sellable = on hand − reserved − safety (never < 0) |
| Delivery areas | `DeliveryZone` + `ServiceablePincode` (reused, not duplicated) | Zones are the delivery areas. New `WarehouseDeliveryZone` maps warehouses ↔ areas (priority, fee/estimate override, cut-off, active) |
| Serviceability | PIN listed = deliverable | PIN serviceable **and** in an active area **and** mapped to an ACTIVE warehouse not at its daily capacity. New result `code`: `OK / INVALID / DISABLED / NOT_SERVICEABLE / PAUSED / NOT_CONFIGURED / AT_CAPACITY` |
| Orders | Stock from the single row | `fulfillment.ts` picks **one** warehouse that can ship the whole cart (priority order). The order records `fulfillmentWarehouseId`. No silent splitting; unavailable items are named |
| Customer location | Fake city dropdown (hard-coded list) | PIN-code picker (header, mobile bar, drawer, product page, cart), optional GPS → PIN through a configured provider, "notify me" for unserved PINs |
| Procurement | — | Suppliers, purchase orders, goods receipts (partial, idempotent, discrepancies). Only confirmed receipts add stock |
| Delivery ops | — | `dispatchedAt` (set at Out for delivery), "Delivery failed" with reason → goods returned to the warehouse's stock, refund request if paid |

Key files: `packages/server/src/fulfillment.ts`, `warehouses.ts`, `procurement.ts`, `geocoding.ts`, `inventory.ts`, `cart.ts`, `orders.ts`, `delivery.ts`; migration `packages/database/prisma/migrations/20261116090000_p4_warehouses`.

## 2. Migration (non-destructive)

- Adds tables/enums/columns only; replaces the two inventory unique indexes with per-warehouse ones.
- Existing stock rows are attached to **one placeholder warehouse `PRIMARY` in `SETUP` status** (PIN `000000`). Nothing is lost, but **SETUP locations never serve customers**, so after deploying, the storefront shows nothing as deliverable until an admin:
  1. edits `PRIMARY` with the real address (activation is refused while it has placeholder details),
  2. activates it,
  3. assigns PIN codes to a delivery area and maps the warehouse to that area.
- Historical orders are back-filled with `fulfillmentWarehouseId = PRIMARY`.
- **Run `pnpm db:seed` after `db:deploy`** in each environment: it syncs the new permissions into roles.
- Applied to the dev database on 2026-11-15. A backup was taken *after* applying (the pre-migration backup command failed because `psql` was not on PATH; the backup script needs `PG_BIN` set on this machine).
- Dev only: `pnpm db:seed:dev-delivery` now also creates the "Ahmedabad (dev)" area and activates `PRIMARY` with a clearly fake dev address so local checkout works.

## 3. New permissions (server-enforced on every route)

`warehouses.view`, `warehouses.manage`, `suppliers.view`, `suppliers.manage`, `purchasing.view`, `purchasing.manage`, `purchasing.receive`. Mapping a warehouse to an area needs `warehouses.manage` **and** `delivery.update`. Existing `inventory.adjust` / `inventory.update` cover adjustments and safety stock. Inventory Manager gains procurement; Order Manager gains `warehouses.view`.
Transfer/analytics permissions were **not** added: they would control nothing yet.

## 4. Configuration

- `GEOCODING_PROVIDER` = `google` (+ `GOOGLE_MAPS_API_KEY`) or `nominatim` (+ `GEOCODING_CONTACT`). Unset = GPS button hidden; manual PIN entry always works. Coordinates are used for one lookup and never stored.
- Storefront `Permissions-Policy` changed from `geolocation=()` to `geolocation=(self)` (it previously blocked the browser API).
- New cookie `20m_pin` (not HttpOnly, holds only the PIN; re-validated server-side on every use).

## 5. Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Create/manage fulfilment locations | Done | Admin › Warehouses; test "locations cannot be activated with placeholder details" |
| 2 | Inventory per warehouse | Done | Admin › Inventory (warehouse filter/column, Add stock); same test |
| 3 | Availability by warehouse | Done | `productStockState` = best single warehouse; test "safety stock…" |
| 4–5 | Areas by PIN, map warehouses | Done | Delivery & Payments + Warehouses › Delivery areas served |
| 6, 8 | Manual PIN, change location | Done | Location picker (header/mobile/PDP/cart) |
| 7 | GPS after permission | Done in code, **not live-tested** (no provider key configured) | `geocoding.ts`, `/api/location/reverse` |
| 9 | Serviceable vs not | Done | test "serviceable PIN without an active mapped warehouse…" |
| 10 | Products show location availability | Done | `/api/availability` → product cards & PDP; cart/checkout evaluated server-side |
| 11–12 | Eligible warehouse chosen, order assigned | Done | test "ships the whole order from the highest-priority warehouse…" |
| 13–14 | Reservations/releases, no oversell | Done | existing P1 tests + race test; safety stock in the reservation guard |
| 15 | Receiving only after confirmation | Done | test "ordering never changes stock…" |
| 16 | Audit trail | Done | `StockMovement` (incl. `PURCHASE_RECEIPT`) + `AdminAuditLog` (WAREHOUSE / PROCUREMENT) |
| 17 | Server-side RBAC | Done | test "permissions are enforced…" |
| 18 | Existing features keep working | Server suite green (150/150). **E2E updated but not re-run**; manual UI pass still needed |
| 19 | Mobile & desktop | Built responsive; **not visually verified in a browser yet** |
| 20 | No promise without config | Done | estimates only from configured mapping/area/store values; PDP's hard-coded "Delivery within 24 hours" removed |

## 6. Known limits / follow-ups

- Catalog pages stay cached (ISR) and location-agnostic; location availability is applied client-side after load (a brief flicker on cards is possible). Cart, checkout and order placement always validate on the server.
- Daily capacity is a soft cap (checked at selection, not locked), so a burst can exceed it by a few orders.
- Product cards show "Out of stock" for items not deliverable at the chosen PIN (shared card component); the PDP and cart use explicit "not available for your location" wording.
- P4-C deferred: stock transfers (enum values `TRANSFER_OUT/IN` reserved), warehouse analytics, multi-warehouse splitting.
- To do before go-live: run E2E against a scratch DB, a manual mobile/desktop pass, configure the real warehouse + areas, decide on a geocoding provider.
