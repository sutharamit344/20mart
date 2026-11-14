import { prisma, type Prisma } from '@20mart/database';
import { slugify } from '@20mart/shared';
import { z } from 'zod';
import type { AdminContext } from '../auth/admin';
import { audit } from '../audit';
import { AppError, conflict, notFound } from '../errors';
import { deleteStoredImage, uploadImage } from '../media';
import { notifyStorefront } from '../revalidate';
import { catalogStatus, idParam, optionalText, pageQuery, slugField } from './common';

export const categoryInput = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugField.optional(),
  description: optionalText(500),
  status: catalogStatus.default('ACTIVE'),
  displayOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
  parentId: idParam.nullish().transform((v) => v ?? null),
});
export const categoryUpdate = categoryInput.partial();

export const categoryListQuery = pageQuery.extend({ status: catalogStatus.optional() });

const listSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  status: true,
  displayOrder: true,
  seoTitle: true,
  seoDescription: true,
  parentId: true,
  parent: { select: { name: true } },
  updatedAt: true,
  _count: { select: { products: true, children: true } },
} satisfies Prisma.CategorySelect;

export async function listCategories(query: z.infer<typeof categoryListQuery>) {
  const where: Prisma.CategoryWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { slug: { contains: query.q.toLowerCase() } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: listSelect,
    }),
    prisma.category.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

/** Lightweight options list for selects. */
export const categoryOptions = () =>
  prisma.category.findMany({
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, status: true, parentId: true },
  });

async function assertValidParent(parentId: string | null, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw new AppError(400, 'BAD_PARENT', 'A category cannot be its own parent');
  const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
  if (!parent) throw new AppError(400, 'BAD_PARENT', 'Parent category not found');
  // Keep the tree one level deep: a parent must itself be top-level.
  if (parent.parentId) throw new AppError(400, 'BAD_PARENT', 'Sub-categories cannot have children');
  if (selfId && (await prisma.category.count({ where: { parentId: selfId } })) > 0) {
    throw new AppError(400, 'BAD_PARENT', 'A category with sub-categories cannot become a sub-category');
  }
}

export async function createCategory(actor: AdminContext, raw: unknown) {
  const input = categoryInput.parse(raw);
  await assertValidParent(input.parentId);
  const slug = input.slug ?? slugify(input.name);
  const displayOrder =
    input.displayOrder ?? ((await prisma.category.aggregate({ _max: { displayOrder: true } }))._max.displayOrder ?? 0) + 1;
  const category = await prisma.$transaction(async (tx) => {
    const c = await tx.category.create({ data: { ...input, slug, displayOrder }, select: { id: true, name: true, slug: true } });
    await audit(tx, actor, { action: 'Created category', category: 'CATEGORY', entityType: 'Category', entityId: c.id, details: `${c.name} (${c.slug})` });
    return c;
  });
  notifyStorefront(['/', '/category', '/shop']);
  return category;
}

export async function updateCategory(actor: AdminContext, id: string, raw: unknown) {
  idParam.parse(id);
  const input = categoryUpdate.parse(raw);
  if (input.parentId !== undefined) await assertValidParent(input.parentId, id);
  const category = await prisma.$transaction(async (tx) => {
    const c = await tx.category.update({ where: { id }, data: input, select: { id: true, name: true, slug: true, status: true } });
    await audit(tx, actor, {
      action: 'Updated category',
      category: 'CATEGORY',
      entityType: 'Category',
      entityId: id,
      details: `${c.name}: ${Object.keys(input).join(', ')}`,
    });
    return c;
  });
  notifyStorefront(['/', '/category', `/category/${category.slug}`, '/shop']);
  return category;
}

/** Delete only empty categories; otherwise ask the admin to disable instead. */
export async function deleteCategory(actor: AdminContext, id: string) {
  idParam.parse(id);
  const c = await prisma.category.findUnique({
    where: { id },
    select: { name: true, slug: true, imageKey: true, _count: { select: { products: true, children: true } } },
  });
  if (!c) throw notFound('Category');
  if (c._count.products > 0 || c._count.children > 0) {
    throw conflict(
      `"${c.name}" still has ${c._count.products} product(s) and ${c._count.children} sub-categor(ies). Move them or disable the category instead.`
    );
  }
  await prisma.$transaction(async (tx) => {
    await tx.category.delete({ where: { id } });
    await audit(tx, actor, { action: 'Deleted category', category: 'CATEGORY', entityType: 'Category', entityId: id, details: c.name });
  });
  await deleteStoredImage(c.imageKey);
  notifyStorefront(['/', '/category', '/shop']);
}

/** Move a category up or down by swapping display order with its neighbour (transactional). */
export async function moveCategory(actor: AdminContext, id: string, direction: 'up' | 'down') {
  idParam.parse(id);
  await prisma.$transaction(async (tx) => {
    const all = await tx.category.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    });
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) throw notFound('Category');
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= all.length) return;
    [all[idx], all[swapWith]] = [all[swapWith], all[idx]];
    // Normalise to 1..n so orders stay dense and unique.
    for (const [i, c] of all.entries()) await tx.category.update({ where: { id: c.id }, data: { displayOrder: i + 1 } });
    await audit(tx, actor, { action: 'Reordered categories', category: 'CATEGORY', entityType: 'Category', entityId: id, details: `Moved ${direction}` });
  });
  notifyStorefront(['/', '/category']);
}

export async function setCategoryImage(actor: AdminContext, id: string, file: Blob) {
  idParam.parse(id);
  const existing = await prisma.category.findUnique({ where: { id }, select: { imageKey: true, name: true } });
  if (!existing) throw notFound('Category');
  const stored = await uploadImage(file, 'categories');
  try {
    await prisma.$transaction(async (tx) => {
      await tx.category.update({ where: { id }, data: { imageUrl: stored.url, imageKey: stored.key } });
      await audit(tx, actor, { action: 'Updated category image', category: 'MEDIA', entityType: 'Category', entityId: id, details: existing.name });
    });
  } catch (e) {
    await deleteStoredImage(stored.key);
    throw e;
  }
  await deleteStoredImage(existing.imageKey);
  notifyStorefront(['/', '/category']);
  return { imageUrl: stored.url };
}
