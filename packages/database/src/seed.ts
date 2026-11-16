/**
 * Base seed — safe to run repeatedly (idempotent, non-destructive).
 *   pnpm db:seed
 *
 * Seeds: permissions, system roles + role→permission mappings, initial
 * categories and price points. It never deletes data and never creates admin
 * accounts (use `pnpm admin:bootstrap` for the first SUPER_ADMIN).
 */
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, RETIRED_PERMISSIONS, ROLE_DEFINITIONS, ROLE_KEYS, SUPER_ADMIN_ROLE, type PermissionKey } from '@20mart/shared';

const prisma = new PrismaClient();

const INITIAL_CATEGORIES = [
  { name: 'Home', slug: 'home', description: 'Everyday home essentials, organisers and utility items.' },
  { name: 'Kitchen', slug: 'kitchen', description: 'Practical kitchen tools, storage and accessories.' },
  { name: 'Stationery', slug: 'stationery', description: 'Pens, notebooks, desk and school supplies.' },
  { name: 'Daily Use', slug: 'daily-use', description: 'Small daily-use items you reach for every day.' },
];

const INITIAL_PRICE_POINTS = [2000, 4000, 6000, 10000];

// Draft examples give the admin catalog something to work with after setup.
// They intentionally have no stock or images and are not visible to customers.
const INITIAL_PRODUCTS = [
  { name: 'Cotton Kitchen Towel Set', slug: 'cotton-kitchen-towel-set', sku: '20M-KIT-001', category: 'kitchen', price: 10000, mrp: 12900, shortDescription: 'Absorbent everyday cotton towels for kitchen cleanup.', description: 'A practical set of reusable cotton kitchen towels for drying dishes and keeping counters clean.' },
  { name: 'Reusable Storage Clips', slug: 'reusable-storage-clips', sku: '20M-KIT-002', category: 'kitchen', price: 4000, mrp: 4900, shortDescription: 'Keep opened food packets neatly sealed.', description: 'Reusable clips for sealing snack, pantry and freezer packets between uses.' },
  { name: 'Measuring Spoon Set', slug: 'measuring-spoon-set', sku: '20M-KIT-003', category: 'kitchen', price: 6000, mrp: 7900, shortDescription: 'A compact set for everyday cooking and baking.', description: 'Easy-to-store measuring spoons for portioning common dry and liquid ingredients.' },
  { name: 'Drawer Organizer Tray', slug: 'drawer-organizer-tray', sku: '20M-HOM-001', category: 'home', price: 10000, mrp: 14900, shortDescription: 'Keep small household essentials sorted.', description: 'A versatile organizer tray for desk drawers, bedside tables and household storage.' },
  { name: 'Microfiber Cleaning Cloths', slug: 'microfiber-cleaning-cloths', sku: '20M-HOM-002', category: 'home', price: 6000, mrp: 8900, shortDescription: 'Reusable cloths for everyday surface cleaning.', description: 'Soft reusable microfiber cloths for dusting and wiping common household surfaces.' },
  { name: 'Cable Organizer Clips', slug: 'cable-organizer-clips', sku: '20M-HOM-003', category: 'home', price: 4000, mrp: 5900, shortDescription: 'Keep charging and desk cables within reach.', description: 'Compact clips that help route charging cables and reduce desk clutter.' },
  { name: 'Ruled Pocket Notebook', slug: 'ruled-pocket-notebook', sku: '20M-STA-001', category: 'stationery', price: 2000, mrp: 2900, shortDescription: 'A handy notebook for quick notes on the go.', description: 'A compact ruled notebook for lists, reminders and everyday note-taking.' },
  { name: 'Smooth Ballpoint Pen Pack', slug: 'smooth-ballpoint-pen-pack', sku: '20M-STA-002', category: 'stationery', price: 4000, mrp: 5900, shortDescription: 'Reliable pens for school, work and home.', description: 'A convenient pack of smooth-writing ballpoint pens for daily use.' },
  { name: 'Sticky Note Pad Set', slug: 'sticky-note-pad-set', sku: '20M-STA-003', category: 'stationery', price: 6000, mrp: 7900, shortDescription: 'Colorful reminders for desks and notebooks.', description: 'Self-adhesive note pads for reminders, bookmarks and quick messages.' },
  { name: 'Reusable Shopping Bag', slug: 'reusable-shopping-bag', sku: '20M-DLY-001', category: 'daily-use', price: 4000, mrp: 5900, shortDescription: 'A reusable carry bag for everyday errands.', description: 'A lightweight reusable bag for groceries, small shopping trips and daily carry.' },
  { name: 'Travel Toothbrush Case', slug: 'travel-toothbrush-case', sku: '20M-DLY-002', category: 'daily-use', price: 2000, mrp: 2900, shortDescription: 'Keep a toothbrush protected while travelling.', description: 'A simple travel case for storing a toothbrush in a bag or luggage.' },
  { name: 'Compact Sewing Kit', slug: 'compact-sewing-kit', sku: '20M-DLY-003', category: 'daily-use', price: 6000, mrp: 8900, shortDescription: 'Basic mending supplies in a compact kit.', description: 'A small household sewing kit for quick clothing repairs and simple mending.' },
];

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
        pricePointId: pricePointIdByAmount.get(product.price)!,
        sellingPricePaise: product.price,
        mrpPaise: product.mrp,
        status: 'DRAFT',
        seoTitle: `${product.name} | 20Mart`,
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
