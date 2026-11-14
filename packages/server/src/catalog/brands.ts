import { prisma, type Prisma } from '@20mart/database';
import { slugify } from '@20mart/shared';
import { z } from 'zod';
import type { AdminContext } from '../auth/admin';
import { audit } from '../audit';
import { conflict, notFound } from '../errors';
import { deleteStoredImage, uploadImage } from '../media';
import { notifyStorefront } from '../revalidate';
import { catalogStatus, idParam, optionalText, pageQuery, slugField } from './common';

export const brandInput = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugField.optional(),
  description: optionalText(500),
  status: catalogStatus.default('ACTIVE'),
});
export const brandUpdate = brandInput.partial();
export const brandListQuery = pageQuery.extend({ status: catalogStatus.optional() });

export async function listBrands(query: z.infer<typeof brandListQuery>) {
  const where: Prisma.BrandWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.brand.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logoUrl: true,
        status: true,
        updatedAt: true,
        _count: { select: { products: true } },
      },
    }),
    prisma.brand.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export const brandOptions = () =>
  prisma.brand.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, status: true } });

export async function createBrand(actor: AdminContext, raw: unknown) {
  const input = brandInput.parse(raw);
  const slug = input.slug ?? slugify(input.name);
  return prisma.$transaction(async (tx) => {
    const b = await tx.brand.create({ data: { ...input, slug }, select: { id: true, name: true, slug: true } });
    await audit(tx, actor, { action: 'Created brand', category: 'BRAND', entityType: 'Brand', entityId: b.id, details: b.name });
    return b;
  });
}

export async function updateBrand(actor: AdminContext, id: string, raw: unknown) {
  idParam.parse(id);
  const input = brandUpdate.parse(raw);
  const b = await prisma.$transaction(async (tx) => {
    const b = await tx.brand.update({ where: { id }, data: input, select: { id: true, name: true, slug: true, status: true } });
    await audit(tx, actor, { action: 'Updated brand', category: 'BRAND', entityType: 'Brand', entityId: id, details: `${b.name}: ${Object.keys(input).join(', ')}` });
    return b;
  });
  notifyStorefront(['/', '/shop']);
  return b;
}

export async function deleteBrand(actor: AdminContext, id: string) {
  idParam.parse(id);
  const b = await prisma.brand.findUnique({ where: { id }, select: { name: true, logoKey: true, _count: { select: { products: true } } } });
  if (!b) throw notFound('Brand');
  if (b._count.products > 0) {
    throw conflict(`"${b.name}" is used by ${b._count.products} product(s). Reassign them or disable the brand instead.`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.brand.delete({ where: { id } });
    await audit(tx, actor, { action: 'Deleted brand', category: 'BRAND', entityType: 'Brand', entityId: id, details: b.name });
  });
  await deleteStoredImage(b.logoKey);
}

export async function setBrandLogo(actor: AdminContext, id: string, file: Blob) {
  idParam.parse(id);
  const existing = await prisma.brand.findUnique({ where: { id }, select: { logoKey: true, name: true } });
  if (!existing) throw notFound('Brand');
  const stored = await uploadImage(file, 'brands');
  try {
    await prisma.$transaction(async (tx) => {
      await tx.brand.update({ where: { id }, data: { logoUrl: stored.url, logoKey: stored.key } });
      await audit(tx, actor, { action: 'Updated brand logo', category: 'MEDIA', entityType: 'Brand', entityId: id, details: existing.name });
    });
  } catch (e) {
    await deleteStoredImage(stored.key);
    throw e;
  }
  await deleteStoredImage(existing.logoKey);
  return { logoUrl: stored.url };
}
