'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { resolveImageSrc } from '@20mart/ui';
import { formatPaise, type StorefrontProduct } from '@20mart/shared';
import { Heart, Loader2, ShoppingCart, Trash2 } from 'lucide-react';
import { storeApi, useStore } from '../lib/store';

/**
 * Signed-in customer's wishlist with LIVE prices and availability from the server.
 * Hidden/unpublished products drop out automatically.
 */
export function WishlistView({ compact = false }: { compact?: boolean }) {
  const { authStatus, refreshWishlist, refreshCart, showToast, wishlist } = useStore();
  const [items, setItems] = useState<StorefrontProduct[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await storeApi<{ items: StorefrontProduct[] }>('/api/wishlist');
      setItems(data.items);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') void load();
    if (authStatus === 'guest') setItems([]);
  }, [authStatus, load, wishlist.length]);

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      showToast(ok);
      await Promise.all([load(), refreshWishlist(), refreshCart()]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  if (authStatus === 'guest') {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <Heart className="mx-auto mb-2 h-8 w-8 text-[#FF7A00]" />
        <p className="text-sm font-bold text-gray-900">Sign in to see your wishlist</p>
        <p className="mt-1 text-xs text-gray-500">Saved items are kept on your account across devices.</p>
        <Link href="/auth?returnTo=/wishlist" className="mt-4 inline-flex h-9 items-center rounded-xl bg-[#0B5D3B] px-4 text-xs font-bold text-white">
          Sign in with Google
        </Link>
      </div>
    );
  }
  if (!items) {
    return (
      <div className="flex items-center justify-center py-16 text-xs text-gray-400" aria-busy="true">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your wishlist…
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <Heart className="mx-auto mb-2 h-8 w-8 text-gray-300" />
        <p className="text-sm font-bold text-gray-900">Your wishlist is empty</p>
        <p className="mt-1 text-xs text-gray-500">Tap the heart on any product to save it for later.</p>
        <Link href="/shop" className="mt-4 inline-flex h-9 items-center rounded-xl bg-[#FF7A00] px-4 text-xs font-bold text-white">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <ul className={`grid gap-2.5 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
      {items.map((p) => {
        const out = p.stockState === 'OUT';
        return (
          <li key={p.id} className={`flex gap-3 rounded-2xl border border-gray-100 bg-white p-2.5 shadow-xs ${busy === p.id ? 'opacity-60' : ''}`}>
            <Link href={`/product/${p.slug}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
              {p.image ? <Image src={resolveImageSrc(p.image.url)} alt={p.image.alt} fill sizes="80px" className="object-contain p-1" /> : null}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col justify-between">
              <div className="min-w-0">
                <Link href={`/product/${p.slug}`} className="line-clamp-2 text-xs font-bold text-gray-900 hover:text-[#0B5D3B]">
                  {p.name}
                </Link>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-sm font-black text-gray-900">{formatPaise(p.sellingPricePaise)}</span>
                  {p.mrpPaise > p.sellingPricePaise && <span className="text-[10px] text-gray-400 line-through">{formatPaise(p.mrpPaise)}</span>}
                </div>
                <p className={`text-[10px] font-semibold ${out ? 'text-red-600' : p.stockState === 'LOW' ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {out ? 'Out of stock' : p.stockState === 'LOW' ? 'Only a few left' : 'In stock'}
                </p>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                {p.hasVariants ? (
                  <Link href={`/product/${p.slug}`} className="inline-flex h-7 items-center rounded-lg bg-[#FF7A00] px-2.5 text-[11px] font-bold text-white">
                    Choose option
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={out || !!busy}
                    onClick={() => act(p.id, () => storeApi(`/api/wishlist/${p.id}/move-to-cart`, { body: {} }), 'Moved to cart')}
                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#FF7A00] px-2.5 text-[11px] font-bold text-white disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    <ShoppingCart className="h-3 w-3" /> Move to cart
                  </button>
                )}
                <button
                  type="button"
                  disabled={!!busy}
                  aria-label={`Remove ${p.name} from wishlist`}
                  onClick={() => act(p.id, () => storeApi(`/api/wishlist/${p.id}`, { method: 'DELETE' }), 'Removed from wishlist')}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
