'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Product,
  CartItem,
  DeliveryAddress,
  Order,
  Coupon,
  mockProducts,
  mockCartItems,
  mockAddresses,
  mockCoupons,
  mockOrders,
} from '@20mart/shared';

interface StoreContextType {
  // Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateCartQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  getItemQuantity: (productId: string) => number;
  updateItemQuantity: (productId: string, delta: number) => void;
  cartCount: number;
  cartSubtotal: number;
  cartDeliveryCharge: number;
  cartDiscount: number;
  cartTotal: number;

  // Wishlist
  wishlist: string[]; // product IDs
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;

  // Coupons
  coupons: Coupon[];
  appliedCoupon: Coupon | null;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  unlockCoupon: (source: 'SURVEY' | 'LAUNCH') => void;

  // Orders
  orders: Order[];
  placeOrder: (
    deliveryMethod: 'HOME_DELIVERY' | 'STORE_PICKUP',
    paymentMethod: 'ONLINE_UPI' | 'CARD' | 'CASH_ON_DELIVERY'
  ) => Order;

  // User & Addresses
  user: { name: string; phone: string; email: string } | null;
  loginUser: (phone: string) => void;
  logoutUser: () => void;
  addresses: DeliveryAddress[];
  selectedAddress: DeliveryAddress | null;
  addAddress: (addr: Omit<DeliveryAddress, 'id'>) => void;
  selectAddress: (id: string) => void;

  // Survey
  surveyCompleted: boolean;
  completeSurvey: (answers: Record<string, string>) => void;
  surveyAnswers: Record<string, string>;

  // Search & Navigation
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCity: string;
  setSelectedCity: (city: string) => void;

