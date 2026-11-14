/**
 * OPTIONAL development-only demo catalog.
 *   pnpm db:seed:demo
 *
 * Imports the legacy mock products as DRAFT products with ZERO stock so the
 * admin UI can be exercised. Nothing becomes purchasable until an admin adds
 * stock and publishes. Refuses to run in production.
 */
import { PrismaClient } from '@prisma/client';
import { mockProducts, slugify } from '@20mart/shared';

if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED === 'false') {
  console.error('Refusing to run the demo seed in production.');
  process.exit(1);
}

const prisma = new PrismaClient();

// Legacy mock category slugs → P0 categories.
const CATEGORY_MAP: Record<string, string> = {
  'kitchen-home': 'kitchen',
  'cleaning-care': 'home',
  'storage-organisation': 'home',
  'stationery-school': 'stationery',
  'daily-use': 'daily-use',
  'personal-care': 'daily-use',
};

// In-house label in the mocks is not a real manufacturer brand: leave brand empty.
const NOT_A_BRAND = new Set(['20Mart Value']);

async function main() {
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catId = new Map(categories.map((c) => [c.slug, c.id]));
  if (!catId.size) throw new Error('Run `pnpm db:seed` first (categories missing).');
  const pricePoints = await prisma.pricePoint.findMany({ select: { id: true, amountPaise: true } });

  let created = 0;
  for (const p of mockProducts) {
    if (await prisma.product.findFirst({ where: { OR: [{ sku: p.sku }, { slug: p.slug }] }, select: { id: true } })) continue;

    let brandId: string | null = null;
    if (p.brand && !NOT_A_BRAND.has(p.brand)) {
      const slug = slugify(p.brand);
      const brand = await prisma.brand.upsert({ where: { slug }, update: {}, create: { name: p.brand, slug } });
      brandId = brand.id;
    }

    const sellingPricePaise = Math.round(p.price) * 100;
    const mrpPaise = Math.max(sellingPricePaise, Math.round(p.originalPrice) * 100);
    const categoryId = catId.get(CATEGORY_MAP[p.categorySlug] ?? 'home') ?? [...catId.values()][0];
    const pricePointId = pricePoints.find((pp) => pp.amountPaise === sellingPricePaise)?.id ?? null;

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          description: p.description,
          shortDescription: p.description.slice(0, 140),
          categoryId,
          brandId,
          pricePointId,
          sellingPricePaise,
          mrpPaise,
          status: 'DRAFT',
          isFeatured: !!p.featured || !!p.trending,
          images: {
            create: p.images.map((url, i) => ({ url, altText: p.name, sortOrder: i, isPrimary: i === 0 })),
          },
        },
      });
      await tx.inventory.create({ data: { productId: product.id, availableQuantity: 0, lowStockThreshold: 10 } });
    });
    created++;
  }
  console.log(`Demo seed complete: ${created} draft products created (0 stock).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
