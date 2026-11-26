'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EMPTY_CART, type CartView, type StorefrontProduct } from '@20mart/shared';

/**
 * Client state for the storefront.
 * - Cart and wishlist are SERVER-backed (database); this context only mirrors them.
 *   Prices, totals and stock checks always come from the server responses.
 */

export interface CustomerUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export class StoreApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public fieldErrors: Record<string, string[]> = {},
    public issues: string[] = []
  ) {
    super(message);
  }
}

/** Same-origin JSON call to the storefront API; throws StoreApiError with the server's message. */
export async function storeApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
    headers: init.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new StoreApiError(err.message ?? 'Something went wrong', res.status, err.code ?? 'ERROR', err.details?.fieldErrors ?? {}, err.details?.issues ?? []);
  }
  return data as T;
}

const LEGACY_WISHLIST_KEY = '20mart_wishlist';

interface StoreContextType {
  // Cart (server)
  cart: CartView;
  cartReady: boolean;
  cartCount: number;
  cartBusy: boolean;
  refreshCart: () => Promise<void>;
  addToCart: (productId: string, quantity?: number, variantId?: string | null) => Promise<boolean>;
  setLineQuantity: (lineId: string, quantity: number) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  getItemQuantity: (productId: string) => number;
  /** Product cards: +1 / −1 on the product's (variant-less) cart line. */
  updateItemQuantity: (product: StorefrontProduct, delta: number) => Promise<void>;
  /** Apply a coupon (signed-in). Resolves to an error message, or null on success. */
  applyCoupon: (code: string) => Promise<string | null>;
  removeCoupon: () => Promise<void>;

  // Wishlist (server, signed-in customers)
  wishlist: string[];
  toggleWishlist: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  refreshWishlist: () => Promise<void>;

  // Customer session
  user: CustomerUser | null;
  authStatus: 'loading' | 'authenticated' | 'guest';
  refreshUser: () => Promise<void>;
  logoutUser: () => Promise<void>;

