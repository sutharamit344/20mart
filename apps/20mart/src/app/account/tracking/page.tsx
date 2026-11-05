'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AccountLayout } from '../../../components/AccountLayout';
import { useStore } from '../../../lib/store';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@20mart/ui';

function TrackingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderParam = searchParams.get('order');
  const { orders } = useStore();

  const order =
    (orderParam ? orders.find((o) => o.orderNumber === orderParam) : null) ||
    orders[0];

  if (!order) {
    return (
      <div className="rounded-3xl border border-gray-100 bg-white p-10 text-center">
        <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-gray-800">No active order to track</h3>
        <p className="text-xs text-gray-500 max-w-xs mx-auto mt-1 mb-5">
          You haven't placed any recent orders yet.
        </p>
        <Button size="sm" onClick={() => router.push('/shop')}>
          Start Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Visual Tracking Hero Card (Screen 09 Reference) */}
      <div className="rounded-3xl border border-gray-100 bg-gradient-to-br from-amber-50/50 via-white to-emerald-50/30 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#FFF6E9] text-[#FF7A00] border border-orange-200/50">
              <span className="w-2 h-2 rounded-full bg-[#FF7A00] animate-ping" />
              <span>In Transit</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900">
              Track Order #{order.orderNumber}
            </h2>
            <p className="text-xs text-gray-500">
              Expected delivery by <strong className="text-gray-900">Today, 7:00 PM</strong>
            </p>
          </div>

          {/* 3D Delivery Box Illustration */}
          <div className="relative flex items-center justify-center">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-amber-100/60 flex items-center justify-center shadow-inner border border-amber-200/50">
              <span className="text-5xl">📦</span>
            </div>
          </div>
        </div>

        {/* Vertical Timeline Stepper */}
        <div className="mt-8 pt-6 border-t border-gray-100 max-w-xl mx-auto space-y-6">
          {order.timeline.map((step, idx) => {
            const isLast = idx === order.timeline.length - 1;
            return (
              <div key={idx} className="relative flex items-start gap-4">
                {/* Connecting Line */}
                {!isLast && (
                  <div
                    className={`absolute left-4 top-8 -bottom-2 w-0.5 ${
                      step.completed ? 'bg-[#0B5D3B]' : 'bg-gray-200'
                    }`}
                  />
                )}

                {/* Node icon */}
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold transition-all ${
                    step.completed
                      ? 'bg-[#0B5D3B] ring-4 ring-emerald-50 shadow-xs'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </div>

                {/* Node Info */}
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4
                      className={`text-sm font-bold ${
                        step.completed ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {step.title}
                    </h4>
                    <span className="text-[11px] text-gray-400 font-medium">
                      {step.timestamp}
                    </span>
                  </div>
                  {step.completed && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Order has been processed at 20Mart Hub
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Courier Partner & Delivery Address */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Delivery Address */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2 text-gray-900 font-bold">
            <MapPin className="w-4 h-4 text-[#FF7A00]" />
            <span>Delivery Destination</span>
          </div>
          <p className="font-bold text-gray-900">{order.deliveryAddress.name}</p>
          <p className="text-gray-600 leading-relaxed">
            {order.deliveryAddress.addressLine1}, {order.deliveryAddress.city} – {order.deliveryAddress.pincode}
          </p>
          <p className="text-gray-500">{order.deliveryAddress.phone}</p>
        </div>

        {/* Courier Info / Support */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-3 text-xs">
          <div className="flex items-center gap-2 text-gray-900 font-bold">
            <Truck className="w-4 h-4 text-[#0B5D3B]" />
            <span>20Mart Express Delivery</span>
          </div>
          <p className="text-gray-600">
            Rider is assigned and on route with your package. For delivery queries, call our 24x7 helpdesk.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <a
              href="tel:+919876543210"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-800 font-bold text-xs hover:bg-gray-50 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-[#0B5D3B]" />
              <span>Call Rider</span>
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 text-xs text-[#FF7A00] font-bold hover:underline"
            >
              <span>Need Help?</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Ordered Items Preview */}
      <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-5 shadow-xs space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 pb-2 border-b border-gray-100">
          Order Items ({order.items.length})
        </h4>

        <div className="divide-y divide-gray-100">
          {order.items.map((item) => (
            <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-50 p-1 border border-gray-100 flex items-center justify-center">
                  <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                </div>
                <div>
                  <h5 className="font-bold text-gray-900">{item.name}</h5>
                  <span className="text-[11px] text-gray-400">Qty: {item.quantity}</span>
                </div>
              </div>
              <span className="font-black text-gray-900">₹{item.price * item.quantity}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  return (
    <AccountLayout
      title="Order Tracking"
      subtitle="Real-time delivery status for your everyday orders"
      activeKey="tracking"
    >
      <Suspense fallback={<div className="p-8 text-center text-xs text-gray-400">Loading tracking data...</div>}>
        <TrackingContent />
      </Suspense>
    </AccountLayout>
  );
}

