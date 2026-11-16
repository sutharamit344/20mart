import { beforeEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { prisma } from '@20mart/database';
import {
  addProductImage,
  addVariant,
  createProduct,
  deleteProduct,
  deleteProductImage,
  setPrimaryImage,
  setProductStatus,
  updateProduct,
} from '../src/catalog/products';
import { createBrand } from '../src/catalog/brands';
import { createCategory, deleteCategory, updateCategory } from '../src/catalog/categories';
import { listPublicProducts, getPublicProduct } from '../src/catalog/public';
import { adjustStock } from '../src/inventory';
import { resolveLocalPath } from '../src/storage';
import { sniffImageType } from '../src/media';
import { AppError, toAppError } from '../src/errors';
import type { AdminContext } from '../src/auth/admin';
import { adminRequest, adminSession, categoryId, ctxParams, makePng, resetDb, testWarehouse } from './helpers';

let actor: AdminContext;
let token: string;
beforeEach(async () => {
  await resetDb();
  ({ ctx: actor, token } = await adminSession('prodmgr', ['PRODUCT_MANAGER', 'INVENTORY_MANAGER']));
});

const base = async (over: Record<string, unknown> = {}) => ({
  name: 'Steel Peeler',
  sku: 'zm-ktc-001', // normalised to upper-case
  categoryId: await categoryId(),
  sellingPricePaise: 2000,
  mrpPaise: 3000,
  ...over,
});
const statusOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return toAppError(e).status;
  }
};
const pngBlob = (w = 300, h = 300, type = 'image/png') => new Blob([makePng(w, h)], { type });

describe('product management', () => {
  it('creates a draft product with integer paise, upper-case SKU, slug and no stock rows until stock is recorded at a warehouse', async () => {
    const p = await createProduct(actor, await base({ brandId: null }));
    const row = await prisma.product.findUniqueOrThrow({ where: { id: p.id }, include: { inventories: true } });
    expect(row.sku).toBe('ZM-KTC-001');
    expect(row.slug).toBe('steel-peeler');
    expect(row.status).toBe('DRAFT');
    expect(row.sellingPricePaise).toBe(2000);
    expect(row.brandId).toBeNull(); // brand is optional
    expect(row.inventories).toHaveLength(0);
    expect(await prisma.adminAuditLog.count({ where: { entityId: p.id } })).toBe(1);
  });

  it('edits a product and validates the combined price', async () => {
    const p = await createProduct(actor, await base());
    await updateProduct(actor, p.id, { name: 'Better Peeler', sellingPricePaise: 2500 });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).name).toBe('Better Peeler');
    expect(await statusOf(updateProduct(actor, p.id, { sellingPricePaise: 3500 }))).toBe(400); // > MRP 3000
  });

  it('rejects duplicate SKUs and slugs (409), including SKUs used by variants', async () => {
    await createProduct(actor, await base());
    expect(await statusOf(createProduct(actor, await base({ name: 'Other', slug: 'other' })))).toBe(409);
    expect(await statusOf(createProduct(actor, await base({ sku: 'ZM-NEW-1' })))).toBe(409); // same slug
    const p2 = await createProduct(actor, await base({ sku: 'ZM-NEW-2', slug: 'second' }));
    await addVariant(actor, p2.id, { name: 'Pack of 3', sku: 'ZM-VAR-1', sellingPricePaise: 5000, mrpPaise: 6000 });
    expect(await statusOf(createProduct(actor, await base({ sku: 'ZM-VAR-1', slug: 'third' })))).toBe(409);
  });

  it('rejects invalid prices: zero, negative, fractional paise, MRP below price', async () => {
    expect(await statusOf(createProduct(actor, await base({ sellingPricePaise: 0 })))).toBe(400);
    expect(await statusOf(createProduct(actor, await base({ sellingPricePaise: -100 })))).toBe(400);
    expect(await statusOf(createProduct(actor, await base({ sellingPricePaise: 20.5 })))).toBe(400);
    expect(await statusOf(createProduct(actor, await base({ mrpPaise: 1000 })))).toBe(400);
    expect(await prisma.product.count()).toBe(0);
  });

  it('requires an existing category and validates an optional brand', async () => {
    expect(await statusOf(createProduct(actor, await base({ categoryId: undefined })))).toBe(400);
    expect(await statusOf(createProduct(actor, await base({ categoryId: '00000000-0000-4000-8000-000000000000' })))).toBe(400);
    expect(await statusOf(createProduct(actor, await base({ brandId: '00000000-0000-4000-8000-000000000000' })))).toBe(400);
    const sa = (await adminSession('super', ['SUPER_ADMIN'])).ctx;
    const brand = await createBrand(sa, { name: 'HomeEase' });
    const p = await createProduct(actor, await base({ brandId: brand.id }));
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).brandId).toBe(brand.id);
  });

  it('activation requires an image; deactivation hides the product from the storefront', async () => {
    const p = await createProduct(actor, await base());
    expect(await statusOf(setProductStatus(actor, p.id, { status: 'ACTIVE' }))).toBe(400);
    await addProductImage(actor, p.id, pngBlob(), 'Peeler');
    await setProductStatus(actor, p.id, { status: 'ACTIVE' });
    expect((await listPublicProducts()).items.map((i) => i.id)).toEqual([p.id]);
    expect((await getPublicProduct('steel-peeler'))?.stockState).toBe('OUT'); // no fake stock
    await setProductStatus(actor, p.id, { status: 'INACTIVE' });
    expect((await listPublicProducts()).total).toBe(0);
    expect(await getPublicProduct('steel-peeler')).toBeNull();
  });

  it('hides products whose category is disabled, and blocks deleting categories that contain products', async () => {
    const p = await createProduct(actor, await base());
    await addProductImage(actor, p.id, pngBlob());
    await setProductStatus(actor, p.id, { status: 'ACTIVE' });
    const sa = (await adminSession('super', ['SUPER_ADMIN'])).ctx;
    const catId = await categoryId();
    expect(await statusOf(deleteCategory(sa, catId))).toBe(409);
    await updateCategory(sa, catId, { status: 'INACTIVE' });
    expect((await listPublicProducts()).total).toBe(0);
    const empty = await createCategory(sa, { name: 'Seasonal' });
    await deleteCategory(sa, empty.id);
    expect(await prisma.category.findUnique({ where: { id: empty.id } })).toBeNull();
    expect(await statusOf(createCategory(sa, { name: 'Kitchen' }))).toBe(409); // duplicate slug
  });

  it('hard-deletes clean drafts but archives products with stock history', async () => {
    const draft = await createProduct(actor, await base());
    expect((await deleteProduct(actor, draft.id)).mode).toBe('deleted');
    const kept = await createProduct(actor, await base({ sku: 'ZM-KEEP', slug: 'keep' }));
    const inv = { id: await prisma.$transaction(async (tx) => (await import('../src/inventory')).ensureInventoryRow(tx, (await testWarehouse()).id, kept.id, null)) };
    await adjustStock(actor, inv.id, { type: 'INITIAL_STOCK', quantity: 5, reason: 'Opening stock' });
    expect((await deleteProduct(actor, kept.id)).mode).toBe('archived');
    expect((await prisma.product.findUniqueOrThrow({ where: { id: kept.id } })).status).toBe('ARCHIVED');
  });
});

