'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, ConfirmDialog, resolveImageSrc } from '@20mart/ui';
import { discountPercent, paiseToRupeeInput, parseRupeesToPaise, slugify } from '@20mart/shared';
import { ArrowDown, ArrowLeft, ArrowUp, ImagePlus, Loader2, Plus, Star, Trash2, Boxes } from 'lucide-react';
import { api, ApiError, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { formatINR, inputCls, labelCls, Panel, StatusBadge, textareaCls } from '../../../components/ui';
import { precheckImage } from '../../../components/ImageUploadField';
import { IconBtn } from '../categories/CategoriesTable';

type Status = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface EditorProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  shortDescription: string | null;
  categoryId: string;
  brandId: string | null;
  pricePointId: string | null;
  sellingPricePaise: number;
  mrpPaise: number;
  status: Status;
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  images: { id: string; url: string; altText: string | null; isPrimary: boolean; sortOrder: number; width: number | null; height: number | null }[];
  variants: {
    id: string;
    name: string;
    sku: string;
    sellingPricePaise: number;
    mrpPaise: number;
    status: 'ACTIVE' | 'INACTIVE';
    sortOrder: number;
    inventories: { availableQuantity: number; reservedQuantity: number }[];
  }[];
  stock: { onHand: number; sellable: number; state: 'IN_STOCK' | 'LOW' | 'OUT' };
}

interface Option {
  id: string;
  name: string;
  status?: string;
}

export interface EditorPerms {
  create: boolean;
  update: boolean;
  remove: boolean;
  upload: boolean;
  inventory: boolean;
}

