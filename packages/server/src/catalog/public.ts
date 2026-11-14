import { prisma, type Prisma } from '@20mart/database';
import {
  discountPercent,
  stockStateOf,
  type Paginated,
  type StorefrontCategory,
  type StorefrontProduct,
  type StorefrontProductDetail,
} from '@20mart/shared';
import { z } from 'zod';
import { summariseStock } from './products';

/** A product is publicly visible only when it, its category and (if set) its brand are active. */
export const visibleProductWhere: Prisma.ProductWhereInput = {
  status: 'ACTIVE',
  category: { status: 'ACTIVE' },
  OR: [{ brandId: null }, { brand: { status: 'ACTIVE' } }],
};

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  sellingPricePaise: true,
  mrpPaise: true,
  isFeatured: true,
  brand: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
  images: { where: { isPrimary: true }, take: 1, select: { url: true, altText: true } },
  inventories: {
    where: { OR: [{ variantId: null }, { variant: { status: 'ACTIVE' } }] },
    select: { productId: true, variantId: true, availableQuantity: true, reservedQuantity: true, lowStockThreshold: true },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

function toCard(p: CardRow): StorefrontProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    sellingPricePaise: p.sellingPricePaise,
    mrpPaise: p.mrpPaise,
    discountPercent: discountPercent(p.sellingPricePaise, p.mrpPaise),
    brand: p.brand,
    category: p.category,
    image: p.images[0] ? { url: p.images[0].url, alt: p.images[0].altText || p.name } : null,
    stockState: summariseStock(p.inventories).state,
    isFeatured: p.isFeatured,
  };
}

export const publicProductQuery = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
  q: z.string().trim().max(80).optional().transform((v) => v || undefined),
  category: z.string().trim().max(80).optional(),
  brand: z.string().trim().max(80).optional(),
  sort: z.enum(['popular', 'newest', 'price_asc', 'price_desc']).default('popular'),
  maxPrice: z.coerce.number().int().min(1).max(10_000_000).optional(),
  featured: z.coerce.boolean().optional(),
  deals: z.coerce.boolean().optional(),
});
export type PublicProductQuery = z.input<typeof publicProductQuery>;

export async function listPublicProducts(raw: PublicProductQuery = {}): Promise<Paginated<StorefrontProduct>> {
  const query = publicProductQuery.parse(raw);
  const and: Prisma.ProductWhereInput[] = [visibleProductWhere];
  if (query.category) and.push({ OR: [{ category: { slug: query.category } }, { category: { parent: { slug: query.category } } }] });
  if (query.brand) and.push({ brand: { slug: query.brand } });
  if (query.maxPrice) and.push({ sellingPricePaise: { lte: query.maxPrice } });
  if (query.featured) and.push({ isFeatured: true });
  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: 'insensitive' } },
        { shortDescription: { contains: query.q, mode: 'insensitive' } },
        { brand: { name: { contains: query.q, mode: 'insensitive' } } },
        { category: { name: { contains: query.q, mode: 'insensitive' } } },
      ],
    });
  }
  const where: Prisma.ProductWhereInput = { AND: and };
  if (query.deals) {
    // "Deal" = selling price below MRP (column comparison via field reference).
    and.push({ sellingPricePaise: { lt: prisma.product.fields.mrpPaise } });
  }
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    query.sort === 'price_asc'
      ? [{ sellingPricePaise: 'asc' }, { name: 'asc' }]
      : query.sort === 'price_desc'
        ? [{ sellingPricePaise: 'desc' }, { name: 'asc' }]
        : query.sort === 'newest'
          ? [{ publishedAt: 'desc' }, { createdAt: 'desc' }]
          : [{ isFeatured: 'desc' }, { publishedAt: 'desc' }];

  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: cardSelect }),
    prisma.product.count({ where }),
  ]);
  return { items: rows.map(toCard), total, page: query.page, pageSize: query.pageSize };
}

/** Public cards for a set of ids (wishlist/cart hydration). Order follows `ids`. */
export async function getPublicProductsByIds(ids: string[]): Promise<StorefrontProduct[]> {
  const unique = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 60);
  if (!unique.length) return [];
  const rows = await prisma.product.findMany({ where: { AND: [visibleProductWhere, { id: { in: unique } }] }, select: cardSelect });
  const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
  return unique.map((id) => byId.get(id)).filter((p): p is StorefrontProduct => !!p);
}

export async function getPublicProduct(slug: string): Promise<StorefrontProductDetail | null> {
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null;
  const p = await prisma.product.findFirst({
    where: { AND: [visibleProductWhere, { slug }] },
    select: {
      ...cardSelect,
      sku: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], select: { url: true, altText: true } },
      variants: {
        where: { status: 'ACTIVE' },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          sellingPricePaise: true,
          mrpPaise: true,
          inventories: { select: { availableQuantity: true, reservedQuantity: true, lowStockThreshold: true } },
        },
      },
    },
  });
  if (!p) return null;
  const card = toCard({ ...p, images: p.images.slice(0, 1) });
  return {
    ...card,
    sku: p.sku,
    description: p.description,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    images: p.images.map((i) => ({ url: i.url, alt: i.altText || p.name })),
    variants: p.variants.map((v) => {
      const inv = v.inventories[0];
      return {
        id: v.id,
        name: v.name,
        sellingPricePaise: v.sellingPricePaise,
        mrpPaise: v.mrpPaise,
        stockState: inv ? stockStateOf(inv.availableQuantity - inv.reservedQuantity, inv.lowStockThreshold) : 'OUT',
      };
    }),
  };
}

export async function getRelatedProducts(productId: string, categorySlug: string, limit = 5): Promise<StorefrontProduct[]> {
  const rows = await prisma.product.findMany({
    where: { AND: [visibleProductWhere, { category: { slug: categorySlug } }, { id: { not: productId } }] },
    orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
    take: limit,
    select: cardSelect,
  });
  return rows.map(toCard);
}

const visibleCountFilter = { where: visibleProductWhere } as const;

export async function listPublicCategories(): Promise<StorefrontCategory[]> {
  const rows = await prisma.category.findMany({
    where: { status: 'ACTIVE', parentId: null },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      _count: { select: { products: visibleCountFilter } },
    },
  });
  return rows.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
}

export async function getPublicCategory(slug: string) {
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null;
  const c = await prisma.category.findFirst({
    where: { slug, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      seoTitle: true,
      seoDescription: true,
      _count: { select: { products: visibleCountFilter } },
      children: {
        where: { status: 'ACTIVE' },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, slug: true },
      },
    },
  });
  if (!c) return null;
  const { _count, ...rest } = c;
  return { ...rest, productCount: _count.products };
}

export async function searchSuggestions(q: string, limit = 8) {
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  const rows = await prisma.product.findMany({
    where: { AND: [visibleProductWhere, { OR: [{ name: { contains: term, mode: 'insensitive' } }, { brand: { name: { contains: term, mode: 'insensitive' } } }] }] },
    orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
    take: Math.min(limit, 10),
    select: { slug: true, name: true, sellingPricePaise: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } },
  });
  return rows.map((r) => ({ slug: r.slug, name: r.name, sellingPricePaise: r.sellingPricePaise, imageUrl: r.images[0]?.url ?? null }));
}
