'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Breadcrumb, Button, Modal, Input } from '@20mart/ui';
import { useStore } from '../../lib/store';
import {
  MapPin,
  Truck,
  Store,
  CreditCard,
  QrCode,
  Banknote,
  ShieldCheck,
  CheckCircle2,
  Plus,
  ArrowRight,
  Clock,
} from 'lucide-react';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get('step');

  const {
    cart,
    cartCount,
    cartSubtotal,
    cartDeliveryCharge,
    cartDiscount,
    cartTotal,
    addresses,
    selectedAddress,
    selectAddress,
    addAddress,
    placeOrder,
  } = useStore();

  const [activeStep, setActiveStep] = useState<number>(
    stepParam ? Math.min(3, Math.max(1, parseInt(stepParam, 10))) : 1
  );

  useEffect(() => {
    if (stepParam) {
      const parsed = parseInt(stepParam, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 3) {
        setActiveStep(parsed);
      }
    }
  }, [stepParam]);

  const [deliveryMethod, setDeliveryMethod] = useState<'HOME_DELIVERY' | 'STORE_PICKUP'>('HOME_DELIVERY');
  const [deliverySlot, setDeliverySlot] = useState<string>('Morning (8:00 AM – 12:00 PM)');
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE_UPI' | 'CARD' | 'CASH_ON_DELIVERY'>('ONLINE_UPI');
  const [upiApp, setUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'other'>('gpay');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newAddressModalOpen, setNewAddressModalOpen] = useState(false);

  // New Address form states
  const [newName, setNewName] = useState('Amit Kumar');
  const [newPhone, setNewPhone] = useState('+91 98765 43210');
  const [newLine1, setNewLine1] = useState('');
  const [newLocality, setNewLocality] = useState('Chanakyapuri');
  const [newCity, setNewCity] = useState('Ahmedabad');
  const [newPincode, setNewPincode] = useState('380061');
  const [newType, setNewType] = useState<'Home' | 'Work' | 'Other'>('Home');

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLine1.trim()) return;
    addAddress({
      name: newName,
      phone: newPhone,
      addressLine1: newLine1,
      locality: newLocality,
      city: newCity,
      state: 'Gujarat',
      pincode: newPincode,
      type: newType,
      isDefault: false,
    });
    setNewAddressModalOpen(false);
  };

  const handlePlaceOrder = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      const order = placeOrder(deliveryMethod, paymentMethod);
      setIsSubmitting(false);
      router.push(`/order-success?orderId=${order.orderNumber}`);
    }, 700);
  };

  const finalDeliveryCharge = deliveryMethod === 'STORE_PICKUP' ? 0 : cartDeliveryCharge;
  const finalTotal = Math.max(0, cartSubtotal + finalDeliveryCharge - cartDiscount);

  const deliverySlots = [
    'Morning (8:00 AM – 12:00 PM)',
    'Afternoon (12:00 PM – 4:00 PM)',
    'Evening (4:00 PM – 8:00 PM)',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Cart', href: '/cart' },
          { label: 'Checkout' },
        ]}
      />

      {/* Stepper Progress Bar (Screen 08 desktop & Screen 06 mobile) */}
      <div className="rounded-2xl bg-white border border-gray-100 p-3 sm:p-4 shadow-xs">
        <div className="flex items-center justify-between max-w-md mx-auto">
          {/* Step 1: Address */}
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className="flex items-center gap-1.5 focus:outline-none"
          >
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all shadow-xs ${
                activeStep >= 1 ? 'bg-[#0B5D3B] text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              1
            </div>
            <span
              className={`text-xs font-bold ${
                activeStep === 1 ? 'text-[#0B5D3B]' : 'text-gray-700'
              }`}
            >
              Address
            </span>
          </button>

          <div className={`flex-1 h-0.5 mx-2.5 transition-colors ${activeStep >= 2 ? 'bg-[#0B5D3B]' : 'bg-gray-200'}`} />

          {/* Step 2: Delivery */}
          <button
            type="button"
            onClick={() => setActiveStep(2)}
            className="flex items-center gap-1.5 focus:outline-none"
          >
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all shadow-xs ${
                activeStep >= 2 ? 'bg-[#0B5D3B] text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              2
            </div>
            <span
              className={`text-xs font-bold ${
                activeStep === 2 ? 'text-[#0B5D3B]' : 'text-gray-700'
              }`}
            >
              Delivery
            </span>
          </button>

          <div className={`flex-1 h-0.5 mx-2.5 transition-colors ${activeStep >= 3 ? 'bg-[#FF7A00]' : 'bg-gray-200'}`} />

          {/* Step 3: Payment */}
          <button
            type="button"
            onClick={() => setActiveStep(3)}
            className="flex items-center gap-1.5 focus:outline-none"
          >
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all shadow-xs ${
                activeStep === 3 ? 'bg-[#FF7A00] text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              3
            </div>
            <span
              className={`text-xs font-bold ${
                activeStep === 3 ? 'text-[#FF7A00]' : 'text-gray-700'
              }`}
            >
              Payment
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left Column: Interactive Step Content */}
        <div className="lg:col-span-8 space-y-4">
          {/* STEP 1: Address */}
          {activeStep === 1 && (
            <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#FF7A00]" />
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">1. Select Delivery Address</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setNewAddressModalOpen(true)}
                  className="flex items-center gap-1 text-xs font-bold text-[#0B5D3B] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Address</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {addresses.map((addr) => {
                  const isSelected = selectedAddress?.id === addr.id;
                  return (
                    <div
                      key={addr.id}
                      onClick={() => selectAddress(addr.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'border-[#0B5D3B] bg-emerald-50/40 ring-1 ring-[#0B5D3B]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 rounded-full border items-center justify-center ${
                            isSelected ? 'border-[#0B5D3B] bg-[#0B5D3B]' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900">{addr.name}</span>
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                              {addr.type}
                            </span>
                            {addr.isDefault && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {addr.addressLine1}, {addr.locality ? `${addr.locality}, ` : ''}
                            {addr.city} – {addr.pincode}
                          </p>
                          <p className="text-[11px] text-gray-500 font-medium">{addr.phone}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 flex justify-end">
                <Button
                  size="md"
                  variant="primary"
                  onClick={() => setActiveStep(2)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="font-bold px-6"
                >
                  Continue to Delivery Method
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Delivery Method */}
          {activeStep === 2 && (
            <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#FF7A00]" />
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">2. Choose Delivery Method</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="text-xs font-bold text-gray-500 hover:text-[#0B5D3B]"
                >
                  ← Change Address
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Home Delivery */}
                <div
                  onClick={() => setDeliveryMethod('HOME_DELIVERY')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    deliveryMethod === 'HOME_DELIVERY'
                      ? 'border-[#0B5D3B] bg-emerald-50/40 ring-1 ring-[#0B5D3B]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-[#0B5D3B]">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">Home Delivery</h4>
                      <p className="text-[11px] text-gray-500">Delivery in 2–4 days</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-900">
                    {cartSubtotal >= 199 ? 'FREE' : '₹40'}
                  </span>
                </div>

                {/* Store Pickup */}
                <div
                  onClick={() => setDeliveryMethod('STORE_PICKUP')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    deliveryMethod === 'STORE_PICKUP'
                      ? 'border-[#0B5D3B] bg-emerald-50/40 ring-1 ring-[#0B5D3B]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#FFF6E9] text-[#FF7A00]">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">Store Pickup</h4>
                      <p className="text-[11px] text-gray-500">Pick up from 20Mart Store</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600">Free</span>
                </div>
              </div>

              {/* Delivery Time Slot Picker */}
              <div className="pt-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-800 mb-2">
                  <Clock className="w-3.5 h-3.5 text-[#0B5D3B]" />
                  <span>Select Delivery Slot</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {deliverySlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setDeliverySlot(slot)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                        deliverySlot === slot
                          ? 'border-[#0B5D3B] bg-emerald-50 text-[#0B5D3B] font-bold'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveStep(1)}
                >
                  Back
                </Button>
                <Button
                  size="md"
                  variant="primary"
                  onClick={() => setActiveStep(3)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="font-bold px-6"
                >
                  Continue to Payment
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Payment */}
          {activeStep === 3 && (
            <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#FF7A00]" />
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">3. Select Payment Method</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="text-xs font-bold text-gray-500 hover:text-[#0B5D3B]"
                >
                  ← Change Delivery
                </button>
              </div>

              <div className="space-y-2.5">
                {/* UPI Option */}
                <div
                  onClick={() => setPaymentMethod('ONLINE_UPI')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    paymentMethod === 'ONLINE_UPI'
                      ? 'border-[#0B5D3B] bg-emerald-50/40 ring-1 ring-[#0B5D3B]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-orange-50 text-[#FF7A00]">
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">UPI Instant Payment</h4>
                        <p className="text-[11px] text-gray-500">Google Pay, PhonePe, Paytm, BHIM</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Fastest & Free
                    </span>
                  </div>

                  {paymentMethod === 'ONLINE_UPI' && (
                    <div className="mt-3 pt-3 border-t border-emerald-100/60 flex items-center gap-2">
                      {['Google Pay', 'PhonePe', 'Paytm', 'Scan QR'].map((app) => (
                        <span
                          key={app}
                          className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-bold text-gray-700"
                        >
                          {app}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Option */}
                <div
                  onClick={() => setPaymentMethod('CARD')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    paymentMethod === 'CARD'
                      ? 'border-[#0B5D3B] bg-emerald-50/40 ring-1 ring-[#0B5D3B]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">Credit / Debit Card</h4>
                        <p className="text-[11px] text-gray-500">Visa, MasterCard, RuPay</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cash on Delivery */}
                <div
                  onClick={() => setPaymentMethod('CASH_ON_DELIVERY')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    paymentMethod === 'CASH_ON_DELIVERY'
                      ? 'border-[#0B5D3B] bg-emerald-50/40 ring-1 ring-[#0B5D3B]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                        <Banknote className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">Cash on Delivery</h4>
                        <p className="text-[11px] text-gray-500">Pay cash or scan QR upon delivery</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveStep(2)}
                >
                  Back
                </Button>
                <Button
                  size="md"
                  variant="primary"
                  isLoading={isSubmitting}
                  onClick={handlePlaceOrder}
                  className="font-bold px-8 shadow-md"
                >
                  Place Order • ₹{finalTotal}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Order Summary Sidebar */}
        <div className="lg:col-span-4 rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-4 sm:p-5 shadow-xs space-y-4 sticky top-24">
          <h3 className="text-sm sm:text-base font-bold text-gray-900 pb-2.5 border-b border-gray-100">
            Order Summary
          </h3>

          {/* Compact items list */}
          <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto space-y-1">
            {cart.map((item) => (
              <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-white border border-gray-100 p-1 flex items-center justify-center">
                    <img src={item.product.images[0]} alt={item.product.name} className="h-full w-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{item.product.name}</p>
                    <p className="text-[10px] text-gray-400">Qty: {item.quantity}</p>
                  </div>
                </div>
                <span className="font-bold text-gray-900 ml-2">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100 text-xs sm:text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Items Total ({cartCount})</span>
              <span className="font-bold text-gray-900">₹{cartSubtotal}</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Delivery Charges</span>
              {finalDeliveryCharge === 0 ? (
                <span className="font-bold text-emerald-600">FREE</span>
              ) : (
                <span className="font-bold text-gray-900">₹{finalDeliveryCharge}</span>
              )}
            </div>

            {cartDiscount > 0 && (
              <div className="flex justify-between text-[#FF7A00]">
                <span>Discount Applied</span>
                <span className="font-bold">-₹{cartDiscount}</span>
              </div>
            )}

            <hr className="border-gray-100 pt-1" />

            <div className="flex justify-between items-baseline text-sm sm:text-base font-bold text-gray-900">
              <span>Total Payable</span>
              <span className="text-xl font-bold text-[#0B5D3B]">₹{finalTotal}</span>
            </div>
          </div>

          {activeStep < 3 ? (
            <Button
              size="md"
              variant="primary"
              onClick={() => setActiveStep(activeStep + 1)}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full font-bold"
            >
              {activeStep === 1 ? 'Continue to Delivery' : 'Continue to Payment'}
            </Button>
          ) : (
            <Button
              size="md"
              variant="primary"
              isLoading={isSubmitting}
              onClick={handlePlaceOrder}
              className="w-full font-bold shadow-md"
            >
              Confirm & Pay ₹{finalTotal}
            </Button>
          )}

          <div className="pt-1 flex items-center justify-center gap-1.5 text-[10px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>100% Secure Checkout with 20Mart Guarantee</span>
          </div>
        </div>
      </div>

      {/* Add New Address Modal */}
      <Modal
        isOpen={newAddressModalOpen}
        onClose={() => setNewAddressModalOpen(false)}
        title="Add New Delivery Address"
      >
        <form onSubmit={handleAddAddress} className="space-y-3">
          <Input
            label="Full Name"
            placeholder="e.g. Amit Kumar"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <Input
            label="Phone Number"
            placeholder="+91 98765 43210"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            required
          />
          <Input
            label="Flat / House No. / Building"
            placeholder="A-21, Chanakyapuri Apartments"
            value={newLine1}
            onChange={(e) => setNewLine1(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="City"
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              required
            />
            <Input
              label="Pincode"
              value={newPincode}
              onChange={(e) => setNewPincode(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Address Type</label>
            <div className="flex gap-2">
              {(['Home', 'Work', 'Other'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setNewType(type)}
                  className={`flex-1 py-1.5 rounded-xl border text-xs font-semibold ${
                    newType === type
                      ? 'border-[#0B5D3B] bg-emerald-50 text-[#0B5D3B] font-bold'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setNewAddressModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary">
              Save Address
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-gray-400">Loading checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
