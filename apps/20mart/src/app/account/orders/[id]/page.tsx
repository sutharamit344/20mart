'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@20mart/ui';
import { AccountLayout } from '../../../../components/AccountLayout';
import { useStore } from '../../../../lib/store';
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  MapPin,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = params?.id as string;
  const { orders } = useStore();

  const order =
    orders.find((o) => o.orderNumber.toUpperCase() === orderNumber?.toUpperCase()) ||
    orders[0];

  if (!order) {
    return (
      <AccountLayout title="Order Details" activeKey="orders">
        <div className="rounded-3xl border border-gray-100 bg-white p-10 text-center">
          <p className="text-gray-500 text-sm">Order not found.</p>
          <Button size="sm" className="mt-4" onClick={() => router.push('/account/orders')}>
            Back to Orders
          </Button>
        </div>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout
      title={`Order #${order.orderNumber}`}
      subtitle={`Placed on ${order.createdAt}`}
      activeKey="orders"
    >
      <div className="space-y-5">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <Link
              href="/account/orders"
              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-gray-900">
                  Order #{order.orderNumber}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                  {order.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">Placed on {order.createdAt}</p>
            </div>
          </div>

          <Link
            href={`/account/tracking?order=${order.orderNumber}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0B5D3B] text-white text-xs font-bold hover:bg-[#094c30] transition-colors shadow-xs"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Track Live</span>
          </Link>
        </div>

        {/* Stepper Status (Screen 11 Reference) */}
        <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Delivery Progress
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
            {order.timeline.map((event, idx) => (
              <div key={idx} className="relative flex sm:flex-col items-start gap-3 sm:gap-2">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white z-10 ${
                    event.completed ? 'bg-[#0B5D3B] shadow-xs' : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {event.completed ? (
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                </div>

                <div className="space-y-0.5 min-w-0">
                  <h4
                    className={`text-xs font-bold leading-tight ${
                      event.completed ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {event.title}
                  </h4>
                  <p className="text-[10px] text-gray-400">{event.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2-Column: Items List & Order Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Items */}
          <div className="lg:col-span-7 rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 pb-2 border-b border-gray-100">
              Purchased Items ({order.items.length})
            </h3>

            <div className="divide-y divide-gray-100">
              {order.items.map((item) => (
                <div key={item.id} className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 rounded-xl bg-gray-50 p-1 border border-gray-100 flex items-center justify-center">
                      <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 line-clamp-1">{item.name}</h4>
                      <p className="text-[11px] text-gray-400">Qty: {item.quantity} × ₹{item.price}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-gray-900">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Breakdown & Address */}
          <div className="lg:col-span-5 space-y-4">
            {/* Delivery Address */}
            <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-5 shadow-xs space-y-2 text-xs">
              <div className="flex items-center gap-2 text-gray-900 font-bold">
                <MapPin className="w-4 h-4 text-[#FF7A00]" />
                <span>Delivery Address</span>
              </div>
              <p className="font-bold text-gray-900">{order.deliveryAddress.name}</p>
              <p className="text-gray-600 leading-relaxed">
                {order.deliveryAddress.addressLine1}, {order.deliveryAddress.city} – {order.deliveryAddress.pincode}
              </p>
              <p className="text-gray-500 font-medium">Contact: {order.deliveryAddress.phone}</p>
            </div>

            {/* Price Summary */}
            <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-5 shadow-xs space-y-2.5 text-xs">
              <h4 className="font-bold text-gray-900 pb-2 border-b border-gray-100">Summary</h4>
              <div className="flex justify-between text-gray-600">
                <span>Items Subtotal</span>
                <span className="font-bold text-gray-900">₹{order.subtotal}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery Charge</span>
                <span className="font-bold text-[#0B5D3B]">
                  {order.deliveryCharge === 0 ? 'FREE' : `₹${order.deliveryCharge}`}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-[#FF7A00]">
                  <span>Voucher Discount</span>
                  <span className="font-bold">-₹{order.discount}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-black text-gray-900">
                <span>Total Amount</span>
                <span className="text-[#0B5D3B]">₹{order.total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
