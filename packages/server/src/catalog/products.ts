import { prisma, Prisma } from '@20mart/database';
import { SKU_REGEX, slugify, stockStateOf, type StockState } from '@20mart/shared';
import { z } from 'zod';
import type { AdminContext } from '../auth/admin';
import { audit } from '../audit';
import { AppError, badRequest, conflict, notFound } from '../errors';
import { deleteStoredImage, uploadImage } from '../media';
import { notifyStorefront } from '../revalidate';
import { idParam, optionalText, pageQuery, slugField } from './common';

const paise = z.coerce.number().int('Price must be in whole paise').min(1, 'Price must be greater than zero').max(100_000_000);
const skuField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(SKU_REGEX, 'SKU: 2–40 chars, letters, numbers, - or _');

const productBase = z.object({
  name: z.string().trim().min(2).max(150),
  slug: slugField.optional(),
  sku: skuField,
  description: optionalText(5000),
  shortDescription: optionalText(300),
  categoryId: idParam,
  brandId: idParam.nullish().transform((v) => v ?? null),
  pricePointId: idParam.nullish().transform((v) => v ?? null),
  sellingPricePaise: paise,
  mrpPaise: paise,
  isFeatured: z.boolean().default(false),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
});

export const productCreateInput = productBase.refine((v) => v.mrpPaise >= v.sellingPricePaise, {
  message: 'MRP must be greater than or equal to the selling price',
  path: ['mrpPaise'],
});
export const productUpdateInput = productBase.partial();

export const productStatusInput = z.object({ status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']) });

export const productListQuery = pageQuery.extend({
  categoryId: idParam.optional(),
  brandId: idParam.optional(),
  pricePointId: idParam.optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  featured: z.enum(['yes', 'no']).optional(),
  stock: z.enum(['in', 'low', 'out']).optional(),
});

export const variantInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    sku: skuField,
    sellingPricePaise: paise,
    mrpPaise: paise,
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
    sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .refine((v) => v.mrpPaise >= v.sellingPricePaise, { message: 'MRP must be ≥ selling price', path: ['mrpPaise'] });
export const variantUpdateInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  sku: skuField.optional(),
  sellingPricePaise: paise.optional(),
  mrpPaise: paise.optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
});

export const imageUpdateInput = z.object({ altText: optionalText(150) });
export const imageOrderInput = z.object({ imageIds: z.array(idParam).min(1).max(30) });

type InvRow = { productId: string; variantId: string | null; availableQuantity: number; reservedQuantity: number; lowStockThreshold: number };

/**
 * Sellable stock of a product: sum over variant rows if the product has
 * variants, otherwise the product-level row. Reserved units are not sellable.
 */
export function summariseStock(rows: InvRow[]) {
  const variantRows = rows.filter((r) => r.variantId);
  const relevant = variantRows.length ? variantRows : rows.filter((r) => !r.variantId);
  const onHand = relevant.reduce((a, r) => a + r.availableQuantity, 0);
  const sellable = relevant.reduce((a, r) => a + (r.availableQuantity - r.reservedQuantity), 0);
  const threshold = relevant.length ? Math.max(...relevant.map((r) => r.lowStockThreshold)) : 0;
  return { onHand, sellable, state: stockStateOf(sellable, threshold) as StockState };
}

async function productIdsByStock(state: 'in' | 'low' | 'out'): Promise<string[]> {
  // Mirrors summariseStock(): variant rows when present, else the product row.
  const rows = await prisma.$queryRaw<{ productId: string }[]>`
    WITH per_product AS (
      SELECT i."productId",
             BOOL_OR(i."variantId" IS NOT NULL) AS has_variants,
             SUM(CASE WHEN i."variantId" IS NOT NULL THEN i."availableQuantity" - i."reservedQuantity" ELSE 0 END) AS v_sellable,
             SUM(CASE WHEN i."variantId" IS NULL THEN i."availableQuantity" - i."reservedQuantity" ELSE 0 END) AS p_sellable,
             MAX(CASE WHEN i."variantId" IS NOT NULL THEN i."lowStockThreshold" END) AS v_threshold,
             MAX(CASE WHEN i."variantId" IS NULL THEN i."lowStockThreshold" END) AS p_threshold
      FROM "Inventory" i GROUP BY i."productId"
    ), s AS (
      SELECT "productId",
             CASE WHEN has_variants THEN v_sellable ELSE p_sellable END AS sellable,
             CASE WHEN has_variants THEN v_threshold ELSE p_threshold END AS threshold
      FROM per_product
    )
    SELECT "productId" FROM s
    WHERE (${state} = 'out' AND sellable <= 0)
       OR (${state} = 'low' AND sellable > 0 AND sellable <= threshold)
       OR (${state} = 'in' AND sellable > threshold)`;
  return rows.map((r) => r.productId);
}