  // Search & navigation
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartView>(EMPTY_CART);
  const [cartReady, setCartReady] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'guest'>('loading');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3000);
  }, []);

  /* ───────────── Session ───────────── */
  const refreshUser = useCallback(async () => {
    try {
      const data = await storeApi<{ user: CustomerUser | null }>('/api/auth/me');
      setUser(data.user);
      setAuthStatus(data.user ? 'authenticated' : 'guest');
    } catch {
      setUser(null);
      setAuthStatus('guest');
    }
  }, []);

  /* ───────────── Cart ───────────── */
  const refreshCart = useCallback(async () => {
    try {
      setCart(await storeApi<CartView>('/api/cart'));
    } catch {
      /* keep last known cart */
    } finally {
      setCartReady(true);
    }
  }, []);

  const runCart = useCallback(
    async (fn: () => Promise<CartView>, ok?: string) => {
      setCartBusy(true);
      try {
        setCart(await fn());
        if (ok) showToast(ok);
        return true;
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not update your cart');
        await refreshCart();
        return false;
      } finally {
        setCartBusy(false);
      }
    },
    [refreshCart, showToast]
  );

  const addToCart = useCallback(
    (productId: string, quantity = 1, variantId: string | null = null) =>
      runCart(() => storeApi<CartView>('/api/cart/items', { body: { productId, variantId, quantity } }), 'Added to cart'),
    [runCart]
  );
  const setLineQuantity = useCallback(
    async (lineId: string, quantity: number) => {
      await runCart(() => storeApi<CartView>(`/api/cart/items/${lineId}`, { method: 'PATCH', body: { quantity } }));
    },
    [runCart]
  );
  const removeLine = useCallback(
    async (lineId: string) => {
      await runCart(() => storeApi<CartView>(`/api/cart/items/${lineId}`, { method: 'DELETE' }), 'Removed from cart');
    },
    [runCart]
  );
  const clearCart = useCallback(async () => {
    await runCart(() => storeApi<CartView>('/api/cart', { method: 'DELETE' }), 'Cart cleared');
  }, [runCart]);

  const applyCoupon = useCallback(
    async (code: string) => {
      setCartBusy(true);
      try {
        setCart(await storeApi<CartView>('/api/cart/coupon', { body: { code } }));
        showToast('Coupon applied');
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'Could not apply this coupon';
      } finally {
        setCartBusy(false);
      }
    },
    [showToast]
  );
  const removeCoupon = useCallback(async () => {
    await runCart(() => storeApi<CartView>('/api/cart/coupon', { method: 'DELETE' }), 'Coupon removed');
  }, [runCart]);

  const getItemQuantity = useCallback(
    (productId: string) => cart.lines.filter((l) => l.productId === productId).reduce((a, l) => a + l.quantity, 0),
    [cart]
  );

  const updateItemQuantity = useCallback(
    async (product: StorefrontProduct, delta: number) => {
      const line = cart.lines.find((l) => l.productId === product.id && !l.variantId);
      if (line) {
        await setLineQuantity(line.id, Math.max(0, line.quantity + delta));
      } else if (delta > 0) {
        await addToCart(product.id, delta);
      }
    },
    [cart, setLineQuantity, addToCart]
  );

  /* ───────────── Wishlist ───────────── */
  const refreshWishlist = useCallback(async () => {
    try {
      const data = await storeApi<{ productIds: string[] }>('/api/wishlist');
      setWishlist(data.productIds);
    } catch {
      setWishlist([]);
    }
  }, []);

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (authStatus !== 'authenticated') {
        showToast('Sign in to save items to your wishlist');
        return;
      }
      const had = wishlist.includes(productId);
      setWishlist((w) => (had ? w.filter((id) => id !== productId) : [...w, productId])); // optimistic
      try {
        const data = had
          ? await storeApi<{ productIds: string[] }>(`/api/wishlist/${productId}`, { method: 'DELETE' })
          : await storeApi<{ productIds: string[] }>('/api/wishlist', { body: { productId } });
        setWishlist(data.productIds);
        showToast(had ? 'Removed from wishlist' : 'Saved to wishlist');
      } catch (e) {
        await refreshWishlist();
        showToast(e instanceof Error ? e.message : 'Could not update wishlist');
      }
    },
    [authStatus, wishlist, refreshWishlist, showToast]
  );
  const isWishlisted = useCallback((productId: string) => wishlist.includes(productId), [wishlist]);

  // Initial load: session + cart. After sign-in, import any pre-login (P0 localStorage) wishlist once.
  useEffect(() => {
    void refreshUser();
    void refreshCart();
  }, [refreshUser, refreshCart]);

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      if (authStatus === 'guest') setWishlist([]);
      return;
    }
    (async () => {
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_WISHLIST_KEY) ?? '[]');
        if (Array.isArray(legacy) && legacy.length) {
          await storeApi('/api/wishlist/import', { body: { ids: legacy.filter((x) => typeof x === 'string').slice(0, 100) } }).catch(() => undefined);
        }
        localStorage.removeItem(LEGACY_WISHLIST_KEY);
      } catch {
        /* storage unavailable */
      }
      await refreshWishlist();
    })();
  }, [authStatus, refreshWishlist]);

  const logoutUser = useCallback(async () => {
    try {
      await storeApi('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setAuthStatus('guest');
      setWishlist([]);
      setCart(EMPTY_CART); // customer cart stays in the DB; guests start fresh
      showToast('Signed out');
    }
  }, [showToast]);

  const value = useMemo<StoreContextType>(
    () => ({
      cart,
      cartReady,
      cartCount: cart.totalQuantity,
      cartBusy,
      refreshCart,
      addToCart,
      setLineQuantity,
      removeLine,
      clearCart,
      getItemQuantity,
      updateItemQuantity,
      applyCoupon,
      removeCoupon,
      wishlist,
      toggleWishlist,
      isWishlisted,
      refreshWishlist,
      user,
      authStatus,
      refreshUser,
      logoutUser,
      searchQuery,
      setSearchQuery,
      toastMessage,
      showToast,
    }),
    [cart, cartReady, cartBusy, refreshCart, addToCart, setLineQuantity, removeLine, clearCart, getItemQuantity, updateItemQuantity, applyCoupon, removeCoupon, wishlist, toggleWishlist, isWishlisted, refreshWishlist, user, authStatus, refreshUser, logoutUser, searchQuery, toastMessage, showToast]
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      {toastMessage && (
        <div role="status" aria-live="polite" className="fixed bottom-20 sm:bottom-6 right-4 left-4 sm:left-auto sm:right-6 z-50 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-xl sm:max-w-sm">
            <span className="h-2 w-2 shrink-0 rounded-full bg-brand-orange" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};