export function ProductEditor({
  product,
  categories,
  brands,
  pricePoints,
  perms,
}: {
  product: EditorProduct | null;
  categories: Option[];
  brands: Option[];
  pricePoints: { id: string; label: string; amountPaise: number; isActive: boolean }[];
  perms: EditorPerms;
}) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const isNew = !product;
  const readOnly = isNew ? !perms.create : !perms.update;

  const [form, setForm] = useState({
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    sku: product?.sku ?? '',
    shortDescription: product?.shortDescription ?? '',
    description: product?.description ?? '',
    categoryId: product?.categoryId ?? categories.find((c) => c.status === 'ACTIVE')?.id ?? '',
    brandId: product?.brandId ?? '',
    pricePointId: product?.pricePointId ?? '',
    selling: product ? paiseToRupeeInput(product.sellingPricePaise) : '',
    mrp: product ? paiseToRupeeInput(product.mrpPaise) : '',
    isFeatured: product?.isFeatured ?? false,
    seoTitle: product?.seoTitle ?? '',
    seoDescription: product?.seoDescription ?? '',
  });
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const sellingPaise = parseRupeesToPaise(form.selling);
  const mrpPaise = parseRupeesToPaise(form.mrp);
  const priceError =
    form.selling && sellingPaise === null
      ? 'Enter a valid amount, e.g. 20 or 19.50'
      : sellingPaise === 0
        ? 'Must be greater than ₹0'
        : form.mrp && mrpPaise === null
          ? 'Enter a valid MRP'
          : sellingPaise && mrpPaise && mrpPaise < sellingPaise
            ? 'MRP must be ≥ selling price'
            : null;
  const discount = sellingPaise && mrpPaise ? discountPercent(sellingPaise, mrpPaise) : 0;

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'name' && !slugTouched) next.slug = slugify(String(v));
      if (k === 'selling') {
        // Suggest the matching price point when the price equals one.
        const p = parseRupeesToPaise(String(v));
        const match = pricePoints.find((pp) => pp.amountPaise === p);
        if (match) next.pricePointId = match.id;
      }
      return next;
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (priceError || sellingPaise === null || mrpPaise === null) {
      setError(priceError ?? 'Enter the selling price and MRP');
      return;
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const body = {
      name: form.name,
      slug: form.slug,
      sku: form.sku,
      shortDescription: form.shortDescription,
      description: form.description,
      categoryId: form.categoryId,
      brandId: form.brandId || null,
      pricePointId: form.pricePointId || null,
      sellingPricePaise: sellingPaise,
      mrpPaise,
      isFeatured: form.isFeatured,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
    };
    try {
      if (isNew) {
        const created = await api<{ id: string }>('/api/admin/products', { body });
        showToast('Product created as draft. Add images, then publish.');
        router.replace(`/products/${created.id}`);
      } else {
        await api(`/api/admin/products/${product.id}`, { method: 'PATCH', body });
        showToast('Product saved');
        router.refresh();
      }
    } catch (err) {
      setError(errMsg(err));
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  const fe = (k: string) => fieldErrors[k]?.[0] && <p className="mt-0.5 text-2xs text-danger">{fieldErrors[k][0]}</p>;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/products" className="rounded-lg p-1.5 text-ink-500 hover:bg-surface-muted" aria-label="Back to products">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="truncate text-lg sm:text-xl font-extrabold text-ink">{isNew ? 'New product' : product.name}</h1>
          {product && <StatusBadge status={product.status} />}
        </div>
        {product && <StatusControls product={product} perms={perms} />}
      </div>

      <form onSubmit={save} className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 items-start">
        <fieldset disabled={readOnly} className="lg:col-span-2 space-y-3 sm:space-y-4 min-w-0">
          {error && (
            <p role="alert" className="rounded-lg border border-danger-line bg-danger-soft p-2.5 text-xs text-danger">
              {error}
            </p>
          )}
          <Panel title="Basics" bodyClassName="p-3 sm:p-4 space-y-3 text-xs">
            <div>
              <label className={labelCls}>Product name *</label>
              <input className={inputCls} required maxLength={150} value={form.name} onChange={(e) => set('name', e.target.value)} />
              {fe('name')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>SKU *</label>
                <input
                  className={`${inputCls} font-mono uppercase`}
                  required
                  maxLength={40}
                  placeholder="e.g. ZM-KTC-010"
                  value={form.sku}
                  onChange={(e) => set('sku', e.target.value.toUpperCase())}
                />
                {fe('sku')}
              </div>
              <div>
                <label className={labelCls}>URL slug *</label>
                <input
                  className={`${inputCls} font-mono`}
                  required
                  maxLength={80}
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set('slug', e.target.value.toLowerCase());
                  }}
                />
                {fe('slug')}
              </div>
            </div>
            <div>
              <label className={labelCls}>Short description ({form.shortDescription.length}/300)</label>
              <textarea className={textareaCls} rows={2} maxLength={300} value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Full description</label>
              <textarea className={textareaCls} rows={5} maxLength={5000} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
          </Panel>

          <Panel title="Pricing" bodyClassName="p-3 sm:p-4 space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Selling price (₹) *</label>
                <input className={inputCls} inputMode="decimal" required placeholder="20" value={form.selling} onChange={(e) => set('selling', e.target.value)} />
                {fe('sellingPricePaise')}
              </div>
              <div>
                <label className={labelCls}>MRP (₹) *</label>
                <input className={inputCls} inputMode="decimal" required placeholder="30" value={form.mrp} onChange={(e) => set('mrp', e.target.value)} />
                {fe('mrpPaise')}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Price point</label>
                <select className={inputCls} value={form.pricePointId} onChange={(e) => set('pricePointId', e.target.value)}>
                  <option value="">None</option>
                  {pricePoints.map((pp) => (
                    <option key={pp.id} value={pp.id} disabled={!pp.isActive && pp.id !== form.pricePointId}>
                      {pp.label}
                      {!pp.isActive ? ' (inactive)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className={`text-2xs ${priceError ? 'text-danger' : 'text-ink-500'}`}>
              {priceError ??
                (sellingPaise && mrpPaise
                  ? `Customer pays ${formatINR(sellingPaise)}${discount ? ` · ${discount}% off MRP ${formatINR(mrpPaise)}` : ''}`
                  : 'Prices are stored in paise — no rounding errors.')}
            </p>
          </Panel>

          <Panel title="SEO" bodyClassName="p-3 sm:p-4 space-y-3 text-xs">
            <div>
              <label className={labelCls}>SEO title ({form.seoTitle.length}/70)</label>
              <input className={inputCls} maxLength={70} placeholder={form.name} value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>SEO description ({form.seoDescription.length}/160)</label>
              <textarea className={textareaCls} rows={2} maxLength={160} value={form.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} />
            </div>
          </Panel>
        </fieldset>

        <div className="space-y-3 sm:space-y-4 min-w-0">
          <fieldset disabled={readOnly}>
            <Panel title="Organisation" bodyClassName="p-3 sm:p-4 space-y-3 text-xs">
              <div>
                <label className={labelCls}>Category *</label>
                <select className={inputCls} required value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                  <option value="" disabled>
                    Select a category
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.status === 'INACTIVE' ? ' (disabled)' : ''}
                    </option>
                  ))}
                </select>
                {fe('categoryId')}
              </div>
              <div>
                <label className={labelCls}>Brand (optional)</label>
                <select className={inputCls} value={form.brandId} onChange={(e) => set('brandId', e.target.value)}>
                  <option value="">No brand / unbranded</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.status === 'INACTIVE' ? ' (disabled)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-ink-700">
                <input type="checkbox" className="h-4 w-4 accent-brand-orange" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} />
                Featured on homepage
              </label>
            </Panel>
          </fieldset>

          {!readOnly && (
            <Button type="submit" variant="brand" size="md" isLoading={saving} className="w-full">
              {isNew ? 'Create draft product' : 'Save changes'}
            </Button>
          )}

          {product && (
            <Panel
              title="Stock"
              actions={
                perms.inventory ? (
                  <Link href={`/inventory?q=${encodeURIComponent(product.sku)}`} className="inline-flex items-center gap-1 text-2xs font-semibold text-brand-orange-600 hover:underline">
                    <Boxes className="w-3 h-3" /> Manage
                  </Link>
                ) : null
              }
              bodyClassName="p-3 sm:p-4 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-ink-500">Sellable units</span>
                <span className="flex items-center gap-2 font-bold text-ink">
                  {product.stock.sellable} <StatusBadge status={product.stock.state} />
                </span>
              </div>
            </Panel>
          )}
        </div>
      </form>

      {product && <ImageManager product={product} canEdit={perms.update && perms.upload} canDelete={perms.update} />}
      {product && <VariantManager product={product} canEdit={perms.update} />}
    </div>
  );
}

