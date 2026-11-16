import { deflateSync, crc32 } from 'node:zlib';
import { NextRequest } from 'next/server';
import { prisma } from '@20mart/database';
import { PERMISSIONS, ROLE_DEFINITIONS, ROLE_KEYS, type RoleKey } from '@20mart/shared';
import { hashPassword } from '../src/auth/password';
import { getAdminContext, loginAdmin, type AdminContext } from '../src/auth/admin';
import { resetRateLimits } from '../src/rateLimit';

export const ADMIN_ORIGIN = 'http://localhost:3001';
export const PASSWORD = 'correct-horse-battery-staple';

/** Wipe every table (test DB only) and re-seed permissions, roles, categories, price points. */
export async function resetDb() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('test')) throw new Error('resetDb refused: not a test database');
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  resetRateLimits();

  await prisma.permission.createMany({
    data: Object.entries(PERMISSIONS).map(([key, m]) => ({ key, group: m.group, description: m.description })),
  });
  const perms = await prisma.permission.findMany({ select: { id: true, key: true } });
  const idByKey = new Map(perms.map((p) => [p.key, p.id]));
  for (const key of ROLE_KEYS) {
    const def = ROLE_DEFINITIONS[key];
    await prisma.role.create({
      data: {
        key,
        name: def.name,
        isSystem: true,
        permissions: { create: def.permissions.map((p) => ({ permissionId: idByKey.get(p)! })) },
      },
    });
  }
  await prisma.category.createMany({
    data: [
      { name: 'Home', slug: 'home', displayOrder: 1 },
      { name: 'Kitchen', slug: 'kitchen', displayOrder: 2 },
    ],
  });
  await prisma.pricePoint.createMany({ data: [2000, 4000, 6000, 10000].map((a, i) => ({ amountPaise: a, label: `₹${a / 100}`, displayOrder: i })) });
}

let hashCache: string | null = null;
export async function createAdmin(username: string, roles: RoleKey[], opts: { status?: 'ACTIVE' | 'INACTIVE' } = {}) {
  hashCache ??= await hashPassword(PASSWORD);
  const roleRows = await prisma.role.findMany({ where: { key: { in: roles } }, select: { id: true } });
  return prisma.adminUser.create({
    data: {
      username,
      email: `${username}@test.local`,
      name: `${username} name`,
      passwordHash: hashCache,
      status: opts.status ?? 'ACTIVE',
      roles: { create: roleRows.map((r) => ({ roleId: r.id })) },
    },
  });
}

/** Create an admin, sign in through the real login service, return token + context. */
export async function adminSession(username: string, roles: RoleKey[]): Promise<{ token: string; ctx: AdminContext; id: string }> {
  const admin = await createAdmin(username, roles);
  const { token } = await loginAdmin({ identifier: username, password: PASSWORD }, { ipAddress: `10.0.0.${Math.floor(Math.random() * 200)}` });
  const ctx = await getAdminContext(token);
  if (!ctx) throw new Error('login failed in test helper');
  return { token, ctx, id: admin.id };
}

/** Build a request the way a browser on the admin origin would send it. */
export function adminRequest(
  path: string,
  init: { method?: string; token?: string; body?: unknown; origin?: string | null; form?: FormData } = {}
) {
  const headers = new Headers();
  if (init.token) headers.set('cookie', `20m_admin=${init.token}`);
  if (init.origin !== null) headers.set('origin', init.origin ?? ADMIN_ORIGIN);
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(init.body);
  }
  return new NextRequest(new URL(path, ADMIN_ORIGIN), { method: init.method ?? 'GET', headers, body });
}

export const ctxParams = (params: Record<string, string> = {}) => ({ params });

/** Generate a real, valid RGB PNG of the given size (no image libraries needed). */
export function makePng(width: number, height: number): Uint8Array<ArrayBuffer> {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.alloc(1 + width * 3, 0xff);
  row[0] = 0;
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const buf = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  return new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
}

export async function categoryId(slug = 'kitchen') {
  return (await prisma.category.findUniqueOrThrow({ where: { slug } })).id;
}

/* ─────────────────────────────── P1 helpers ─────────────────────────────── */

let customerSeq = 0;
/** A signed-in Google customer with a real session token. */
export async function createCustomer(label = 'cust') {
  const { createCustomerSession } = await import('../src/auth/customer');
  customerSeq++;
  const user = await prisma.user.create({
    data: { googleSubjectId: `g-${label}-${customerSeq}-${Date.now()}`, email: `${label}${customerSeq}@example.com`, name: `${label} ${customerSeq}`, profile: { create: {} } },
  });
  const { token } = await createCustomerSession(user.id);
  return { user, token };
}

