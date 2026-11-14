/**
 * Base seed — safe to run repeatedly (idempotent, non-destructive).
 *   pnpm db:seed
 *
 * Seeds: permissions, system roles + role→permission mappings, initial
 * categories and price points. It never deletes data and never creates admin
 * accounts (use `pnpm admin:bootstrap` for the first SUPER_ADMIN).
 */
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLE_DEFINITIONS, ROLE_KEYS, SUPER_ADMIN_ROLE, type PermissionKey } from '@20mart/shared';

const prisma = new PrismaClient();

const INITIAL_CATEGORIES = [
  { name: 'Home', slug: 'home', description: 'Everyday home essentials, organisers and utility items.' },
  { name: 'Kitchen', slug: 'kitchen', description: 'Practical kitchen tools, storage and accessories.' },
  { name: 'Stationery', slug: 'stationery', description: 'Pens, notebooks, desk and school supplies.' },
  { name: 'Daily Use', slug: 'daily-use', description: 'Small daily-use items you reach for every day.' },
];

const INITIAL_PRICE_POINTS = [2000, 4000, 6000, 10000];

async function seedPermissions() {
  const newlyCreated = new Set<string>();
  for (const [key, meta] of Object.entries(PERMISSIONS)) {
    const existing = await prisma.permission.findUnique({ where: { key }, select: { id: true } });
    if (existing) {
      await prisma.permission.update({ where: { key }, data: { group: meta.group, description: meta.description } });
    } else {
      await prisma.permission.create({ data: { key, group: meta.group, description: meta.description } });
      newlyCreated.add(key);
    }
  }
  return newlyCreated;
}

async function seedRoles(newPermissions: Set<string>) {
  const permRows = await prisma.permission.findMany({ select: { id: true, key: true } });
  const idByKey = new Map(permRows.map((p) => [p.key, p.id]));

  for (const roleKey of ROLE_KEYS) {
    const def = ROLE_DEFINITIONS[roleKey];
    const existing = await prisma.role.findUnique({ where: { key: roleKey }, select: { id: true } });
    const role = existing
      ? await prisma.role.update({
          where: { key: roleKey },
          data: { name: def.name, description: def.description, isSystem: true },
          select: { id: true },
        })
      : await prisma.role.create({
          data: { key: roleKey, name: def.name, description: def.description, isSystem: true },
          select: { id: true },
        });

    // SUPER_ADMIN always holds every permission. Other roles receive their
    // defaults on creation and newly introduced permissions afterwards, so
    // edits made through the admin UI are preserved.
    let toGrant: PermissionKey[];
    if (roleKey === SUPER_ADMIN_ROLE) toGrant = Object.keys(PERMISSIONS) as PermissionKey[];
    else if (!existing) toGrant = def.permissions;
    else toGrant = def.permissions.filter((p) => newPermissions.has(p));

    if (toGrant.length) {
      await prisma.rolePermission.createMany({
        data: toGrant.map((k) => ({ roleId: role.id, permissionId: idByKey.get(k)! })),
        skipDuplicates: true,
      });
    }
  }
}

async function seedCatalog() {
  for (const [i, c] of INITIAL_CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, displayOrder: i + 1, seoTitle: `${c.name} essentials at 20Mart` },
    });
  }
  for (const [i, amountPaise] of INITIAL_PRICE_POINTS.entries()) {
    await prisma.pricePoint.upsert({
      where: { amountPaise },
      update: {},
      create: { amountPaise, label: `₹${amountPaise / 100}`, displayOrder: i + 1 },
    });
  }
}

async function main() {
  console.log('Seeding 20Mart base data…');
  const newPerms = await seedPermissions();
  await seedRoles(newPerms);
  await seedCatalog();
  const [perms, roles, cats, pps] = await Promise.all([
    prisma.permission.count(),
    prisma.role.count(),
    prisma.category.count(),
    prisma.pricePoint.count(),
  ]);
  console.log(`Done. permissions=${perms} roles=${roles} categories=${cats} pricePoints=${pps}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