export async function listProducts(query: z.infer<typeof productListQuery>) {
  const where: Prisma.ProductWhereInput = {
    ...(query.status ? { status: query.status } : { status: { not: 'ARCHIVED' } }),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.brandId ? { brandId: query.brandId } : {}),
    ...(query.pricePointId ? { pricePointId: query.pricePointId } : {}),
    ...(query.featured ? { isFeatured: query.featured === 'yes' } : {}),
    ...(query.q
      ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { sku: { contains: query.q, mode: 'insensitive' } }] }
      : {}),
  };
  if (query.stock) where.id = { in: await productIdsByStock(query.stock) };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        status: true,
        isFeatured: true,
        sellingPricePaise: true,
        mrpPaise: true,
        updatedAt: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        images: { where: { isPrimary: true }, take: 1, select: { url: true, altText: true } },
        inventories: {
          select: { productId: true, variantId: true, availableQuantity: true, reservedQuantity: true, lowStockThreshold: true },
        },
        _count: { select: { variants: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  const items = rows.map(({ inventories, images, ...p }) => ({ ...p, image: images[0] ?? null, stock: summariseStock(inventories) }));
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getProductForAdmin(id: string) {
  idParam.parse(id);
  const p = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      description: true,
      shortDescription: true,
      categoryId: true,
      brandId: true,
      pricePointId: true,
      sellingPricePaise: true,
      mrpPaise: true,
      status: true,
      isFeatured: true,
      seoTitle: true,
      seoDescription: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      images: {
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        select: { id: true, url: true, altText: true, isPrimary: true, sortOrder: true, width: true, height: true },
      },
      variants: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          sku: true,
          sellingPricePaise: true,
          mrpPaise: true,
          status: true,
          sortOrder: true,
          inventories: { select: { availableQuantity: true, reservedQuantity: true } },
        },
      },
      inventories: {
        select: { id: true, productId: true, variantId: true, availableQuantity: true, reservedQuantity: true, lowStockThreshold: true },
      },
    },
  });
  if (!p) throw notFound('Product');
  return { ...p, stock: summariseStock(p.inventories) };
}

async function assertReferences(data: { categoryId?: string; brandId?: string | null; pricePointId?: string | null }) {
  if (data.categoryId && !(await prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } }))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Selected category does not exist', { fieldErrors: { categoryId: ['Category not found'] } });
  }
  if (data.brandId && !(await prisma.brand.findUnique({ where: { id: data.brandId }, select: { id: true } }))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Selected brand does not exist', { fieldErrors: { brandId: ['Brand not found'] } });
  }
  if (data.pricePointId && !(await prisma.pricePoint.findUnique({ where: { id: data.pricePointId }, select: { id: true } }))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Selected price point does not exist', { fieldErrors: { pricePointId: ['Price point not found'] } });
  }
}

/** SKUs are unique across products AND variants. */
async function assertSkuFree(sku: string, except?: { productId?: string; variantId?: string }) {
  const [p, v] = await Promise.all([
    prisma.product.findUnique({ where: { sku }, select: { id: true } }),
    prisma.productVariant.findUnique({ where: { sku }, select: { id: true } }),
  ]);
  if ((p && p.id !== except?.productId) || (v && v.id !== except?.variantId)) {
    throw conflict(`SKU "${sku}" is already in use`, { fields: ['SKU'] });
  }
}

export async function createProduct(actor: AdminContext, raw: unknown) {
  const input = productCreateInput.parse(raw);
  await assertReferences(input);
  await assertSkuFree(input.sku);
  const slug = input.slug ?? slugify(input.name);
  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({ data: { ...input, slug, status: 'DRAFT' }, select: { id: true, name: true, sku: true, slug: true } });
    await tx.inventory.create({ data: { productId: p.id } });
    await audit(tx, actor, { action: 'Created product', category: 'PRODUCT', entityType: 'Product', entityId: p.id, details: `${p.sku} · ${p.name}` });
    return p;
  });
  return product;
}