/** An ACTIVE, purchasable product with an image and the given on-hand stock. */
export async function makeSellable(opts: { sku: string; pricePaise?: number; mrpPaise?: number; stock?: number; name?: string; category?: string; brandId?: string | null; featured?: boolean }) {
  const cat = await prisma.category.findUniqueOrThrow({ where: { slug: opts.category ?? 'kitchen' } });
  const price = opts.pricePaise ?? 2000;
  const product = await prisma.product.create({
    data: {
      name: opts.name ?? `Item ${opts.sku}`,
      slug: opts.sku.toLowerCase(),
      sku: opts.sku,
      categoryId: cat.id,
      brandId: opts.brandId ?? null,
      sellingPricePaise: price,
      mrpPaise: opts.mrpPaise ?? price,
      status: 'ACTIVE',
      publishedAt: new Date(),
      isFeatured: opts.featured ?? false,
      images: { create: { url: 'https://images.example/p.png', isPrimary: true } },
      inventories: { create: { warehouseId: (await testWarehouse()).id, availableQuantity: opts.stock ?? 10, lowStockThreshold: 2 } },
    },
    include: { inventories: true },
  });
  return { product, inventoryId: product.inventories[0].id };
}

/** The ACTIVE test warehouse (created on first use after each resetDb). */
export async function testWarehouse(code = 'TEST-WH') {
  return prisma.warehouse.upsert({
    where: { code },
    update: {},
    create: { code, name: `Warehouse ${code}`, status: 'ACTIVE', addressLine1: '1 Test Road', city: 'Ahmedabad', state: 'Gujarat', pinCode: '380015' },
  });
}

/** Serve `pincode` from `warehouseId` through a delivery zone (zone + PIN + mapping). */
export async function coverPincode(pincode: string, warehouseId: string, opts: { priority?: number; zoneName?: string } = {}) {
  const zone = await prisma.deliveryZone.upsert({ where: { name: opts.zoneName ?? 'Test zone' }, update: {}, create: { name: opts.zoneName ?? 'Test zone' } });
  await prisma.serviceablePincode.upsert({ where: { pincode }, update: { zoneId: zone.id, isServiceable: true }, create: { pincode, zoneId: zone.id, area: 'Satellite', city: 'Ahmedabad' } });
  await prisma.warehouseDeliveryZone.upsert({
    where: { warehouseId_zoneId: { warehouseId, zoneId: zone.id } },
    update: { priority: opts.priority ?? 1, isActive: true },
    create: { warehouseId, zoneId: zone.id, priority: opts.priority ?? 1 },
  });
  return zone;
}

/** Delivery config for tests: COD on, one serviceable PIN, ₹40 fee, free above ₹199, min ₹20. */
export async function setupDelivery(over: Record<string, unknown> = {}) {
  await prisma.storeSettings.upsert({
    where: { id: 'default' },
    update: { codEnabled: true, deliveryEnabled: true, minOrderPaise: 2000, deliveryFeePaise: 4000, freeDeliveryThresholdPaise: 19900, ...over },
    create: { id: 'default', codEnabled: true, deliveryEnabled: true, minOrderPaise: 2000, deliveryFeePaise: 4000, freeDeliveryThresholdPaise: 19900, ...over },
  });
  await coverPincode('380015', (await testWarehouse()).id);
}

export const VALID_ADDRESS = {
  name: 'Asha Patel',
  phone: '9876543210',
  addressLine1: '12 Shanti Nagar, Satellite Road',
  city: 'Ahmedabad',
  state: 'Gujarat',
  pincode: '380015',
};

export function customerRequest(path: string, init: { method?: string; token?: string; guestToken?: string; body?: unknown; origin?: string | null } = {}) {
  const headers = new Headers();
  const cookies = [init.token ? `20m_session=${init.token}` : '', init.guestToken ? `20m_cart=${init.guestToken}` : ''].filter(Boolean);
  if (cookies.length) headers.set('cookie', cookies.join('; '));
  if (init.origin !== null) headers.set('origin', init.origin ?? 'http://localhost:3000');
  let body: BodyInit | undefined;
  if (init.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = typeof init.body === 'string' ? init.body : JSON.stringify(init.body);
  }
  return new NextRequest(new URL(path, 'http://localhost:3000'), { method: init.method ?? 'GET', headers, body });
}
