/**
 * Base seed — safe to run repeatedly (idempotent, non-destructive).
 *   pnpm db:seed
 *
 * Seeds: permissions, system roles + role→permission mappings, initial
 * categories, price points and the real product catalogue (seed-catalog.json).
 * The only data it removes is the old placeholder demo products (by SKU). It
 * never creates admin accounts (use `pnpm admin:bootstrap` for the first SUPER_ADMIN).
 */
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, RETIRED_PERMISSIONS, ROLE_DEFINITIONS, ROLE_KEYS, SUPER_ADMIN_ROLE, type PermissionKey } from '@20mart/shared';
import catalog from './seed-catalog.json';

type SeedProduct = {
  sku: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  mrp: number;
  featured?: boolean;
  shortDescription?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  images: { url: string; altText?: string; isPrimary?: boolean; width?: number; height?: number }[];
};

const prisma = new PrismaClient();

const INITIAL_CATEGORIES = [
  { name: 'Home', slug: 'home', description: 'Everyday home essentials, organisers and utility items.' },
  { name: 'Kitchen', slug: 'kitchen', description: 'Practical kitchen tools, storage and accessories.' },
  { name: 'Stationery', slug: 'stationery', description: 'Pens, notebooks, desk and school supplies.' },
  { name: 'Daily Use', slug: 'daily-use', description: 'Small daily-use items you reach for every day.' },
];

const INITIAL_PRICE_POINTS = [2000, 4000, 6000, 10000, 20000, 30000];

// The real 20Mart catalogue, pulled from the live storefront (see seed-catalog.json "pulledAt").
// Published with their live image URLs; no stock rows (stock is recorded per warehouse).
const INITIAL_PRODUCTS: SeedProduct[] = catalog.products;

// SKUs of the placeholder products earlier versions of this seed created. Removed
// (or archived, if something already references them) so only the real catalogue remains.
const RETIRED_DEMO_SKUS = [
  '20M-KIT-001', '20M-KIT-002', '20M-KIT-003', '20M-HOM-001', '20M-HOM-002', '20M-HOM-003',
  '20M-STA-001', '20M-STA-002', '20M-STA-003', '20M-DLY-001', '20M-DLY-002', '20M-DLY-003',
];

async function removeDemoProducts() {
  const demo = await prisma.product.findMany({ where: { sku: { in: RETIRED_DEMO_SKUS } }, select: { id: true, sku: true } });
  let deleted = 0;
  let archived = 0;
  for (const p of demo) {
    try {
      await prisma.product.delete({ where: { id: p.id } });
      deleted++;
    } catch {
      // Referenced by an order/cart/wishlist row: keep the history, hide the product.
      await prisma.product.update({ where: { id: p.id }, data: { status: 'ARCHIVED', isFeatured: false } });
      archived++;
    }
  }
  if (demo.length) console.log(`Demo products: deleted=${deleted} archived=${archived}`);
}

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

/** Move role grants from retired permission keys to their replacements, then remove the retired keys. */
async function retirePermissions() {
  for (const [oldKey, replacements] of Object.entries(RETIRED_PERMISSIONS)) {
    const old = await prisma.permission.findUnique({ where: { key: oldKey }, select: { id: true, roles: { select: { roleId: true } } } });
    if (!old) continue;
    const repl = await prisma.permission.findMany({ where: { key: { in: replacements } }, select: { id: true } });
    await prisma.$transaction([
      prisma.rolePermission.createMany({
        data: old.roles.flatMap((r) => repl.map((p) => ({ roleId: r.roleId, permissionId: p.id }))),
        skipDuplicates: true,
      }),
      prisma.rolePermission.deleteMany({ where: { permissionId: old.id } }),
      prisma.permission.delete({ where: { id: old.id } }),
    ]);
    console.log(`Retired permission ${oldKey} → ${replacements.join(', ')} (${old.roles.length} role grants moved)`);
  }
}

/**
 * Starter coupons, created INACTIVE-safe as data (never hardcoded in code paths).
 * Only created when missing — admin edits are preserved.
 */
async function seedStarterCoupons() {
  const welcome = await prisma.coupon.findUnique({ where: { code: 'WELCOME50' } });
  if (!welcome) {
    await prisma.coupon.create({
      data: {
        code: 'WELCOME50',
        title: '₹50 off your first order',
        description: 'Welcome gift for new 20Mart customers.',
        discountType: 'FIXED',
        discountValue: 5000,
        minOrderValuePaise: 19900,
        perCustomerLimit: 1,
        requiresGrant: true,
        autoIssueOnSignup: true,
        isActive: true,
      },
    });
  }
  const camp = await prisma.coupon.findUnique({ where: { code: 'CAMPAIGN100' } });
  if (!camp) {
    await prisma.coupon.create({
      data: {
        code: 'CAMPAIGN100',
        title: '₹100 off — campaign reward',
        description: 'Issued to Fill Your Cart participants when the campaign coupon is attached and activated.',
        discountType: 'FIXED',
        discountValue: 10000,
        minOrderValuePaise: 49900,
        perCustomerLimit: 1,
        requiresGrant: true,
        isActive: false,
      },
    });
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
  const categories = await prisma.category.findMany({ where: { slug: { in: INITIAL_CATEGORIES.map((c) => c.slug) } }, select: { id: true, slug: true } });
  const categoryIdBySlug = new Map(categories.map((category) => [category.slug, category.id]));
  const pricePoints = await prisma.pricePoint.findMany({ where: { amountPaise: { in: INITIAL_PRICE_POINTS } }, select: { id: true, amountPaise: true } });
  const pricePointIdByAmount = new Map(pricePoints.map((point) => [point.amountPaise, point.id]));
  for (const product of INITIAL_PRODUCTS) {
    const savedProduct = await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: {
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        shortDescription: product.shortDescription,
        description: product.description,
        categoryId: categoryIdBySlug.get(product.category)!,
        pricePointId: pricePointIdByAmount.get(product.price) ?? null,
        sellingPricePaise: product.price,
        mrpPaise: product.mrp,
        status: 'ACTIVE',
        isFeatured: product.featured ?? false,
        publishedAt: new Date(),
        seoTitle: product.seoTitle ?? `${product.name} | 20Mart`,
        seoDescription: product.seoDescription ?? null,
        images: {
          create: product.images.map((img, i) => ({
            url: img.url,
            altText: img.altText ?? product.name,
            isPrimary: img.isPrimary ?? i === 0,
            sortOrder: i,
            width: img.width ?? null,
            height: img.height ?? null,
          })),
        },
      },
      select: { id: true },
    });
    // No stock rows here: stock is recorded per warehouse (admin adjustment or goods receipt).
    void savedProduct;
  }
}

async function main() {
  console.log('Seeding 20Mart base data…');
  const newPerms = await seedPermissions();
  await seedRoles(newPerms);
  await retirePermissions();
  await removeDemoProducts();
  await seedCatalog();
  await seedStarterCoupons();
  const [perms, roles, cats, pps, products] = await Promise.all([
    prisma.permission.count(),
    prisma.role.count(),
    prisma.category.count(),
    prisma.pricePoint.count(),
    prisma.product.count(),
  ]);
  // Operational settings row with safe production defaults (COD and online payment OFF).
  await prisma.storeSettings.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
  console.log(`Done. permissions=${perms} roles=${roles} categories=${cats} pricePoints=${pps} products=${products}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
