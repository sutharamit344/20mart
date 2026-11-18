'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Download, FileSpreadsheet, FolderOpen, Loader2, Play, RotateCcw, Square, XCircle } from 'lucide-react';
import { parseRupeesToPaise, SKU_REGEX, SLUG_REGEX, slugify } from '@20mart/shared';
import { api, ApiError, errMsg } from '../../../../lib/api';
import { readSheet, type SheetRow } from '../../../../lib/sheet';
import { formatINR, inputCls, labelCls, Panel, Table, TBody, Td, Th, THead } from '../../../../components/ui';
import { precheckImage } from '../../../../components/ImageUploadField';

interface CategoryOpt {
  id: string;
  name: string;
  active: boolean;
  parentName: string | null;
}
interface WarehouseOpt {
  id: string;
  name: string;
  code: string;
  status: string;
}
interface PricePointOpt {
  id: string;
  amountPaise: number;
  isActive: boolean;
}

/* ───────────────────────────── column mapping ───────────────────────────── */

const COLUMNS = {
  sku: ['sku'],
  name: ['product title', 'product name', 'name', 'title'],
  handle: ['handle', 'slug'],
  category: ['category'],
  description: ['description'],
  feature1: ['feature 1'],
  feature2: ['feature 2'],
  feature3: ['feature 3'],
  variantName: ['variant name'],
  packSize: ['pack size'],
  price: ['selling price inr', 'selling price', 'price'],
  mrp: ['mrp inr', 'mrp'],
  qty: ['inventory qty', 'stock', 'quantity', 'qty'],
  image: ['image path', 'image', 'image file'],
} as const;
type Field = keyof typeof COLUMNS;
const pick = (r: SheetRow, f: Field) => {
  for (const k of COLUMNS[f]) if (r[k] !== undefined) return r[k];
  return '';
};

const TEMPLATE_HEADERS = ['SKU', 'Product Title', 'Handle', 'Category', 'Description', 'Feature 1', 'Feature 2', 'Feature 3', 'Variant Name', 'Pack Size', 'Selling Price INR', 'MRP INR', 'Inventory Qty', 'Image Path'];
const TEMPLATE_EXAMPLE = ['20M-KT-001', 'Steel Measuring Spoon Set', 'steel-measuring-spoon-set', 'Kitchen', 'Set of four stainless steel measuring spoons.', 'Four sizes', 'Rust resistant', 'Dishwasher safe', 'Set of 4', '4 spoons', '60', '79', '100', 'images/measuring-spoons/product.png'];

interface PlanRow {
  line: number;
  sku: string;
  name: string;
  slug: string;
  fileCategory: string;
  description: string;
  shortDescription: string;
  pricePaise: number | null;
  mrpPaise: number | null;
  fileQty: number | null;
  imagePath: string;
  image: File | null;
}

type RowState = { state: 'pending' | 'running' | 'done' | 'skipped' | 'failed'; note?: string };

const norm = (p: string) => p.toLowerCase().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');

/** Match "images/comb-set/product.png" to a picked file, whatever folder level was chosen. */
function findImage(path: string, files: File[]): File | null {
  const want = norm(path);
  if (!want) return null;
  const paths = files.map((f) => norm(f.webkitRelativePath || f.name));
  const segs = want.split('/');
  // Longest suffix first, but always keep at least folder + file name (many files share a name).
  for (let i = 0; i <= Math.max(0, segs.length - 2); i++) {
    const suffix = segs.slice(i).join('/');
    const hit = paths.findIndex((p) => p === suffix || p.endsWith(`/${suffix}`));
    if (hit >= 0) return files[hit];
  }
  const byName = paths.filter((p) => p.split('/').pop() === segs[segs.length - 1]);
  return byName.length === 1 ? files[paths.indexOf(byName[0])] : null;
}

function describe(r: SheetRow) {
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).replace(/\.$/, '');
  const feats = [pick(r, 'feature1'), pick(r, 'feature2'), pick(r, 'feature3')].filter(Boolean).map((f) => `• ${cap(f)}`);
  return [pick(r, 'description'), feats.join('\n')].filter(Boolean).join('\n\n').slice(0, 5000);
}