/* ───────────────────────────── Status controls ───────────────────────────── */

function StatusControls({ product, perms }: { product: EditorProduct; perms: EditorPerms }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const setStatus = async (status: Status) => {
    setBusy(true);
    try {
      await api(`/api/admin/products/${product.id}/status`, { body: { status } });
      showToast(status === 'ACTIVE' ? 'Published — now visible on the storefront' : `Status set to ${status.toLowerCase()}`);
      router.refresh();
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  if (!perms.update) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {product.status !== 'ACTIVE' && product.status !== 'ARCHIVED' && (
        <Button size="sm" variant="primary" isLoading={busy} onClick={() => setStatus('ACTIVE')} disabled={product.images.length === 0} title={product.images.length === 0 ? 'Add an image first' : undefined}>
          Publish
        </Button>
      )}
      {product.status === 'ACTIVE' && (
        <Button size="sm" variant="outline" isLoading={busy} onClick={() => setStatus('INACTIVE')}>
          Unpublish
        </Button>
      )}
      {product.status === 'ARCHIVED' && (
        <Button size="sm" variant="outline" isLoading={busy} onClick={() => setStatus('DRAFT')}>
          Restore as draft
        </Button>
      )}
      {product.status !== 'ARCHIVED' && perms.remove && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus('ARCHIVED')}>
          Archive
        </Button>
      )}
    </div>
  );
}

/* ───────────────────────────── Images ───────────────────────────── */