describe('product images', () => {
  it('uploads to storage before writing the DB row, manages primary/order, and removes files', async () => {
    const p = await createProduct(actor, await base());
    const a = await addProductImage(actor, p.id, pngBlob(400, 300), 'Front');
    const b = await addProductImage(actor, p.id, pngBlob(), 'Back');
    expect(a.isPrimary).toBe(true);
    expect(b.isPrimary).toBe(false);
    const rows = await prisma.productImage.findMany({ where: { productId: p.id } });
    for (const r of rows) {
      expect(r.mimeType).toBe('image/png');
      expect(existsSync(resolveLocalPath(r.storageKey!))).toBe(true);
    }
    expect(rows.find((r) => r.id === a.id)?.width).toBe(400);
    await setPrimaryImage(actor, p.id, b.id);
    expect((await prisma.productImage.findMany({ where: { productId: p.id, isPrimary: true } })).map((i) => i.id)).toEqual([b.id]);
    const keyA = rows.find((r) => r.id === a.id)!.storageKey!;
    await deleteProductImage(actor, p.id, a.id);
    expect(existsSync(resolveLocalPath(keyA))).toBe(false);
  });

  it('rejects spoofed types, non-images, oversize files and tiny images (nothing stored)', async () => {
    const p = await createProduct(actor, await base());
    expect(await statusOf(addProductImage(actor, p.id, pngBlob(300, 300, 'image/jpeg')))).toBe(400); // PNG bytes declared as JPEG
    expect(await statusOf(addProductImage(actor, p.id, new Blob(['<svg onload=alert(1)>'], { type: 'image/png' })))).toBe(400);
    expect(await statusOf(addProductImage(actor, p.id, new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' })))).toBe(400);
    expect(await statusOf(addProductImage(actor, p.id, pngBlob(40, 40)))).toBe(400);
    expect(await prisma.productImage.count()).toBe(0);
    expect(sniffImageType(makePng(1, 1))).toBe('image/png');
    expect(sniffImageType(new TextEncoder().encode('GIF89a-not-allowed'))).toBeNull();
  });

  it('upload endpoint enforces media.upload + products.update through the real route', async () => {
    const p = await createProduct(actor, await base());
    const { POST } = await import('../../../apps/20martadmin/src/app/api/admin/products/[id]/images/route');
    const form = new FormData();
    form.append('file', new File([makePng(300, 300)], 'p.png', { type: 'image/png' }));
    const ok = await POST(adminRequest(`/api/admin/products/${p.id}/images`, { method: 'POST', token, form }), ctxParams({ id: p.id }));
    expect(ok.status).toBe(201);
    const inv = await adminSession('inv', ['INVENTORY_MANAGER']);
    const form2 = new FormData();
    form2.append('file', new File([makePng(300, 300)], 'p.png', { type: 'image/png' }));
    const denied = await POST(adminRequest(`/api/admin/products/${p.id}/images`, { method: 'POST', token: inv.token, form: form2 }), ctxParams({ id: p.id }));
    expect(denied.status).toBe(403);
  });
});

describe('error mapping', () => {
  it('never leaks internal errors', () => {
    const e = toAppError(new Error('connection string postgres://user:pass@host'));
    expect(e.status).toBe(500);
    expect(e.message).not.toContain('postgres');
    expect(e).toBeInstanceOf(AppError);
  });
});
