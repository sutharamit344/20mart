'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@20mart/ui';
import { AccountLayout } from '../../../components/AccountLayout';
import { useStore } from '../../../lib/store';
import {
  Package,
  Clock,
  CheckCircle2,
  ChevronRight,
  Truck,
} from 'lucide-react';
import { OrderStatus } from '@20mart/shared';

export default function MyOrdersPage() {
  const router = useRouter();
  const { orders } = useStore();
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'ALL') return true;
    return o.status === statusFilter;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Processing</span>
          </span>
        );
      case 'OUT_FOR_DELIVERY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
            <Truck className="w-3.5 h-3.5" />
            <span>Out for Delivery</span>
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Delivered</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <AccountLayout
      title="My Orders"
      subtitle="Track active deliveries and review your order history"
      activeKey="orders"
    >
      <div className="space-y-4">
        {/* Status Filter Tabs (Screen 10 & Mobile 08) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
          {[
            { id: 'ALL', label: 'All Orders' },
            { id: 'PROCESSING', label: 'Processing' },
            { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
            { id: 'DELIVERED', label: 'Delivered' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#FF7A00] text-white shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800">No orders found</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto mt-1 mb-5">
              You don't have any orders matching this status filter.
            </p>
            <Button size="sm" onClick={() => router.push('/shop')}>
              Browse Products
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => router.push(`/account/orders/${order.orderNumber}`)}
                className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-4 sm:p-5 shadow-xs hover:border-orange-200 hover:shadow-sm transition-all cursor-pointer space-y-3.5"
              >
                {/* Order Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-gray-900 text-sm sm:text-base">
                        #{order.orderNumber}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-[11px] text-gray-400">Placed on {order.createdAt}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-base sm:text-lg font-black text-[#0B5D3B]">
                      ₹{order.total}
                    </span>
                    <p className="text-[10px] text-gray-400">{order.items.length} items</p>
                  </div>
                </div>

                {/* Items Preview */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 overflow-x-auto py-1">
                    {order.items.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-xl bg-gray-50 p-1 border border-gray-100 flex items-center justify-center"
                        title={item.name}
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ))}
                    {order.items.length > 0 && (
                      <div className="text-xs text-gray-700 min-w-0">
                        <p className="font-bold text-gray-900 truncate max-w-[180px] sm:max-w-[260px]">
                          {order.items[0]?.name}
                        </p>
                        {order.items.length > 1 && (
                          <p className="text-[11px] text-gray-400 font-medium">
                            +{order.items.length - 1} more items
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-[#FF7A00] shrink-0">
                    <span>Details</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
