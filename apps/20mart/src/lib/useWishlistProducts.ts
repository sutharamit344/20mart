'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Product, StorefrontProduct } from '@20mart/shared';
import { toCartProduct, useStore } from './store';

/**
 * Resolve wishlisted product ids to live catalog data. Products that were
 * unpublished or removed simply drop out (the API only returns visible items).
 */
export function useWishlistProducts(): { products: Product[]; loading: boolean } {
  const { wishlist } = useStore();
  const [items, setItems] = useState<StorefrontProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const key = wishlist.join(',');

  useEffect(() => {
    if (!key) {
      setItems([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/catalog/products?ids=${encodeURIComponent(key)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: StorefrontProduct[] }) => setItems(d.items ?? []))
      .catch(() => undefined)
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [key]);

  const products = useMemo(() => items.filter((p) => wishlist.includes(p.id)).map(toCartProduct), [items, wishlist]);
  return { products, loading };
}
