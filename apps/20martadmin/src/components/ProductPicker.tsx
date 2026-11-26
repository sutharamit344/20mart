'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { formatINR, inputCls } from './ui';

export interface PickedProduct {
  id: string;
  name: string;
  sku: string;
  sellingPricePaise?: number;
  status?: string;
}

/** Search-and-pick list of products (uses the admin products API; needs products.view). */
export function ProductPicker({ value, onChange, label = 'Products', max = 500 }: { value: PickedProduct[]; onChange: (v: PickedProduct[]) => void; label?: string; max?: number }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickedProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api<{ items: PickedProduct[] }>(`/api/admin/products?q=${encodeURIComponent(q.trim())}&pageSize=8`);
        setResults(r.items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const picked = new Set(value.map((p) => p.id));
  return (
    <div className="space-y-1.5">
      <span className="block text-2xs font-semibold text-ink-700">
        {label} <span className="font-normal text-ink-400">({value.length})</span>
      </span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
        <input className={`${inputCls} pl-8`} placeholder="Search by name or SKU…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${label.toLowerCase()}`} />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-ink-400" />}
      </div>
      {results.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-lg border border-line-subtle bg-surface text-xs shadow-sm">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                disabled={picked.has(r.id) || value.length >= max}
                onClick={() => onChange([...value, r])}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-surface-muted disabled:opacity-40"
              >
                <span className="min-w-0 truncate">
                  <span className="font-semibold text-ink">{r.name}</span> <span className="font-mono text-2xs text-ink-400">{r.sku}</span>
                </span>
                <span className="shrink-0 text-2xs text-ink-500">
                  {r.status && r.status !== 'ACTIVE' ? `${r.status.toLowerCase()} · ` : ''}
                  {r.sellingPricePaise != null ? formatINR(r.sellingPricePaise) : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {value.map((p) => (
            <li key={p.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-muted py-0.5 pl-2 pr-1 text-2xs font-semibold text-ink-700">
              <span className="truncate">{p.name}</span>
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== p.id))} aria-label={`Remove ${p.name}`} className="rounded-full p-0.5 hover:bg-line">
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