function ImageManager({ product, canEdit, canDelete }: { product: EditorProduct; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const images = useMemo(() => [...product.images].sort((a, b) => a.sortOrder - b.sortOrder), [product.images]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      showToast(ok);
      router.refresh();
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (files: FileList) => {
    const list = Array.from(files).slice(0, 12);
    let ok = 0;
    for (const file of list) {
      const pre = precheckImage(file);
      if (pre) {
        showToast(`${file.name}: ${pre}`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('altText', product.name);
        await api(`/api/admin/products/${product.id}/images`, { form });
        ok++;
      } catch (e) {
        showToast(`${file.name}: ${errMsg(e)}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (input.current) input.current.value = '';
    if (ok) {
      showToast(`${ok} image${ok > 1 ? 's' : ''} uploaded`);
      router.refresh();
    }
  };

  const move = (idx: number, dir: -1 | 1) => {
    const ids = images.map((i) => i.id);
    [ids[idx], ids[idx + dir]] = [ids[idx + dir], ids[idx]];
    run(() => api(`/api/admin/products/${product.id}/images/order`, { method: 'PUT', body: { imageIds: ids } }), 'Order saved');
  };

  const saveAlt = (id: string, altText: string) =>
    run(() => api(`/api/admin/products/${product.id}/images/${id}`, { method: 'PATCH', body: { altText } }), 'Alt text saved');

  return (
    <Panel
      title={`Images (${images.length}/12)`}
      actions={
        canEdit ? (
          <>
            <Button size="sm" variant="outline" leftIcon={uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />} disabled={!!uploading || images.length >= 12} onClick={() => input.current?.click()}>
              {uploading ? `Uploading ${uploading}…` : 'Add images'}
            </Button>
            <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
          </>
        ) : null
      }
      bodyClassName="p-3 sm:p-4"
    >
      {images.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-500">No images yet. Products need at least one image to be published.</p>
      ) : (
        <ul className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5 ${busy ? 'opacity-60' : ''}`}>
          {images.map((img, idx) => (
            <li key={img.id} className={`rounded-lg border bg-surface p-1.5 ${img.isPrimary ? 'border-brand-orange ring-1 ring-brand-orange/30' : 'border-line'}`}>
              <div className="relative aspect-square overflow-hidden rounded-md bg-surface-page">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveImageSrc(img.url)} alt={img.altText ?? ''} className="h-full w-full object-contain" loading="lazy" />
                {img.isPrimary && (
                  <span className="absolute left-1 top-1 rounded bg-brand-orange px-1.5 py-0.5 text-2xs font-bold text-white">Primary</span>
                )}
              </div>
              <input
                aria-label="Alt text"
                defaultValue={img.altText ?? ''}
                disabled={!canEdit}
                maxLength={150}
                placeholder="Alt text"
                onBlur={(e) => e.target.value !== (img.altText ?? '') && saveAlt(img.id, e.target.value)}
                className="mt-1.5 h-7 w-full rounded border border-line px-1.5 text-2xs focus:border-brand-green focus:outline-none"
              />
              {canEdit && (
                <div className="mt-1 flex items-center justify-between">
                  <div className="flex">
                    <IconBtn label="Move left" disabled={idx === 0 || busy} onClick={() => move(idx, -1)}>
                      <ArrowUp className="w-3 h-3 -rotate-90" />
                    </IconBtn>
                    <IconBtn label="Move right" disabled={idx === images.length - 1 || busy} onClick={() => move(idx, 1)}>
                      <ArrowDown className="w-3 h-3 -rotate-90" />
                    </IconBtn>
                  </div>
                  <div className="flex">
                    {!img.isPrimary && (
                      <IconBtn label="Make primary" disabled={busy} onClick={() => run(() => api(`/api/admin/products/${product.id}/images/${img.id}/primary`, { body: {} }), 'Primary image set')}>
                        <Star className="w-3 h-3" />
                      </IconBtn>
                    )}
                    {canDelete && (
                      <IconBtn label="Remove image" danger disabled={busy} onClick={() => setRemoveId(img.id)}>
                        <Trash2 className="w-3 h-3" />
                      </IconBtn>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        isOpen={!!removeId}
        title="Remove image?"
        message="The image will be removed from this product and deleted from storage."
        confirmText="Remove"
        variant="danger"
        onCancel={() => setRemoveId(null)}
        onConfirm={() => {
          const id = removeId!;
          setRemoveId(null);
          run(() => api(`/api/admin/products/${product.id}/images/${id}`, { method: 'DELETE' }), 'Image removed');
        }}
      />
    </Panel>
  );
}

/* ───────────────────────────── Variants ───────────────────────────── */

function VariantManager({ product, canEdit }: { product: EditorProduct; canEdit: boolean }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [draft, setDraft] = useState({ name: '', sku: '', selling: '', mrp: '' });
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      const res = (await fn()) as { mode?: string } | undefined;
      showToast(res?.mode === 'deactivated' ? 'Variant has stock history, so it was deactivated instead' : ok);
      router.refresh();
      return true;
    } catch (e) {
      showToast(errMsg(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = parseRupeesToPaise(draft.selling);
    const m = parseRupeesToPaise(draft.mrp || draft.selling);
    if (!s || !m || m < s) return showToast('Enter valid prices (MRP ≥ selling price)');
    const ok = await run(
      () => api(`/api/admin/products/${product.id}/variants`, { body: { name: draft.name, sku: draft.sku, sellingPricePaise: s, mrpPaise: m, sortOrder: product.variants.length } }),
      'Variant added'
    );
    if (ok) setDraft({ name: '', sku: '', selling: '', mrp: '' });
  };

  return (
    <Panel title={`Variants (${product.variants.length})`} bodyClassName="p-3 sm:p-4 space-y-3 text-xs">
      <p className="text-2xs text-ink-500">
        Optional — e.g. pack sizes or volumes. When a product has variants, stock is tracked per variant.
      </p>
      {product.variants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead className="text-2xs uppercase text-ink-500">
              <tr>
                <th className="py-1.5 pr-2">Name</th>
                <th className="py-1.5 pr-2">SKU</th>
                <th className="py-1.5 pr-2 text-right">Price</th>
                <th className="py-1.5 pr-2 text-right">Stock</th>
                <th className="py-1.5 pr-2">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {product.variants.map((v) => {
                // Unreserved units summed across all warehouses (per-warehouse detail lives on the Inventory page).
                const unreserved = v.inventories.reduce((a, i) => a + i.availableQuantity - i.reservedQuantity, 0);
                return (
                  <tr key={v.id}>
                    <td className="py-2 pr-2 font-semibold text-ink">{v.name}</td>
                    <td className="py-2 pr-2 font-mono text-2xs text-ink-500">{v.sku}</td>
                    <td className="py-2 pr-2 text-right">
                      {formatINR(v.sellingPricePaise)}
                      {v.mrpPaise > v.sellingPricePaise && <span className="ml-1 text-2xs text-ink-400 line-through">{formatINR(v.mrpPaise)}</span>}
                    </td>
                    <td className="py-2 pr-2 text-right">{unreserved}</td>
                    <td className="py-2 pr-2">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => run(() => api(`/api/admin/products/${product.id}/variants/${v.id}`, { method: 'PATCH', body: { status: v.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } }), 'Variant updated')}
                            className="rounded px-1.5 py-1 text-2xs font-semibold text-ink-600 hover:bg-surface-muted"
                          >
                            {v.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                          </button>
                          <IconBtn label="Delete variant" danger disabled={busy} onClick={() => run(() => api(`/api/admin/products/${product.id}/variants/${v.id}`, { method: 'DELETE' }), 'Variant deleted')}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </IconBtn>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && (
        <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end rounded-lg bg-surface-page p-2.5">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelCls}>Variant name</label>
            <input className={inputCls} required maxLength={80} placeholder="Pack of 3" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelCls}>SKU</label>
            <input className={`${inputCls} font-mono uppercase`} required maxLength={40} value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className={labelCls}>Price (₹)</label>
            <input className={inputCls} required inputMode="decimal" value={draft.selling} onChange={(e) => setDraft({ ...draft, selling: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>MRP (₹)</label>
            <input className={inputCls} inputMode="decimal" placeholder="= price" value={draft.mrp} onChange={(e) => setDraft({ ...draft, mrp: e.target.value })} />
          </div>
          <Button type="submit" size="sm" variant="outline" isLoading={busy} leftIcon={<Plus className="w-3.5 h-3.5" />} className="col-span-2 sm:col-span-1 h-9">
            Add variant
          </Button>
        </form>
      )}
    </Panel>
  );
}
