'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { resolveImageSrc } from '@20mart/ui';
import { formatPaise, type StorefrontProduct } from '@20mart/shared';
import { CheckCircle2, Heart, Loader2, Minus, Plus, ShoppingBasket } from 'lucide-react';
import { storeApi, useStore } from '../../lib/store';

interface SavedCart {
  joined: boolean;
  editable: boolean;
  lines: { product: StorefrontProduct; quantity: number; estimatedPaise: number }[];
  favorites: string[];
  totalUnits: number;
  estimatedValuePaise: number;
}

/**
 * Fill Your Cart: a saved campaign list per signed-in customer. It never touches the
 * shopping cart, never reserves stock and never creates an order.
 */
export function FillYourCart({ slug, products, maxQty }: { slug: string; products: StorefrontProduct[]; maxQty: number }) {
  const { authStatus, showToast } = useStore();
  const [saved, setSaved] = useState<SavedCart | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    try {
      setSaved(await storeApi<SavedCart>(`/api/campaigns/${slug}/cart`));
    } catch {
      setSaved(null);
    }
  }, [slug]);
  useEffect(() => {
    if (authStatus === 'authenticated') void load();
  }, [authStatus, load]);

  const qtyOf = useMemo(() => new Map(saved?.lines.map((l) => [l.product.id, l.quantity]) ?? []), [saved]);
  const favs = useMemo(() => new Set(saved?.favorites ?? []), [saved]);

  const setQty = async (productId: string, quantity: number) => {
    setBusy(productId);
    try {
      setSaved(await storeApi<SavedCart>(`/api/campaigns/${slug}/cart`, { method: 'PUT', body: { productId, quantity } }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(null);
    }
  };
  const toggleFav = async (productId: string) => {
    setBusy(productId);
    try {
      setSaved(await storeApi<SavedCart>(`/api/campaigns/${slug}/favorites`, { method: 'PUT', body: { productId, favorite: !favs.has(productId) } }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(null);
    }
  };
  const join = async () => {
    setJoining(true);
    try {
      const r = await storeApi<{ couponIssued: boolean }>(`/api/campaigns/${slug}/join`, { method: 'POST' });
      showToast(r.couponIssued ? 'You joined! A coupon was added to your account.' : 'You joined the campaign');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not join');
    } finally {
      setJoining(false);
    }
  };

  if (authStatus === 'guest') {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-xs">
        <ShoppingBasket className="mx-auto h-7 w-7 text-[#FF7A00]" />
        <p className="mt-2 text-sm font-bold text-gray-900">Sign in to fill your cart</p>
        <p className="mt-0.5 text-xs text-gray-500">Your list is saved to your account so you can come back to it.</p>
        <Link href={`/auth?returnTo=/campaigns/${slug}`} className="mt-3 inline-flex h-9 items-center rounded-xl bg-[#FF7A00] px-4 text-xs font-bold text-white hover:bg-[#E66E00]">
          Sign in with Google
        </Link>
        <ProductList products={products} readOnly />
      </div>
    );
  }
  if (authStatus === 'loading' || (authStatus === 'authenticated' && !saved)) {
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-xs text-gray-400" aria-busy="true">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your list…
      </p>
    );
  }
  const s = saved!;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-8">
        <ProductList products={products} readOnly={!s.editable} qtyOf={qtyOf} favs={favs} busy={busy} maxQty={maxQty} onQty={setQty} onFav={toggleFav} />
      </div>
      <aside className="lg:col-span-4 h-fit rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-2 lg:sticky lg:top-20">
        <h2 className="text-sm font-bold text-gray-900">Your campaign cart</h2>
        {s.joined ? (
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> You&apos;ve joined
          </p>
        ) : (
          s.editable && (
            <button type="button" onClick={join} disabled={joining} className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-[#0B5D3B] text-xs font-bold text-white hover:bg-[#094D31] disabled:opacity-50">
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join the campaign'}
            </button>
          )
        )}
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-gray-500">Items saved</dt>
            <dd className="font-bold text-gray-900">{s.totalUnits}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Estimated value today</dt>
            <dd className="font-bold text-gray-900">{formatPaise(s.estimatedValuePaise)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Favourites</dt>
            <dd className="font-bold text-gray-900">{s.favorites.length}</dd>
          </div>
        </dl>
        <p className="text-[10px] text-gray-400">Prices may change at launch. Nothing is charged or reserved.</p>
        {!s.editable && <p className="rounded-lg bg-gray-50 p-2 text-[11px] text-gray-600">This campaign has ended — your list is kept for reference.</p>}
        <Link href="/account/coupons" className="block text-[11px] font-bold text-[#0B5D3B] hover:underline">
          View my coupons
        </Link>
      </aside>
    </div>
  );
}

function ProductList({
  products,
  readOnly,
  qtyOf,
  favs,
  busy,
  maxQty = 10,
  onQty,
  onFav,
}: {
  products: StorefrontProduct[];
  readOnly?: boolean;
  qtyOf?: Map<string, number>;
  favs?: Set<string>;
  busy?: string | null;
  maxQty?: number;
  onQty?: (id: string, q: number) => void;
  onFav?: (id: string) => void;
}) {
  if (!products.length) return <p className="mt-4 text-center text-xs text-gray-500">Products for this campaign are coming soon.</p>;
  return (
    <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
      {products.map((p) => {
        const q = qtyOf?.get(p.id) ?? 0;
        const fav = favs?.has(p.id) ?? false;
        const isBusy = busy === p.id;
        return (
          <li key={p.id} className={`flex gap-2.5 rounded-2xl border bg-white p-2.5 shadow-xs ${q ? 'border-amber-200' : 'border-gray-100'}`}>
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-50">
              {p.image && <Image src={resolveImageSrc(p.image.url)} alt={p.image.alt} fill sizes="64px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/product/${p.slug}`} className="line-clamp-2 text-xs font-bold text-gray-900 hover:underline">
                {p.name}
              </Link>
              <p className="text-xs font-black text-gray-900">{formatPaise(p.sellingPricePaise)}</p>
              {!readOnly && onQty && (
                <div className="mt-1 flex items-center justify-between gap-2">
                  {q ? (
                    <div className="inline-flex items-center rounded-lg border border-gray-200" role="group" aria-label={`Quantity of ${p.name}`}>
                      <button type="button" disabled={isBusy} onClick={() => onQty(p.id, q - 1)} className="flex h-7 w-7 items-center justify-center text-gray-600 disabled:opacity-40" aria-label="Decrease">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold" aria-live="polite">
                        {isBusy ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : q}
                      </span>
                      <button type="button" disabled={isBusy || q >= maxQty} onClick={() => onQty(p.id, q + 1)} className="flex h-7 w-7 items-center justify-center text-gray-600 disabled:opacity-40" aria-label="Increase">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" disabled={isBusy} onClick={() => onQty(p.id, 1)} className="inline-flex h-7 items-center rounded-lg bg-[#FF7A00] px-2.5 text-[11px] font-bold text-white hover:bg-[#E66E00] disabled:opacity-50">
                      {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add to list'}
                    </button>
                  )}
                  {onFav && (
                    <button type="button" disabled={isBusy} onClick={() => onFav(p.id)} aria-pressed={fav} aria-label={fav ? `Remove ${p.name} from favourites` : `Add ${p.name} to favourites`} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-gray-50">
                      <Heart className={`h-4 w-4 ${fav ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