  // Notification Toast state
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(mockCartItems);
  const [wishlist, setWishlist] = useState<string[]>(['prod-1', 'prod-2', 'prod-3']);
  const [coupons, setCoupons] = useState<Coupon[]>(mockCoupons);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [user, setUser] = useState<{ name: string; phone: string; email: string } | null>({
    name: 'Amit Kumar',
    phone: '+91 98765 43210',
    email: 'amit@example.com',
  });
  const [addresses, setAddresses] = useState<DeliveryAddress[]>(mockAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(mockAddresses[0]?.id || '');
  const [surveyCompleted, setSurveyCompleted] = useState<boolean>(false);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('Ahmedabad');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Cart logic
  const addToCart = (product: Product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prev,
        {
          id: `cart-${Date.now()}`,
          productId: product.id,
          product,
          quantity,
          price: product.price,
          selected: true,
        },
      ];
    });
    showToast(`Added ${product.name} to cart!`);
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === cartItemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
    showToast('Item removed from cart');
  };

  const clearCart = () => {
    setCart([]);
  };

  const getItemQuantity = (productId: string) => {
    const item = cart.find((i) => i.productId === productId);
    return item ? item.quantity : 0;
  };

  const updateItemQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) {
          showToast(`Removed from cart`);
          return prev.filter((item) => item.productId !== productId);
        }
        return prev.map((item) =>
          item.productId === productId ? { ...item, quantity: newQty } : item
        );
      }
      if (delta > 0) {
        const product = mockProducts.find((p) => p.id === productId);
        if (product) {
          showToast(`Added ${product.name} to cart!`);
          return [
            ...prev,
            {
              id: `cart-${Date.now()}`,
              productId,
              product,
              quantity: delta,
              price: product.price,
              selected: true,
            },
          ];
        }
      }
      return prev;
    });
  };

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cartDeliveryCharge = cartSubtotal >= 199 || cartSubtotal === 0 ? 0 : 40;
  const cartDiscount = appliedCoupon ? appliedCoupon.discountValue : 0;
  const cartTotal = Math.max(0, cartSubtotal + cartDeliveryCharge - cartDiscount);

  // Wishlist
  const toggleWishlist = (productId: string) => {
    setWishlist((prev) => {
      const exists = prev.includes(productId);
      if (exists) {
        showToast('Removed from wishlist');
        return prev.filter((id) => id !== productId);
      } else {
        showToast('Saved to wishlist');
        return [...prev, productId];
      }
    });
  };

  const isWishlisted = (productId: string) => wishlist.includes(productId);

  // Coupons
  const applyCoupon = (code: string) => {
    const found = coupons.find(
      (c) => c.code.toUpperCase() === code.trim().toUpperCase() && c.isUnlocked
    );
    if (!found) {
      return { success: false, message: 'Invalid or locked coupon code' };
    }
    if (cartSubtotal < found.minOrderValue) {
      return {
        success: false,
        message: `Minimum order value ₹${found.minOrderValue} required for this coupon`,
      };
    }
    setAppliedCoupon(found);
    showToast(`Coupon ${found.code} applied! Saved ₹${found.discountValue}`);
    return { success: true, message: `Coupon ${found.code} applied successfully!` };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    showToast('Coupon removed');
  };

  const unlockCoupon = (source: 'SURVEY' | 'LAUNCH') => {
    setCoupons((prev) =>
      prev.map((c) => (c.source === source ? { ...c, isUnlocked: true } : c))
    );
    showToast('New coupon unlocked! Added to your wallet.');
  };

  // Orders
  const placeOrder = (
    deliveryMethod: 'HOME_DELIVERY' | 'STORE_PICKUP',
    paymentMethod: 'ONLINE_UPI' | 'CARD' | 'CASH_ON_DELIVERY'
  ) => {
    const activeAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0] || mockAddresses[0];
    const newOrderNumber = `ZM${Math.floor(10000 + Math.random() * 90000)}`;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: newOrderNumber,
      createdAt: 'Just now',
      status: 'PROCESSING',
      items: cart.map((item, idx) => ({
        id: `oi-${Date.now()}-${idx}`,
        productId: item.productId,
        name: item.product.name,
        image: item.product.images[0] || '',
        quantity: item.quantity,
        price: item.price,
      })),
      itemCount: cart.length,
      subtotal: cartSubtotal,
      deliveryCharge: deliveryMethod === 'STORE_PICKUP' ? 0 : cartDeliveryCharge,
      discount: cartDiscount,
      total:
        deliveryMethod === 'STORE_PICKUP'
          ? Math.max(0, cartSubtotal - cartDiscount)
          : cartTotal,
      deliveryAddress: activeAddress,
      deliveryMethod,
      paymentMethod,
      paymentStatus: 'PAID',
      estimatedDelivery: '05 Nov 2026',
      timeline: [
        {
          status: 'CONFIRMED',
          title: 'Order Placed',
          timestamp: 'Today, Just now',
          completed: true,
        },
        {
          status: 'PROCESSING',
          title: 'Processing',
          timestamp: 'Today, Assigned to Hub',
          completed: true,
        },
        {
          status: 'OUT_FOR_DELIVERY',
          title: 'Out for Delivery',
          timestamp: 'Expected 04 Nov',
          completed: false,
        },
        {
          status: 'DELIVERED',
          title: 'Delivered',
          timestamp: 'Expected 05 Nov',
          completed: false,
        },
      ],
    };

    setOrders((prev) => [newOrder, ...prev]);
    clearCart();
    setAppliedCoupon(null);
    return newOrder;
  };

  // User
  const loginUser = (phone: string) => {
    setUser({
      name: 'Amit Kumar',
      phone: phone.startsWith('+91') ? phone : `+91 ${phone}`,
      email: 'amit@example.com',
    });
    showToast('Logged in successfully!');
  };

  const logoutUser = () => {
    setUser(null);
    showToast('Logged out');
  };

  const addAddress = (addr: Omit<DeliveryAddress, 'id'>) => {
    const newAddr: DeliveryAddress = {
      ...addr,
      id: `addr-${Date.now()}`,
    };
    setAddresses((prev) => [...prev, newAddr]);
    setSelectedAddressId(newAddr.id);
    showToast('Address added successfully!');
  };

  const selectAddress = (id: string) => {
    setSelectedAddressId(id);
  };

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0] || null;

  // Survey
  const completeSurvey = (answers: Record<string, string>) => {
    setSurveyAnswers(answers);
    setSurveyCompleted(true);
    unlockCoupon('SURVEY');
  };

  return (
    <StoreContext.Provider
      value={{
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        getItemQuantity,
        updateItemQuantity,
        cartCount,
        cartSubtotal,
        cartDeliveryCharge,
        cartDiscount,
        cartTotal,
        wishlist,
        toggleWishlist,
        isWishlisted,
        coupons,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        unlockCoupon,
        orders,
        placeOrder,
        user,
        loginUser,
        logoutUser,
        addresses,
        selectedAddress,
        addAddress,
        selectAddress,
        surveyCompleted,
        completeSurvey,
        surveyAnswers,
        searchQuery,
        setSearchQuery,
        selectedCity,
        setSelectedCity,
        toastMessage,
        showToast,
      }}
    >
      {children}
      {/* Global floating toast notification */}
      {toastMessage && (
        <div className="fixed bottom-20 sm:bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
            <span className="h-2 w-2 rounded-full bg-[#FF7A00]" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