/** Suggest a store category for a spreadsheet category by shared words (e.g. "Kitchen & Dining" → Kitchen). */
function suggestCategory(fileCat: string, cats: CategoryOpt[]) {
  const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const want = words(fileCat);
  const exact = cats.find((c) => c.name.toLowerCase() === fileCat.toLowerCase());
  if (exact) return exact.id;
  return cats.find((c) => [...words(c.name)].some((w) => want.has(w)))?.id ?? '';
}

/* ───────────────────────────── component ───────────────────────────── */

export function BulkImport({ categories, warehouses, pricePoints }: { categories: CategoryOpt[]; warehouses: WarehouseOpt[]; pricePoints: PricePointOpt[] }) {
  const activeCats = useMemo(() => categories.filter((c) => c.active), [categories]);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<SheetRow[]>([]);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [catMap, setCatMap] = useState<Record<string, string>>({});
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.status === 'ACTIVE')?.id ?? '');
  const [stockMode, setStockMode] = useState<'fixed' | 'file'>('fixed');
  const [fixedQty, setFixedQty] = useState('100');
  const [publish, setPublish] = useState(true);
  const [status, setStatus] = useState<Record<number, RowState>>({});
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderRef.current?.setAttribute('webkitdirectory', '');
    folderRef.current?.setAttribute('directory', '');
  }, []);

  // Warn before leaving while an import is running.
  useEffect(() => {
    if (!running) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [running]);

  const plan: PlanRow[] = useMemo(
    () =>
      rawRows.map((r, i) => {
        const name = pick(r, 'name');
        const handle = pick(r, 'handle').toLowerCase();
        const qty = pick(r, 'qty');
        return {
          line: i + 2,
          sku: pick(r, 'sku').toUpperCase(),
          name,
          slug: SLUG_REGEX.test(handle) && handle.length <= 80 ? handle : slugify(name),
          fileCategory: pick(r, 'category'),
          description: describe(r),
          shortDescription: [pick(r, 'variantName'), pick(r, 'packSize')].filter(Boolean).join(' · ').slice(0, 300),
          pricePaise: parseRupeesToPaise(pick(r, 'price')),
          mrpPaise: parseRupeesToPaise(pick(r, 'mrp') || pick(r, 'price')),
          fileQty: qty && /^\d+$/.test(qty) ? Number(qty) : null,
          imagePath: pick(r, 'image'),
          image: findImage(pick(r, 'image'), images),
        };
      }),
    [rawRows, images]
  );

  const fileCategories = useMemo(() => [...new Set(plan.map((p) => p.fileCategory).filter(Boolean))], [plan]);
  useEffect(() => {
    setCatMap((m) => {
      const next = { ...m };
      for (const fc of fileCategories) if (next[fc] === undefined) next[fc] = suggestCategory(fc, activeCats);
      return next;
    });
  }, [fileCategories, activeCats]);

  const qtyFor = (p: PlanRow) => (stockMode === 'fixed' ? Number(fixedQty) || 0 : (p.fileQty ?? 0));
  const seenSku = new Map<string, number>();
  plan.forEach((p) => seenSku.set(p.sku, (seenSku.get(p.sku) ?? 0) + 1));
  const problems = (p: PlanRow): string[] => {
    const e: string[] = [];
    if (!SKU_REGEX.test(p.sku)) e.push('Invalid SKU');
    if ((seenSku.get(p.sku) ?? 0) > 1) e.push('SKU repeated in file');
    if (p.name.length < 2 || p.name.length > 150) e.push('Name must be 2–150 characters');
    if (!p.fileCategory) e.push('No category');
    else if (!catMap[p.fileCategory]) e.push('Category not mapped');
    if (!p.pricePaise) e.push('Invalid price');
    if (p.pricePaise && p.mrpPaise !== null && p.mrpPaise < p.pricePaise) e.push('MRP below price');
    if (!p.image) e.push(p.imagePath ? 'Image not found in folder' : 'No image');
    else {
      const err = precheckImage(p.image);
      if (err) e.push(err);
    }
    if (stockMode === 'file' && p.fileQty === null) e.push('No stock quantity');
    return e;
  };
  const invalid = plan.filter((p) => problems(p).length);
  const warehouse = warehouses.find((w) => w.id === warehouseId);
  const anyStock = plan.some((p) => qtyFor(p) > 0);
  const canStart = plan.length > 0 && !invalid.length && !running && (!anyStock || !!warehouse);

  async function onSheet(f: File | undefined) {
    setSheetError(null);
    setStatus({});
    if (!f) return;
    try {
      const { headers, rows } = await readSheet(f);
      const missing = (['sku', 'name', 'category', 'price'] as Field[]).filter((fld) => !COLUMNS[fld].some((k) => headers.includes(k)));
      if (missing.length) throw new Error(`Missing column(s): ${missing.join(', ')}. Download the template for the expected headers.`);
      if (rows.length > 1000) throw new Error('Import at most 1,000 products at a time');
      setRawRows(rows);
      setSheetName(f.name);
    } catch (e) {
      setRawRows([]);
      setSheetName(null);
      setSheetError(errMsg(e));
    }
  }

  function downloadTemplate() {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE].map((r) => r.map(esc).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = '20mart-product-import-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const setRow = (line: number, s: RowState) => setStatus((m) => ({ ...m, [line]: s }));

  /**
   * One product, through the normal admin APIs (permissions, validation, audit log and storefront
   * refresh all apply). Safe to re-run: an existing SKU is never overwritten — a draft left by an
   * interrupted run is completed, anything else is skipped; opening stock can only be recorded once.
   */
  async function importRow(p: PlanRow): Promise<RowState> {
    const found = await api<{ items: { id: string; sku: string; status: string; image: { url: string } | null }[] }>(
      `/api/admin/products?q=${encodeURIComponent(p.sku)}&pageSize=50`
    );
    const existing = found.items.find((x) => x.sku.toUpperCase() === p.sku);
    if (existing && existing.status !== 'DRAFT') return { state: 'skipped', note: `SKU already exists (${existing.status.toLowerCase()})` };

    let id = existing?.id;
    if (!id) {
      const body = {
        name: p.name,
        sku: p.sku,
        slug: p.slug,
        description: p.description || undefined,
        shortDescription: p.shortDescription || undefined,
        categoryId: catMap[p.fileCategory],
        pricePointId: pricePoints.find((pp) => pp.isActive && pp.amountPaise === p.pricePaise)?.id ?? null,
        sellingPricePaise: p.pricePaise,
        mrpPaise: p.mrpPaise ?? p.pricePaise,
      };
      try {
        id = (await api<{ id: string }>('/api/admin/products', { body })).id;
      } catch (e) {
        // Web address taken by another product: retry once with the SKU appended.
        if (!(e instanceof ApiError && e.status === 409) || /sku/i.test(e.message)) throw e;
        id = (await api<{ id: string }>('/api/admin/products', { body: { ...body, slug: `${p.slug}-${p.sku.toLowerCase()}`.slice(0, 80).replace(/-+$/, '') } })).id;
      }
    }

    if (!existing?.image) {
      const form = new FormData();
      form.append('file', p.image!);
      form.append('altText', p.name.slice(0, 150));
      await api(`/api/admin/products/${id}/images`, { form });
    }

    const qty = qtyFor(p);
    if (qty > 0) {
      try {
        await api('/api/admin/inventory/adjust', {
          body: { warehouseId, productId: id, type: 'INITIAL_STOCK', quantity: qty, reason: 'Opening stock (bulk import)', reference: 'bulk-import' },
        });
      } catch (e) {
        // Already recorded by an earlier, interrupted run: never added twice.
        if (!(e instanceof ApiError && e.status === 409 && /initial stock/i.test(e.message))) throw e;
      }
    }

    if (publish) await api(`/api/admin/products/${id}/status`, { body: { status: 'ACTIVE' } });
    return { state: 'done', note: existing ? 'Completed an earlier partial import' : undefined };
  }

  async function run(onlyFailed = false) {
    stopRef.current = false;
    setRunning(true);
    for (const p of plan) {
      if (stopRef.current) break;
      const s = status[p.line]?.state;
      if (s === 'done' || s === 'skipped') continue;
      if (onlyFailed && s !== 'failed') continue;
      setRow(p.line, { state: 'running' });
      try {
        setRow(p.line, await importRow(p));
      } catch (e) {
        setRow(p.line, { state: 'failed', note: errMsg(e) });
      }
    }
    setRunning(false);
  }

  const counts = plan.reduce(
    (a, p) => {
      const s = status[p.line]?.state ?? 'pending';
      a[s] = (a[s] ?? 0) + 1;
      return a;
    },
    {} as Record<string, number>
  );
  const finished = (counts.done ?? 0) + (counts.skipped ?? 0) + (counts.failed ?? 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      <Panel title="1. Files" actions={<button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1 text-xs font-semibold text-[#E66E00] hover:underline cursor-pointer"><Download className="w-3.5 h-3.5" /> Template</button>}>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 p-3 hover:bg-gray-50">
            <FileSpreadsheet className="w-5 h-5 text-[#0B5D3B] shrink-0" />
            <span className="min-w-0 text-xs">
              <span className="block font-semibold text-gray-900">{sheetName ?? 'Choose spreadsheet (.xlsx or .csv)'}</span>
              <span className="text-gray-500">{sheetName ? `${plan.length} product rows (first sheet)` : 'One product per row, headers in the first row'}</span>
            </span>
            <input type="file" accept=".xlsx,.csv" className="sr-only" disabled={running} onChange={(e) => void onSheet(e.target.files?.[0])} />
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 p-3 hover:bg-gray-50">
            <FolderOpen className="w-5 h-5 text-[#E66E00] shrink-0" />
            <span className="min-w-0 text-xs">
              <span className="block font-semibold text-gray-900">{images.length ? `${images.length} image files selected` : 'Choose images folder'}</span>
              <span className="text-gray-500">Matched to each row&apos;s Image Path (JPEG, PNG, WebP, AVIF · max 5 MB)</span>
            </span>
            <input
              ref={folderRef}
              type="file"
              multiple
              className="sr-only"
              disabled={running}
              onChange={(e) => setImages(Array.from(e.target.files ?? []).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f.name)))}
            />
          </label>
          {sheetError && <p className="sm:col-span-2 text-xs text-red-600">{sheetError}</p>}
        </div>
      </Panel>

      {plan.length > 0 && (
        <Panel title="2. Settings">
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Stock warehouse</label>
                <select className={inputCls} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={running}>
                  <option value="">Select a warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code}){w.status !== 'ACTIVE' ? ` · ${w.status.toLowerCase()}` : ''}
                    </option>
                  ))}
                </select>
                {warehouse && warehouse.status !== 'ACTIVE' && (
                  <p className="mt-1 text-[11px] text-amber-700">This warehouse is {warehouse.status.toLowerCase()}: customers cannot buy its stock until it is active and linked to a delivery zone.</p>
                )}
                {!warehouses.length && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    No warehouses yet. <Link href="/warehouses" className="underline">Create one</Link> and link it to a delivery zone first.
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Opening stock per product</label>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="inline-flex items-center gap-1.5">
                    <input type="radio" checked={stockMode === 'fixed'} onChange={() => setStockMode('fixed')} disabled={running} /> Same for all:
                    <input className={`${inputCls} w-20`} inputMode="numeric" value={fixedQty} onChange={(e) => setFixedQty(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={running || stockMode !== 'fixed'} />
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input type="radio" checked={stockMode === 'file'} onChange={() => setStockMode('file')} disabled={running} /> From the file&apos;s quantity column
                  </label>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-gray-800">
                <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} disabled={running} />
                Publish products (visible on the store) after import — otherwise they stay as drafts
              </label>
            </div>
            <div>
              <label className={labelCls}>Category mapping (file → store)</label>
              <div className="space-y-1.5">
                {fileCategories.map((fc) => (
                  <div key={fc} className="flex items-center gap-2 text-xs">
                    <span className="w-40 shrink-0 truncate font-medium text-gray-800" title={fc}>
                      {fc} <span className="text-gray-400">({plan.filter((p) => p.fileCategory === fc).length})</span>
                    </span>
                    <span className="text-gray-400">→</span>
                    <select className={inputCls} value={catMap[fc] ?? ''} onChange={(e) => setCatMap((m) => ({ ...m, [fc]: e.target.value }))} disabled={running}>
                      <option value="">Choose a category</option>
                      {activeCats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.parentName ? `${c.parentName} › ${c.name}` : c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      )}

      {plan.length > 0 && (
        <Panel
          title={`3. Review and import · ${plan.length} products`}
          actions={
            <div className="flex items-center gap-2">
              {running ? (
                <button type="button" onClick={() => (stopRef.current = true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer">
                  <Square className="w-3.5 h-3.5" /> Stop after current
                </button>
              ) : (
                <>
                  {(counts.failed ?? 0) > 0 && (
                    <button type="button" onClick={() => void run(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer">
                      <RotateCcw className="w-3.5 h-3.5" /> Retry failed
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!canStart}
                    onClick={() => void run()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#FF7A00] px-3 text-xs font-semibold text-white hover:bg-[#E66E00] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" /> {finished ? 'Continue import' : 'Start import'}
                  </button>
                </>
              )}
            </div>
          }
        >
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 text-xs text-gray-600 border-b border-gray-100">
            {invalid.length > 0 ? (
              <span className="font-semibold text-red-600">{invalid.length} row(s) need fixing before import</span>
            ) : (
              <span className="text-[#0B5D3B] font-semibold">All rows valid</span>
            )}
            {anyStock && !warehouse && <span className="font-semibold text-red-600">Select a stock warehouse</span>}
            {finished > 0 && (
              <span>
                {counts.done ?? 0} imported · {counts.skipped ?? 0} skipped · {counts.failed ?? 0} failed · {plan.length - finished} remaining
              </span>
            )}
          </div>
          <Table minWidth={900}>
            <THead>
              <Th>Row</Th>
              <Th>Image</Th>
              <Th>SKU / product</Th>
              <Th>Category</Th>
              <Th className="text-right">Price</Th>
              <Th className="text-right">MRP</Th>
              <Th className="text-right">Stock</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {plan.map((p) => {
                const errs = problems(p);
                const s = status[p.line];
                return (
                  <tr key={p.line} className="align-top">
                    <Td className="text-gray-400">{p.line}</Td>
                    <Td>{p.image ? <Thumb file={p.image} /> : <div className="h-10 w-10 rounded bg-gray-100" />}</Td>
                    <Td>
                      <div className="font-mono text-[11px] text-gray-500">{p.sku || '—'}</div>
                      <div className="max-w-xs truncate font-medium text-gray-900" title={p.name}>
                        {p.name || '—'}
                      </div>
                    </Td>
                    <Td className="text-xs">
                      <div className="text-gray-500">{p.fileCategory || '—'}</div>
                      <div className="font-medium text-gray-800">{activeCats.find((c) => c.id === catMap[p.fileCategory])?.name ?? '—'}</div>
                    </Td>
                    <Td className="text-right">{p.pricePaise ? formatINR(p.pricePaise) : '—'}</Td>
                    <Td className="text-right">{p.mrpPaise ? formatINR(p.mrpPaise) : '—'}</Td>
                    <Td className="text-right">{qtyFor(p)}</Td>
                    <Td className="text-xs">
                      {s?.state === 'running' ? (
                        <span className="inline-flex items-center gap-1 text-blue-700">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing…
                        </span>
                      ) : s?.state === 'done' ? (
                        <span className="inline-flex items-center gap-1 text-[#0B5D3B]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {s.note ?? (publish ? 'Imported and published' : 'Imported as draft')}
                        </span>
                      ) : s?.state === 'skipped' ? (
                        <span className="text-gray-500">{s.note}</span>
                      ) : s?.state === 'failed' ? (
                        <span className="inline-flex items-start gap-1 text-red-600">
                          <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {s.note}
                        </span>
                      ) : errs.length ? (
                        <span className="text-red-600">{errs.join(' · ')}</span>
                      ) : (
                        <span className="text-gray-500">Ready</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}

function Thumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
  return url ? <img src={url} alt="" className="h-10 w-10 rounded object-cover border border-gray-100" /> : null;
}