export async function updateProduct(actor: AdminContext, id: string, raw: unknown) {
  idParam.parse(id);
  const input = productUpdateInput.parse(raw);
  if (!Object.keys(input).length) throw badRequest('Nothing to update');
  const current = await prisma.product.findUnique({
    where: { id },
    select: { sellingPricePaise: true, mrpPaise: true, slug: true, status: true },
  });
  if (!current) throw notFound('Product');
  const selling = input.sellingPricePaise ?? current.sellingPricePaise;
  const mrp = input.mrpPaise ?? current.mrpPaise;
  if (mrp < selling) {
    throw new AppError(400, 'VALIDATION_ERROR', 'MRP must be greater than or equal to the selling price', {
      fieldErrors: { mrpPaise: ['MRP must be ≥ selling price'] },
    });
  }
  await assertReferences(input);
  if (input.sku) await assertSkuFree(input.sku, { productId: id });

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.product.update({ where: { id }, data: input, select: { id: true, name: true, sku: true, slug: true, status: true } });
    const priceNote =
      input.sellingPricePaise !== undefined || input.mrpPaise !== undefined
        ? ` · price ${current.sellingPricePaise}→${selling} paise, MRP ${current.mrpPaise}→${mrp} paise`
        : '';
    await audit(tx, actor, {
      action: 'Updated product',
      category: 'PRODUCT',
      entityType: 'Product',
      entityId: id,
      details: `${p.sku}: ${Object.keys(input).join(', ')}${priceNote}`,
    });
    return p;
  });
  notifyStorefront(['/', '/shop', `/product/${current.slug}`, `/product/${updated.slug}`]);
  return updated;
}

/** Publish/unpublish/archive. Publishing requires an image and an active category. */
export async function setProductStatus(actor: AdminContext, id: string, raw: unknown) {
  idParam.parse(id);
  const { status } = productStatusInput.parse(raw);
  const p = await prisma.product.findUnique({
    where: { id },
    select: { status: true, slug: true, sku: true, publishedAt: true, category: { select: { status: true } }, _count: { select: { images: true } } },
  });
  if (!p) throw notFound('Product');
  if (status === 'ACTIVE') {
    if (p._count.images === 0) throw badRequest('Add at least one image before publishing');
    if (p.category.status !== 'ACTIVE') throw badRequest('The product category is disabled. Enable it before publishing.');
  }
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.product.update({
      where: { id },
      data: { status, publishedAt: status === 'ACTIVE' && !p.publishedAt ? new Date() : undefined },
      select: { id: true, status: true },
    });
    await audit(tx, actor, { action: 'Changed product status', category: 'PRODUCT', entityType: 'Product', entityId: id, details: `${p.sku}: ${p.status} → ${status}` });
    return u;
  });
  notifyStorefront(['/', '/shop', `/product/${p.slug}`]);
  return updated;
}

/**
 * Hard-delete only never-published drafts with no stock history or orders.
 * Everything else is archived so history stays intact.
 */
export async function deleteProduct(actor: AdminContext, id: string) {
  idParam.parse(id);
  const p = await prisma.product.findUnique({
    where: { id },
    select: {
      status: true,
      sku: true,
      slug: true,
      publishedAt: true,
      images: { select: { storageKey: true } },
      _count: { select: { orderItems: true, cartItems: true } },
    },
  });
  if (!p) throw notFound('Product');
  const movements = await prisma.stockMovement.count({ where: { inventory: { productId: id } } });
  const canHardDelete = p.status === 'DRAFT' && !p.publishedAt && movements === 0 && p._count.orderItems === 0 && p._count.cartItems === 0;

  if (canHardDelete) {
    await prisma.$transaction(async (tx) => {
      await tx.product.delete({ where: { id } });
      await audit(tx, actor, { action: 'Deleted product', category: 'PRODUCT', entityType: 'Product', entityId: id, details: p.sku });
    });
    await Promise.all(p.images.map((i) => deleteStoredImage(i.storageKey)));
    return { mode: 'deleted' as const };
  }
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: { status: 'ARCHIVED', isFeatured: false } });
    await audit(tx, actor, { action: 'Archived product', category: 'PRODUCT', entityType: 'Product', entityId: id, details: p.sku });
  });
  notifyStorefront(['/', '/shop', `/product/${p.slug}`]);
  return { mode: 'archived' as const };
}

/* ─────────────────────────────── Variants ─────────────────────────────── */

