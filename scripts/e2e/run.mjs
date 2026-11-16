#!/usr/bin/env node
/**
 * End-to-end business workflow test against RUNNING production builds (HTTP only, real route handlers).
 *
 *   DATABASE_URL=<scratch db> STORE=http://localhost:3100 ADMIN=http://localhost:3101 \
 *   ADMIN_USER=... ADMIN_PASS=... node scripts/e2e/run.mjs
 *
 * Refuses to run unless DATABASE_URL names a scratch/e2e/test database: it creates products, orders
 * and customers. Google sign-in cannot be automated against Google itself, so customer sessions are
 * created the same way the OAuth callback creates them (hashed token row) and the OAuth start/callback
 * checks are exercised separately (redirect, PKCE, forged-state rejection).
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { parseDbUrl, psql } from '../db/lib.mjs';

const STORE = process.env.STORE || 'http://localhost:3100';
const ADMIN = process.env.ADMIN || 'http://localhost:3101';
const conn = parseDbUrl(process.env.DATABASE_URL);
if (!/(scratch|e2e|test)/.test(conn.database)) {
  console.error(`Refusing: ${conn.database} is not a scratch/e2e/test database`);
  process.exit(2);
}
const RUN = randomBytes(3).toString('hex').toUpperCase();
const results = [];
let currentGroup = '';
const group = (g) => (currentGroup = g);
function check(name, ok, detail = '') {
  results.push({ group: currentGroup, name, ok: !!ok, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  if (!ok) console.log(`  ✘ ${currentGroup} › ${name} ${detail ? '— ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300) : ''}`);
}
const sql = (q) => psql(conn, q);
const esc = (s) => String(s).replace(/'/g, "''");

/* ─────────────── HTTP helpers ─────────────── */
async function call(base, path, { method = 'GET', body, cookie, origin = base, form } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (origin && method !== 'GET') headers.origin = origin;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + path, { method, headers, body: payload, redirect: 'manual' });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}
  return { status: res.status, data, headers: res.headers, text };
}
const store = (p, o) => call(STORE, p, o);
const admin = (p, o) => call(ADMIN, p, { ...o, cookie: o?.cookie ?? adminCookie });

