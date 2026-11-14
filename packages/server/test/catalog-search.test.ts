import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@20mart/database';
import { listPublicBrands, listPublicProducts, searchSuggestions } from '../src/catalog/public';
import { makeSellable, resetDb } from './helpers';

beforeEach(async () => {
  await resetDb();
  const brand = await prisma.brand.create({ data: { name: 'HomeEase', slug: 'homeease' } });
  const pp20 = await prisma.pricePoint.findUniqueOrThrow({ where: { amountPaise: 2000 } });
  await makeSellable({ sku: 'ZM-PEEL-1', name: 'Steel Peeler', pricePaise: 2000, mrpPaise: 3000, featured: true });
  await makeSellable({ sku: 'ZM-BASK-2', name: 'Storage Basket', pricePaise: 6000, brandId: brand.id, category: 'home' });
  await makeSellable({ sku: 'ZM-CLIP-3', name: 'Bag Clips', pricePaise: 4000, stock: 0 });
  await makeSellable({ sku: 'ZM-NOTE-4', name: 'Notebook A5', pricePaise: 10000 });
  await prisma.product.update({ where: { sku: 'ZM-PEEL-1' }, data: { pricePointId: pp20.id } });
  await prisma.product.create({
    data: { name: 'Hidden Draft Peeler', slug: 'hidden', sku: 'ZM-DRAFT-9', categoryId: (await prisma.category.findFirstOrThrow()).id, sellingPricePaise: 2000, mrpPaise: 2000, status: 'DRAFT' },
  });
});

const names = (r: { items: { name: string }[] }) => r.items.map((i) => i.name);

describe('product search', () => {
  it('matches name, SKU, brand and category, and never returns drafts', async () => {
    expect(names(await listPublicProducts({ q: 'peeler' }))).toEqual(['Steel Peeler']);
    expect(names(await listPublicProducts({ q: 'zm-clip' }))).toEqual(['Bag Clips']);
    expect(names(await listPublicProducts({ q: 'homeease' }))).toEqual(['Storage Basket']);
    expect(names(await listPublicProducts({ q: 'home' }))).toContain('Storage Basket'); // category name
    expect((await listPublicProducts({ q: 'nothing-matches-this' })).total).toBe(0);
    expect((await searchSuggestions('ZM-NOTE')).map((s) => s.name)).toEqual(['Notebook A5']);
  });
});

describe('filters and sorting', () => {
  it('filters by brand, price range, price point, availability and category — combined', async () => {
    expect(names(await listPublicProducts({ brand: 'homeease' }))).toEqual(['Storage Basket']);
    expect(names(await listPublicProducts({ minPrice: 3000, maxPrice: 6000, sort: 'price_asc' }))).toEqual(['Bag Clips', 'Storage Basket']);
    expect(names(await listPublicProducts({ pricePoint: 2000 }))).toEqual(['Steel Peeler']);
    expect(names(await listPublicProducts({ inStock: true, sort: 'name_asc' }))).toEqual(['Notebook A5', 'Steel Peeler', 'Storage Basket']);
    expect(names(await listPublicProducts({ category: 'kitchen', inStock: true, sort: 'price_desc' }))).toEqual(['Notebook A5', 'Steel Peeler']);
  });

  it('sorts by price, name, newest and featured, and paginates', async () => {
    expect(names(await listPublicProducts({ sort: 'price_asc' }))).toEqual(['Steel Peeler', 'Bag Clips', 'Storage Basket', 'Notebook A5']);
    expect(names(await listPublicProducts({ sort: 'price_desc' }))[0]).toBe('Notebook A5');
    expect(names(await listPublicProducts({ sort: 'name_asc' }))[0]).toBe('Bag Clips');
    expect(names(await listPublicProducts({ sort: 'featured' }))[0]).toBe('Steel Peeler');
    const p1 = await listPublicProducts({ sort: 'name_asc', pageSize: 3, page: 1 });
    const p2 = await listPublicProducts({ sort: 'name_asc', pageSize: 3, page: 2 });
    expect(p1.total).toBe(4);
    expect(p1.items).toHaveLength(3);
    expect(names(p2)).toEqual(['Storage Basket']);
  });

  it('reports availability without exposing counts, and lists brands with visible products', async () => {
    const all = await listPublicProducts({ sort: 'name_asc' });
    expect(all.items.find((i) => i.name === 'Bag Clips')?.stockState).toBe('OUT');
    expect(JSON.stringify(all)).not.toMatch(/availableQuantity|reservedQuantity/);
    expect(await listPublicBrands()).toEqual([{ name: 'HomeEase', slug: 'homeease', productCount: 1 }]);
  });
});