export async function addVariant(actor: AdminContext, productId: string, raw: unknown) {
  idParam.parse(productId);
  const input = variantInput.parse(raw);
  await assertSkuFree(input.sku);
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { sku: true, slug: true, inventories: { where: { variantId: null }, select: { availableQuantity: true, reservedQuantity: true } } },
  });
  if (!product) throw notFound('Product');
  const base = product.inventories[0];
  const variantCount = await prisma.productVariant.count({ where: { productId } });
  if (variantCount === 0 && base && (base.availableQuantity > 0 || base.reservedQuantity > 0)) {
    throw conflict('This product has product-level stock. Reduce it to 0 before adding variants (stock is then tracked per variant).');
  }
  const v = await prisma.$transaction(async (tx) => {
    const v = await tx.productVariant.create({ data: { ...input, productId }, select: { id: true, name: true, sku: true } });
    await tx.inventory.create({ data: { productId, variantId: v.id } });
    await audit(tx, actor, { action: 'Added variant', category: 'PRODUCT', entityType: 'Product', entityId: productId, details: `${product.sku} → ${v.sku} (${v.name})` });
    return v;
  });
  notifyStorefront([`/product/${product.slug}`]);
  return v;
}

export async function updateVariant(actor: AdminContext, productId: string, variantId: string, raw: unknown) {
  idParam.parse(productId);
  idParam.parse(variantId);
  const input = variantUpdateInput.parse(raw);
  const current = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
    select: { sellingPricePaise: true, mrpPaise: true, sku: true, product: { select: { slug: true } } },
  });
  if (!current) throw notFound('Variant');
  if ((input.mrpPaise ?? current.mrpPaise) < (input.sellingPricePaise ?? current.sellingPricePaise)) {
    throw badRequest('MRP must be greater than or equal to the selling price');
  }
  if (input.sku) await assertSkuFree(input.sku, { variantId });
  const v = await prisma.$transaction(async (tx) => {
    const v = await tx.productVariant.update({ where: { id: variantId }, data: input, select: { id: true, name: true, sku: true, status: true } });
    await audit(tx, actor, { action: 'Updated variant', category: 'PRODUCT', entityType: 'Product', entityId: productId, details: `${current.sku}: ${Object.keys(input).join(', ')}` });
    return v;
  });
  notifyStorefront([`/product/${current.product.slug}`]);
  return v;
}

/** Delete a variant only when it has no stock history; otherwise deactivate it. */
export async function deleteVariant(actor: AdminContext, productId: string, variantId: string) {
  idParam.parse(productId);
  idParam.parse(variantId);
  const v = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
    select: { sku: true, _count: { select: { orderItems: true, cartItems: true } }, inventories: { select: { id: true, availableQuantity: true, _count: { select: { movements: true } } } } },
  });
  if (!v) throw notFound('Variant');
  const hasHistory = v.inventories.some((i) => i._count.movements > 0 || i.availableQuantity > 0) || v._count.orderItems > 0 || v._count.cartItems > 0;
  await prisma.$transaction(async (tx) => {
    if (hasHistory) await tx.productVariant.update({ where: { id: variantId }, data: { status: 'INACTIVE' } });
    else await tx.productVariant.delete({ where: { id: variantId } });
    await audit(tx, actor, { action: hasHistory ? 'Deactivated variant' : 'Deleted variant', category: 'PRODUCT', entityType: 'Product', entityId: productId, details: v.sku });
  });
  return { mode: hasHistory ? ('deactivated' as const) : ('deleted' as const) };
}

/* ──────────────────────────────── Images ──────────────────────────────── */

export const MAX_IMAGES_PER_PRODUCT = 12;

export async function addProductImage(actor: AdminContext, productId: string, file: Blob, altText?: string | null) {
  idParam.parse(productId);
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { sku: true, name: true, slug: true, _count: { select: { images: true } } } });
  if (!p) throw notFound('Product');
  if (p._count.images >= MAX_IMAGES_PER_PRODUCT) throw badRequest(`A product can have at most ${MAX_IMAGES_PER_PRODUCT} images`);

  // The DB row is created only after storage confirms the object.
  const stored = await uploadImage(file, 'products');
  try {
    const image = await prisma.$transaction(async (tx) => {
      const agg = await tx.productImage.aggregate({ where: { productId }, _max: { sortOrder: true }, _count: true });
      const img = await tx.productImage.create({
        data: {
          productId,
          url: stored.url,
          storageKey: stored.key,
          altText: altText?.trim().slice(0, 150) || p.name,
          sortOrder: (agg._max.sortOrder ?? -1) + 1,
          isPrimary: agg._count === 0,
          width: stored.width,
          height: stored.height,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
        },
        select: { id: true, url: true, altText: true, isPrimary: true, sortOrder: true, width: true, height: true },
      });
      await audit(tx, actor, { action: 'Added product image', category: 'MEDIA', entityType: 'Product', entityId: productId, details: p.sku });
      return img;
    });
    notifyStorefront([`/product/${p.slug}`]);
    return image;
  } catch (e) {
    await deleteStoredImage(stored.key);
    throw e;
  }
}