/* ─────────────── fixtures ─────────────── */
function png(w, h) {
  const crc = (buf) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([255, 122, 0], y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** A Google-identified customer + live session, created exactly as the OAuth callback does. */
function customer(label) {
  const id = randomUUID();
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  sql(`INSERT INTO "User" ("id","name","email","emailVerified","googleSubjectId","status","createdAt","updatedAt")
       VALUES ('${id}','E2E ${label}','e2e-${label.toLowerCase()}-${RUN.toLowerCase()}@example.com',now(),'e2e-${label}-${RUN}','ACTIVE',now(),now());
       INSERT INTO "CustomerProfile" ("id","userId","updatedAt") VALUES (gen_random_uuid(),'${id}',now());
       INSERT INTO "UserSession" ("id","tokenHash","userId","expiresAt","lastSeenAt","createdAt")
       VALUES (gen_random_uuid(),'${hash}','${id}',(now() AT TIME ZONE 'UTC') + interval '1 day',(now() AT TIME ZONE 'UTC'),(now() AT TIME ZONE 'UTC'));`);
  // Production builds always use the __Host- prefixed name; dev uses the plain one. Send both.
  return { id, token, cookie: `__Host-20m_session=${token}; 20m_session=${token}` };
}

let adminCookie = '';

async function main() {
  const t0 = Date.now();
  // Store configuration for the run: COD + delivery on, a serviceable PIN.
  sql(`UPDATE "StoreSettings" SET "codEnabled" = true, "deliveryEnabled" = true WHERE "id" = 'default';
       INSERT INTO "ServiceablePincode" ("id","pincode","area","city","isServiceable","createdAt","updatedAt")
       VALUES (gen_random_uuid(),'380015','Satellite','Ahmedabad',true,now(),now()) ON CONFLICT ("pincode") DO UPDATE SET "isServiceable" = true;`);

  /* ══════════════════ ADMIN ══════════════════ */
  group('admin');
  const bad = await call(ADMIN, '/api/admin/auth/login', { method: 'POST', body: { identifier: process.env.ADMIN_USER, password: 'wrong-password-123' } });
  check('wrong password → generic 401', bad.status === 401 && bad.data?.error?.code === 'INVALID_CREDENTIALS', bad.status);
  const login = await call(ADMIN, '/api/admin/auth/login', { method: 'POST', body: { identifier: process.env.ADMIN_USER, password: process.env.ADMIN_PASS } });
  const setCookie = login.headers.getSetCookie().find((c) => c.includes('20m_admin=')) || '';
  adminCookie = setCookie.split(';')[0];
  check('1. password login', login.status === 200 && !!adminCookie, login.status);
  check('   admin cookie HttpOnly + SameSite=Strict', /HttpOnly/i.test(setCookie) && /SameSite=Strict/i.test(setCookie), setCookie.replace(/=([^;]{6})[^;]*/, '=$1…'));

  const dash = await admin('/api/admin/dashboard');
  check('2. dashboard', dash.status === 200 && typeof dash.data?.totalProducts === 'number', dash.status);

  const cats = await admin('/api/admin/categories?pageSize=50');
  const category = (cats.data?.items ?? []).find((c) => c.status === 'ACTIVE');
  const sku = `E2E-${RUN}`;
  const created = await admin('/api/admin/products', {
    method: 'POST',
    body: { name: `E2E Steel Tumbler ${RUN}`, sku, categoryId: category?.id, sellingPricePaise: 5900, mrpPaise: 6900, shortDescription: 'E2E test product' },
  });
  const productId = created.data?.id;
  check('3. create product', created.status === 201 && !!productId, created.data?.error ?? created.status);

  const fd = new FormData();
  fd.append('file', new Blob([png(400, 400)], { type: 'image/png' }), 'p.png');
  fd.append('altText', `E2E Steel Tumbler ${RUN}`);
  const img = await admin(`/api/admin/products/${productId}/images`, { method: 'POST', form: fd });
  check('   upload product image (magic-byte validated)', img.status === 201, img.data?.error ?? img.status);
  const evil = new FormData();
  evil.append('file', new Blob([Buffer.from('<svg onload=alert(1)>')], { type: 'image/png' }), 'x.png');
  const evilUp = await admin(`/api/admin/products/${productId}/images`, { method: 'POST', form: evil });
  check('   non-image upload disguised as PNG rejected', evilUp.status === 400, evilUp.status);

  const upd = await admin(`/api/admin/products/${productId}`, { method: 'PATCH', body: { name: `E2E Steel Tumbler ${RUN} 500ml` } });
  check('4. update product', upd.status === 200, upd.data?.error ?? upd.status);
  const pub = await admin(`/api/admin/products/${productId}/status`, { method: 'POST', body: { status: 'ACTIVE' } });
  check('   publish product', pub.status === 200, pub.data?.error ?? pub.status);

  // P4: a real fulfilment location serving 380015 through a delivery area.
  const whCode = `E2E-${RUN}`.slice(0, 20);
  const wh = await admin('/api/admin/warehouses', {
    method: 'POST',
    body: { name: `E2E location ${RUN}`, code: whCode, addressLine1: '1 E2E Road, Satellite', city: 'Ahmedabad', state: 'Gujarat', pinCode: '380015' },
  });
  check('4a. create warehouse (starts in setup)', wh.status === 201 && wh.data?.status === 'SETUP', wh.data?.error ?? wh.status);
  const whId = wh.data?.id;
  const zone = await admin('/api/admin/delivery/zones', { method: 'POST', body: { name: `E2E area ${RUN}` } });
  await admin('/api/admin/delivery/pincodes', { method: 'POST', body: { pincode: '380015', isServiceable: true, area: 'Satellite', city: 'Ahmedabad', zoneId: zone.data?.id } });
  const preSvc = await store('/api/delivery/check?pincode=380015');
  check('   area without a warehouse is not deliverable', preSvc.data?.serviceable === false && preSvc.data?.code === 'NOT_CONFIGURED', preSvc.data);
  const map = await admin(`/api/admin/warehouses/${whId}/zones`, { method: 'POST', body: { zoneId: zone.data?.id, priority: 1 } });
  const act = await admin(`/api/admin/warehouses/${whId}/status`, { method: 'POST', body: { status: 'ACTIVE' } });
  check('4b. map warehouse to area + activate', map.status === 200 && act.status === 200, map.data?.error ?? act.data?.error ?? act.status);

  const adj = await admin('/api/admin/inventory/adjust', { method: 'POST', body: { warehouseId: whId, productId, type: 'INITIAL_STOCK', quantity: 4, reason: 'E2E opening stock' } });
  check('5. inventory: opening stock 4 at the warehouse', adj.status === 201, adj.data?.error ?? adj.status);
  const invList = await admin(`/api/admin/inventory?q=${sku}&warehouseId=${whId}`);
  const inventoryId = invList.data?.items?.[0]?.id;
  const neg = await admin(`/api/admin/inventory/${inventoryId}/adjust`, { method: 'POST', body: { type: 'STOCK_OUT', quantity: 999, reason: 'E2E overdraw attempt' } });
  check('   stock can never go negative', neg.status === 409, neg.status);

  const coupon = await admin('/api/admin/coupons', {
    method: 'POST',
    body: { code: `E2E10${RUN}`, title: 'E2E 10% off', discountType: 'PERCENT', discountValue: 1000, maxDiscountPaise: 5000, minOrderValuePaise: 0, isActive: true, perCustomerLimit: 1 },
  });
  check('6. create coupon', coupon.status === 201, coupon.data?.error ?? coupon.status);
  const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const pastEnd = new Date(Date.now() - 86_400_000).toISOString();
  const expired = await admin('/api/admin/coupons', {
    method: 'POST',
    body: { code: `E2EOLD${RUN}`, title: 'E2E expired', discountType: 'FIXED', discountValue: 1000, isActive: true, startsAt: past, endsAt: pastEnd },
  });
  check('   create expired coupon (fixture)', expired.status === 201, expired.data?.error ?? expired.status);

  const camp = await admin('/api/admin/campaigns', {
    method: 'POST',
    body: { name: `E2E Fill Your Cart ${RUN}`, type: 'FILL_YOUR_CART', isActive: true, startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), productIds: [productId] },
  });
  const campaignId = camp.data?.id;
  check('7. create Fill Your Cart campaign', camp.status === 201 && !!campaignId, camp.data?.error ?? camp.status);
  const campDetail = await admin(`/api/admin/campaigns/${campaignId}`);
  const campaignSlug = campDetail.data?.slug ?? campDetail.data?.campaign?.slug;

  /* ══════════════════ CUSTOMER ══════════════════ */
  group('customer');
  const A = customer('A');
  const B = customer('B');
  const C = customer('C');

  const gStart = await store('/api/auth/google?returnTo=/account');
  const loc = gStart.headers.get('location') || '';
  check('1. Google login start: redirect with PKCE S256, state, nonce', gStart.status === 307 && loc.includes('accounts.google.com') && loc.includes('code_challenge_method=S256') && loc.includes('nonce='), `${gStart.status} ${loc.slice(0, 60)}`);
  const forged = await store('/api/auth/google/callback?code=abc&state=forged');
  check('   callback with forged state is rejected (no session)', (forged.headers.get('location') || '').includes('error=expired') && !forged.headers.getSetCookie().some((c) => c.includes('20m_session=') && !c.includes('Max-Age=0')), forged.headers.get('location'));
  const me = await store('/api/auth/me', { cookie: A.cookie });
  check('   customer session resolves server-side', me.data?.user?.id === A.id);

  const browse = await store(`/api/catalog/products?q=${encodeURIComponent(`Tumbler ${RUN}`)}`);
  check('2. browse/search: new product is visible', browse.data?.items?.some((p) => p.id === productId), browse.data?.total);
  const sugg = await store(`/api/catalog/search?q=${encodeURIComponent(`Tumbler ${RUN}`)}`);
  check('3. search suggestions', sugg.status === 200 && sugg.data?.items?.length >= 1);

  const add = await store('/api/cart/items', { method: 'POST', cookie: A.cookie, body: { productId, quantity: 1 } });
  check('4. add to cart', add.status === 200 && add.data?.lines?.length === 1, add.data?.error ?? add.status);
  const lineId = add.data?.lines?.[0]?.id;
  const qty = await store(`/api/cart/items/${lineId}`, { method: 'PATCH', cookie: A.cookie, body: { quantity: 2 } });
  check('5. update quantity → 2', qty.data?.lines?.[0]?.quantity === 2 && qty.data?.subtotalPaise === 11800, qty.data?.subtotalPaise);
  const tamper = await store('/api/cart/items', { method: 'POST', cookie: A.cookie, body: { productId, quantity: 1, unitPricePaise: 1, price: 1 } });
  check('   client-sent prices are ignored', tamper.data?.lines?.[0]?.unitPricePaise === 5900, tamper.data?.lines?.[0]?.unitPricePaise);
  await store(`/api/cart/items/${lineId}`, { method: 'PATCH', cookie: A.cookie, body: { quantity: 2 } });

  const badCoupon = await store('/api/cart/coupon', { method: 'POST', cookie: A.cookie, body: { code: 'NOPE-NOT-REAL' } });
  check('   invalid coupon rejected', badCoupon.status >= 400 && badCoupon.status < 500, badCoupon.data?.error?.message);
  const oldCoupon = await store('/api/cart/coupon', { method: 'POST', cookie: A.cookie, body: { code: `E2EOLD${RUN}` } });
  check('   expired coupon rejected', oldCoupon.status >= 400 && /expired/i.test(oldCoupon.data?.error?.message ?? ''), oldCoupon.data?.error?.message);
  const good = await store('/api/cart/coupon', { method: 'POST', cookie: A.cookie, body: { code: `E2E10${RUN}` } });
  check('6. apply coupon (10% computed server-side)', good.status === 200 && good.data?.discountPaise === 1180, good.data?.discountPaise ?? good.data?.error);

  const addr = await store('/api/account/addresses', {
    method: 'POST',
    cookie: A.cookie,
    body: { name: 'E2E Asha', phone: '9876543210', addressLine1: '12 Shanti Nagar, Satellite Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380015' },
  });
  const addressId = addr.data?.id ?? addr.data?.address?.id;
  check('7. add delivery address', (addr.status === 201 || addr.status === 200) && !!addressId, addr.data?.error ?? addr.status);
  const svc = await store('/api/delivery/check?pincode=380015');
  check('8. delivery serviceability (380015)', svc.data?.serviceable === true, svc.data);
  const nosvc = await store('/api/delivery/check?pincode=110001');
  check('   unserviceable PIN reported', nosvc.data?.serviceable === false, nosvc.data);

  const summary = await store(`/api/checkout/summary?addressId=${addressId}`, { cookie: A.cookie });
  const s = summary.data;
  check('9. checkout summary: server totals', s?.canPlaceOrder === true && s.totalPaise === s.cart.subtotalPaise + s.delivery.deliveryChargePaise - s.discountPaise, s?.blockers ?? summary.status);

  const key = randomUUID();
  const place = store('/api/orders', { method: 'POST', cookie: A.cookie, body: { addressId, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: key } });
  const dupe = store('/api/orders', { method: 'POST', cookie: A.cookie, body: { addressId, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: key } });
  const [p1, p2] = await Promise.all([place, dupe]);
  const orderNumber = p1.data?.orderNumber ?? p2.data?.orderNumber;
  check('10. place order (COD)', [p1.status, p2.status].includes(201) && !!orderNumber, p1.data?.error ?? p1.status);
  check('    duplicate submission (same key, concurrent) → same single order', p1.data?.orderNumber === p2.data?.orderNumber && [p1.data?.duplicate, p2.data?.duplicate].includes(true), [p1.status, p2.status, p1.data?.orderNumber, p2.data?.orderNumber]);
  const orderCount = Number(sql(`SELECT count(*) FROM "Order" o JOIN "User" u ON u.id = o."userId" WHERE u.id = '${A.id}'`));
  check('    exactly one order row exists', orderCount === 1, orderCount);
  const tampered = await store('/api/orders', { method: 'POST', cookie: A.cookie, body: { addressId, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID(), totalPaise: 1 } });
  check('    re-submit after conversion with fake total → rejected (cart empty)', tampered.status === 400, tampered.status);

  const forgedHook = await store('/api/payments/razorpay/webhook', { method: 'POST', origin: null, body: { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_x', order_id: 'order_x', amount: 1, status: 'captured' } } } } });
  check('11. payment: forged/unsigned webhook rejected', forgedHook.status === 401 || forgedHook.status === 503, forgedHook.status);
  const verify = await store('/api/payments/razorpay/verify', { method: 'POST', cookie: A.cookie, body: { razorpay_order_id: 'order_fake123', razorpay_payment_id: 'pay_fake123', razorpay_signature: 'f'.repeat(64) } });
  check('    payment: client-side "success" without valid provider payment rejected', verify.status >= 400, verify.status);

  const hist = await store('/api/orders', { cookie: A.cookie });
  check('12. order history', hist.data?.items?.some((o) => o.orderNumber === orderNumber), hist.data?.total);
  const detail = await store(`/api/orders/${orderNumber}`, { cookie: A.cookie });
  check('    order detail: total = subtotal + delivery − coupon', detail.data && detail.data.totalPaise === detail.data.subtotalPaise + detail.data.deliveryChargePaise - detail.data.discountPaise && detail.data.discountPaise === 1180, detail.data);

  /* ══════════════════ ADMIN processes the order ══════════════════ */
  group('admin');
  const oid = sql(`SELECT id FROM "Order" WHERE "orderNumber" = '${esc(orderNumber)}'`);
  const fyc = await admin(`/api/admin/customers/${A.id}`);
  check('9. view customer', fyc.status === 200 && fyc.data?.id === A.id, fyc.status);
  let ok = true;
  for (const to of ['CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
    const r = await admin(`/api/admin/orders/${oid}/status`, { method: 'POST', body: { toStatus: to } });
    if (r.status !== 200) {
      ok = false;
      check(`   transition → ${to}`, false, r.data?.error ?? r.status);
      break;
    }
  }
  check('10/11. process order through delivery (forward-only flow)', ok);
  const skip = await admin(`/api/admin/orders/${oid}/status`, { method: 'POST', body: { toStatus: 'CONFIRMED' } });
  check('    invalid backwards transition rejected', skip.status === 409, skip.status);
  const stock = sql(`SELECT "availableQuantity" || '/' || "reservedQuantity" FROM "Inventory" WHERE id = '${inventoryId}'`);
  check('    stock committed on confirmation (available 4→2, reserved 0)', stock === '2/0', stock);
  const paid = sql(`SELECT "paymentStatus" FROM "Order" WHERE id = '${oid}'`);
  check('    COD marked PAID on delivery', paid === 'PAID', paid);

  group('customer');
  const track = await store(`/api/orders/${orderNumber}`, { cookie: A.cookie });
  check('13. track order: delivered with full timeline', track.data?.status === 'DELIVERED' && track.data?.history?.length >= 7, track.data?.history?.map((h) => h.status));
  check('    timeline hides staff identities', !JSON.stringify(track.data?.history ?? []).includes(process.env.ADMIN_USER ?? '§'));

  /* ══════════════════ Fill Your Cart & analytics ══════════════════ */
  group('admin');
  if (campaignSlug) {
    const join = await store(`/api/campaigns/${campaignSlug}/join`, { method: 'POST', cookie: B.cookie, body: {} });
    const fill = await store(`/api/campaigns/${campaignSlug}/cart`, { method: 'PUT', cookie: B.cookie, body: { productId, quantity: 3 } });
    check('    customer joins Fill Your Cart + saves campaign cart', join.status < 300 && fill.status < 300, [join.status, fill.status, fill.data?.error]);
    const realCart = await store('/api/cart', { cookie: B.cookie });
    check('    campaign cart never touches the real cart', (realCart.data?.lines?.length ?? 0) === 0);
  }
  const fa = await admin(`/api/admin/campaigns/${campaignId}/analytics`);
  check('8. Fill Your Cart analytics', fa.status === 200 && JSON.stringify(fa.data).includes('participants'), fa.status);
  const an = await admin('/api/admin/analytics?range=today');
  check('12. analytics', an.status === 200 && an.data?.sales?.grossPaidRevenuePaise >= detail.data?.totalPaise, an.data?.sales);

  /* ══════════════════ EDGE CASES ══════════════════ */
  group('edge');
  // Remaining stock: 2. B wants 3 → refused; then B and C race for the last units.
  const tooMany = await store('/api/cart/items', { method: 'POST', cookie: B.cookie, body: { productId, quantity: 3 } });
  check('out-of-stock / insufficient quantity refused at add-to-cart', tooMany.status === 409, tooMany.data?.error?.code);
  // Price change while in cart
  await store('/api/cart/items', { method: 'POST', cookie: B.cookie, body: { productId, quantity: 2 } });
  const priceUp = await admin(`/api/admin/products/${productId}`, { method: 'PATCH', body: { sellingPricePaise: 6400, mrpPaise: 6900 } });
  const bCart = await store('/api/cart', { cookie: B.cookie });
  check('price change reflected in cart with notice', priceUp.status === 200 && bCart.data?.lines?.[0]?.unitPricePaise === 6400 && bCart.data?.lines?.[0]?.priceChanged === true, bCart.data?.lines?.[0]?.message);
  // Concurrent orders for the last 2 units: B wants 2, C wants 2.
  await store('/api/cart/items', { method: 'POST', cookie: C.cookie, body: { productId, quantity: 2 } });
  const addrB = (await store('/api/account/addresses', { method: 'POST', cookie: B.cookie, body: { name: 'E2E B', phone: '9876543211', addressLine1: '14 Shanti Nagar, Satellite', city: 'Ahmedabad', state: 'Gujarat', pincode: '380015' } })).data;
  const addrC = (await store('/api/account/addresses', { method: 'POST', cookie: C.cookie, body: { name: 'E2E C', phone: '9876543212', addressLine1: '16 Shanti Nagar, Satellite', city: 'Ahmedabad', state: 'Gujarat', pincode: '380015' } })).data;
  const [ob, oc] = await Promise.all([
    store('/api/orders', { method: 'POST', cookie: B.cookie, body: { addressId: addrB?.id ?? addrB?.address?.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() } }),
    store('/api/orders', { method: 'POST', cookie: C.cookie, body: { addressId: addrC?.id ?? addrC?.address?.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() } }),
  ]);
  const statuses = [ob.status, oc.status].sort();
  check('concurrent orders for the last units: exactly one wins', statuses[0] === 201 && statuses[1] === 409, [ob.status, ob.data?.error?.code, oc.status, oc.data?.error?.code]);
  const invNow = sql(`SELECT "availableQuantity" || '/' || "reservedQuantity" FROM "Inventory" WHERE id = '${inventoryId}'`);
  check('inventory never oversold (available 2, reserved 2)', invNow === '2/2', invNow);
  const winner = ob.status === 201 ? ob.data : oc.data;
  check('winning order charged the NEW price', winner?.totalPaise >= 12800, winner?.totalPaise);

  // Ownership / IDOR
  const peek = await store(`/api/orders/${orderNumber}`, { cookie: C.cookie });
  check("customer cannot read another customer's order (404)", peek.status === 404, peek.status);
  const cancelOther = await store(`/api/orders/${orderNumber}/cancel`, { method: 'POST', cookie: C.cookie, body: { reason: 'not mine' } });
  check("customer cannot cancel another customer's order (404)", cancelOther.status === 404, cancelOther.status);
  const bLine = bCart.data?.lines?.[0]?.id;
  const stealLine = await store(`/api/cart/items/${bLine}`, { method: 'PATCH', cookie: C.cookie, body: { quantity: 1 } });
  check("customer cannot modify another customer's cart line (404)", stealLine.status === 404, stealLine.status);
  const addrSteal = await store(`/api/account/addresses/${addressId}`, { method: 'DELETE', cookie: C.cookie });
  check("customer cannot delete another customer's address (404)", addrSteal.status === 404, addrSteal.status);
  const forgedOrderAddr = await store('/api/orders', { method: 'POST', cookie: C.cookie, body: { addressId, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() } });
  check("customer cannot ship to another customer's address", forgedOrderAddr.status >= 400, forgedOrderAddr.status);

  // Authentication boundaries
  const noAuth = await call(ADMIN, '/api/admin/orders');
  check('admin API without session → 401', noAuth.status === 401, noAuth.status);
  const custOnAdmin = await call(ADMIN, '/api/admin/orders', { cookie: `__Host-20m_admin=${A.token}; 20m_admin=${A.token}` });
  check('customer session token is not an admin session → 401', custOnAdmin.status === 401, custOnAdmin.status);
  const adminToken = adminCookie.split('=').slice(1).join('=');
  const adminOnStore = await store('/api/orders', { cookie: `__Host-20m_session=${adminToken}; 20m_session=${adminToken}` });
  check('admin session token is not a customer session → 401', adminOnStore.status === 401, adminOnStore.status);
  const csrf = await call(ADMIN, `/api/admin/products/${productId}`, { method: 'PATCH', origin: 'https://evil.example', cookie: adminCookie, body: { sellingPricePaise: 100 } });
  check('cross-origin admin mutation blocked (CSRF) → 403', csrf.status === 403, csrf.status);
  const csrfStore = await store('/api/cart/items', { method: 'POST', origin: 'https://evil.example', cookie: A.cookie, body: { productId, quantity: 1 } });
  check('cross-origin storefront mutation blocked (CSRF) → 403', csrfStore.status === 403, csrfStore.status);

  // RBAC + inactive administrator
  const uname = `e2e_orders_${RUN.toLowerCase()}`;
  const pw = `E2e-${randomBytes(9).toString('base64url')}`;
  const mk = await admin('/api/admin/admins', { method: 'POST', body: { username: uname, email: `${uname}@example.com`, name: 'E2E Order Manager', password: pw, roleKeys: ['ORDER_MANAGER'] } });
  check('create limited admin (ORDER_MANAGER)', mk.status === 201 || mk.status === 200, mk.data?.error ?? mk.status);
  const om = await call(ADMIN, '/api/admin/auth/login', { method: 'POST', body: { identifier: uname, password: pw } });
  const omCookie = (om.headers.getSetCookie().find((c) => c.includes('20m_admin=')) || '').split(';')[0];
  const omAdjust = await call(ADMIN, `/api/admin/inventory/${inventoryId}/adjust`, { method: 'POST', cookie: omCookie, body: { type: 'STOCK_IN', quantity: 100, reason: 'escalation attempt' } });
  check('RBAC: order manager cannot modify inventory → 403', omAdjust.status === 403, omAdjust.status);
  const omEscalate = await call(ADMIN, `/api/admin/admins/${mk.data?.id}/roles`, { method: 'PUT', cookie: omCookie, body: { roleKeys: ['SUPER_ADMIN'] } });
  check('RBAC: privilege escalation (self → SUPER_ADMIN) refused → 403', omEscalate.status === 403, omEscalate.status);
  const omOrders = await call(ADMIN, '/api/admin/orders', { cookie: omCookie });
  check('RBAC: order manager can view orders', omOrders.status === 200, omOrders.status);
  const deact = await admin(`/api/admin/admins/${mk.data?.id}/status`, { method: 'POST', body: { status: 'INACTIVE' } });
  const afterDeact = await call(ADMIN, '/api/admin/orders', { cookie: omCookie });
  check('inactive administrator: live session revoked immediately', deact.status === 200 && afterDeact.status === 401, [deact.status, afterDeact.status]);
  const relog = await call(ADMIN, '/api/admin/auth/login', { method: 'POST', body: { identifier: uname, password: pw } });
  check('inactive administrator: cannot sign in (generic error)', relog.status === 401 && relog.data?.error?.code === 'INVALID_CREDENTIALS', relog.status);

  // Logout invalidation
  const out = await store('/api/auth/logout', { method: 'POST', cookie: A.cookie, body: {} });
  const afterOut = await store('/api/orders', { cookie: A.cookie });
  check('customer logout invalidates the session server-side', out.status === 200 && afterOut.status === 401, [out.status, afterOut.status]);
  const aout = await admin('/api/admin/auth/logout', { method: 'POST', body: {} });
  const afterAout = await admin('/api/admin/dashboard');
  check('admin logout invalidates the session server-side', aout.status === 200 && afterAout.status === 401, [aout.status, afterAout.status]);

  // Summary
  const groups = [...new Set(results.map((r) => r.group))];
  console.log(`\nE2E run ${RUN} — ${Math.round((Date.now() - t0) / 1000)} s`);
  for (const g of groups) {
    const rs = results.filter((r) => r.group === g);
    console.log(`\n${g.toUpperCase()} (${rs.filter((r) => r.ok).length}/${rs.length})`);
    for (const r of rs) console.log(`  ${r.ok ? '✔' : '✘'} ${r.name}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E crashed:', e);
  process.exit(1);
});
