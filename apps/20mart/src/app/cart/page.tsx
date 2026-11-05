'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Breadcrumb, Button, Drawer } from '@20mart/ui';
import { useStore } from '../../lib/store';
import {
  Trash2,
  Plus,
  Minus,
  Tag,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  X,
  ShoppingBag,
} from 'lucide-react';

export default function CartPage() {
  const router = useRouter();
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    cartCount,
    cartSubtotal,
    cartDeliveryCharge,
    cartDiscount,
    cartTotal,
    coupons,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
  } = useStore();

  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponDrawerOpen, setCouponDrawerOpen] = useState(false);
  const [couponError, setCouponError] = useState('');

  const handleApplyCoupon = (code: string) => {
    setCouponError('');
    const res = applyCoupon(code);
    if (!res.success) {
      setCouponError(res.message);
    } else {
      setCouponCodeInput('');
      setCouponDrawerOpen(false);
    }
  };

  const amountNeededForFreeDelivery = Math.max(0, 199 - cartSubtotal);

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-50 text-[#FF7A00] mx-auto">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-gray-900">Your Cart is Empty</h2>
        <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
          Add everyday household essentials, kitchenware, or cleaning supplies to get started!
        </p>
        <div className="pt-2">
          <Button size="lg" onClick={() => router.push('/shop')} className="rounded-xl font-bold">
            Start Shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: `Your Cart (${cartCount} items)` },
        ]}
      />

      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">
            Your Cart ({cartCount} {cartCount === 1 ? 'item' : 'items'})
          </h1>
          <p className="text-xs text-gray-500">Review your selected items before checkout</p>
        </div>
        <button
          type="button"
          onClick={clearCart}
          className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors"
        >
          Clear Cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Cart Items List */}
        <div className="lg:col-span-8 space-y-4">
          {/* Free Delivery Tracker */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-black">
                ✓
              </div>
              <div>
                {amountNeededForFreeDelivery === 0 ? (
                  <p className="text-xs font-bold text-emerald-900">
                    🎉 You have unlocked Free Doorstep Delivery!
                  </p>
                ) : (
                  <p className="text-xs font-bold text-emerald-900">
                    Add ₹{amountNeededForFreeDelivery} more to enjoy Free Delivery!
                  </p>
                )}
                <p className="text-[11px] text-emerald-700">Orders above ₹199 qualify for free shipping</p>
              </div>
            </div>
            {amountNeededForFreeDelivery > 0 && (
              <Link
                href="/shop"
                className="text-xs font-bold text-[#0B5D3B] underline shrink-0 hover:text-emerald-900"
              >
                Add Items →
              </Link>
            )}
          </div>

          {/* Cart Items */}
          <div className="divide-y divide-gray-100 rounded-3xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs">
            {cart.map((item) => (
              <div
                key={item.id}
                className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
              >
                {/* Image + Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-xl bg-white p-1.5 border border-gray-100 flex items-center justify-center">
                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                      {item.product.name}
                    </h3>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-sm sm:text-base font-bold text-gray-900">
                        ₹{item.price}
                      </span>
                      {item.product.originalPrice > item.price && (
                        <span className="text-xs text-gray-400 line-through">
                          ₹{item.product.originalPrice}
                        </span>
                      )}
                      {item.product.discountPercent > 0 && (
                        <span className="text-[10px] font-bold text-[#FF7A00] bg-[#FFF6E9] px-1.5 py-0.5 rounded">
                          -{item.product.discountPercent}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stepper + Remove */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(item.id, -1)}
                      className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-white transition-all"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs sm:text-sm font-black text-gray-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(item.id, 1)}
                      className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-white transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Coupon Input Bar (Screen 07 & 05) */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#FF7A00]" />
                <span className="text-xs font-bold text-gray-900">Have a coupon code?</span>
              </div>
              <button
                type="button"
                onClick={() => setCouponDrawerOpen(true)}
                className="text-xs font-bold text-[#0B5D3B] hover:underline"
              >
                View Available Coupons →
              </button>
            </div>

            {appliedCoupon ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FFF6E9] border border-orange-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#FF7A00] uppercase tracking-wider">
                    {appliedCoupon.code}
                  </span>
                  <span className="text-gray-600">applied (-₹{appliedCoupon.discountValue})</span>
                </div>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-gray-400 hover:text-red-600 font-bold"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter WELCOME50 or SURVEY50..."
                  value={couponCodeInput}
                  onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs uppercase font-bold text-gray-900 placeholder:normal-case placeholder:font-normal focus:border-[#FF7A00] focus:bg-white focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleApplyCoupon(couponCodeInput)}
                  disabled={!couponCodeInput.trim()}
                >
                  Apply
                </Button>
              </div>
            )}
            {couponError && <p className="mt-1.5 text-xs text-red-600 font-medium">{couponError}</p>}
          </div>
        </div>

        {/* Right Column: Order Summary Card */}
        <div className="lg:col-span-4 rounded-3xl border border-gray-100 bg-white p-5 sm:p-6 shadow-xs space-y-4 sticky top-24">
          <h3 className="text-sm sm:text-base font-bold text-gray-900 pb-2.5 border-b border-gray-100">
            Order Summary
          </h3>

          <div className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Items Subtotal ({cartCount})</span>
              <span className="font-bold text-gray-900">₹{cartSubtotal}</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Delivery Charge</span>
              {cartDeliveryCharge === 0 ? (
                <span className="font-bold text-emerald-600">FREE</span>
              ) : (
                <span className="font-bold text-gray-900">₹{cartDeliveryCharge}</span>
              )}
            </div>

            {appliedCoupon && (
              <div className="flex justify-between text-[#FF7A00]">
                <span>Coupon Discount ({appliedCoupon.code})</span>
                <span className="font-bold">-₹{appliedCoupon.discountValue}</span>
              </div>
            )}

            <hr className="border-gray-100 pt-0.5" />

            <div className="flex justify-between items-baseline text-sm sm:text-base font-bold text-gray-900">
              <span>Total Payable</span>
              <span className="text-xl sm:text-2xl font-bold text-[#0B5D3B]">₹{cartTotal}</span>
            </div>
          </div>

          <Button
            size="md"
            variant="primary"
            onClick={() => router.push('/checkout')}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="w-full rounded-xl font-bold shadow-xs text-xs sm:text-sm py-2.5"
          >
            Proceed to Checkout
          </Button>

          <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-gray-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>100% Safe & Secure Payments</span>
          </div>
        </div>
      </div>

      {/* Available Coupons Drawer */}
      <Drawer
        isOpen={couponDrawerOpen}
        onClose={() => setCouponDrawerOpen(false)}
        title="Available Coupons & Offers"
        position="bottom"
      >
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className={`p-4 rounded-2xl border transition-all ${
                coupon.isUnlocked
                  ? 'border-orange-200 bg-orange-50/50'
                  : 'border-gray-200 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-[#FF7A00] text-sm uppercase">
                  {coupon.code}
                </span>
                {coupon.isUnlocked ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleApplyCoupon(coupon.code)}
                  >
                    Apply
                  </Button>
                ) : (
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-2 py-1 rounded">
                    Locked
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-gray-800 mt-1">{coupon.title}</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">{coupon.description}</p>
              <p className="text-[10px] text-gray-400 mt-1">Valid till {coupon.validUntil}</p>
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  );
}

