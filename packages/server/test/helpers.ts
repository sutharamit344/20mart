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
export function makePng(width: number, height: number): Uint8Array {
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
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ])
  );
}

export async function categoryId(slug = 'kitchen') {
  return (await prisma.category.findUniqueOrThrow({ where: { slug } })).id;
}