async function findImage(productId: string, imageId: string) {
  idParam.parse(productId);
  idParam.parse(imageId);
  const img = await prisma.productImage.findFirst({
    where: { id: imageId, productId },
    select: { id: true, isPrimary: true, storageKey: true, product: { select: { sku: true, slug: true, status: true } } },
  });
  if (!img) throw notFound('Image');
  return img;
}

export async function updateProductImage(actor: AdminContext, productId: string, imageId: string, raw: unknown) {
  const img = await findImage(productId, imageId);
  const { altText } = imageUpdateInput.parse(raw);
  await prisma.$transaction(async (tx) => {
    await tx.productImage.update({ where: { id: imageId }, data: { altText } });
    await audit(tx, actor, { action: 'Updated image alt text', category: 'MEDIA', entityType: 'Product', entityId: productId, details: img.product.sku });
  });
  notifyStorefront([`/product/${img.product.slug}`]);
}

export async function setPrimaryImage(actor: AdminContext, productId: string, imageId: string) {
  const img = await findImage(productId, imageId);
  await prisma.$transaction(async (tx) => {
    // Clear first: the partial unique index allows only one primary per product.
    await tx.productImage.updateMany({ where: { productId, isPrimary: true }, data: { isPrimary: false } });
    await tx.productImage.update({ where: { id: imageId }, data: { isPrimary: true } });
    await audit(tx, actor, { action: 'Set primary image', category: 'MEDIA', entityType: 'Product', entityId: productId, details: img.product.sku });
  });
  notifyStorefront(['/', '/shop', `/product/${img.product.slug}`]);
}

export async function reorderProductImages(actor: AdminContext, productId: string, raw: unknown) {
  idParam.parse(productId);
  const { imageIds } = imageOrderInput.parse(raw);
  const existing = await prisma.productImage.findMany({ where: { productId }, select: { id: true } });
  const set = new Set(existing.map((i) => i.id));
  if (imageIds.length !== set.size || !imageIds.every((id) => set.has(id))) {
    throw badRequest('Image order must list every image of this product exactly once');
  }
  await prisma.$transaction(async (tx) => {
    for (const [i, id] of imageIds.entries()) await tx.productImage.update({ where: { id }, data: { sortOrder: i } });
    await audit(tx, actor, { action: 'Reordered images', category: 'MEDIA', entityType: 'Product', entityId: productId, details: `${imageIds.length} images` });
  });
}

export async function deleteProductImage(actor: AdminContext, productId: string, imageId: string) {
  const img = await findImage(productId, imageId);
  const remaining = await prisma.productImage.count({ where: { productId } });
  if (remaining === 1 && img.product.status === 'ACTIVE') {
    throw badRequest('An active product needs at least one image. Unpublish it first or add another image.');
  }
  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } });
    if (img.isPrimary) {
      const next = await tx.productImage.findFirst({ where: { productId }, orderBy: { sortOrder: 'asc' }, select: { id: true } });
      if (next) await tx.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    await audit(tx, actor, { action: 'Removed product image', category: 'MEDIA', entityType: 'Product', entityId: productId, details: img.product.sku });
  });
  await deleteStoredImage(img.storageKey);
  notifyStorefront(['/', '/shop', `/product/${img.product.slug}`]);
}

/* ────────────────────────────── Price points ───────────────────────────── */

export const pricePointInput = z.object({
  amountPaise: paise,
  label: z.string().trim().min(1).max(30),
  isActive: z.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

export const listPricePoints = () =>
  prisma.pricePoint.findMany({
    orderBy: [{ displayOrder: 'asc' }, { amountPaise: 'asc' }],
    select: { id: true, amountPaise: true, label: true, isActive: true, displayOrder: true, _count: { select: { products: true } } },
  });

export async function createPricePoint(actor: AdminContext, raw: unknown) {
  const input = pricePointInput.parse(raw);
  return prisma.$transaction(async (tx) => {
    const pp = await tx.pricePoint.create({ data: input, select: { id: true, label: true } });
    await audit(tx, actor, { action: 'Created price point', category: 'PRODUCT', entityType: 'PricePoint', entityId: pp.id, details: pp.label });
    return pp;
  });
}

export async function updatePricePoint(actor: AdminContext, id: string, raw: unknown) {
  idParam.parse(id);
  const input = pricePointInput.partial().parse(raw);
  return prisma.$transaction(async (tx) => {
    const pp = await tx.pricePoint.update({ where: { id }, data: input, select: { id: true, label: true } });
    await audit(tx, actor, { action: 'Updated price point', category: 'PRODUCT', entityType: 'PricePoint', entityId: id, details: pp.label });
    return pp;
  });
}
