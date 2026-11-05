'use client';

import React from 'react';
import Link from 'next/link';
import { useAdmin } from '../lib/admin-store';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Tag,
  ArrowUpRight,
  AlertTriangle,
  Package,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@20mart/ui';

export default function AdminDashboardPage() {
  const { products, orders, coupons, updateOrderStatus } = useAdmin();

  // Metrics
  const totalRevenue = 482900;
  const totalOrdersCount = orders.length + 1277;
  const totalCustomersCount = 3420;
  const activeCouponsCount = coupons.filter((c) => c.isUnlocked).length;

  const lowStockProducts = products.filter((p) => p.stock < 20);

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time business performance and operational metrics for 20Mart.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/products">
            <Button size="sm" variant="outline">
              Manage Products
            </Button>
          </Link>
          <Link href="/orders">
            <Button size="sm" variant="brand">
              Process Orders
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Gross Sales</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-[#0B5D3B]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-gray-900">₹{totalRevenue.toLocaleString()}</h3>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+14.2% vs last week</span>
            </div>
          </div>
        </div>

        {/* Orders */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Total Orders</span>
            <div className="p-2 rounded-xl bg-orange-50 text-[#FF7A00]">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-gray-900">{totalOrdersCount}</h3>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+8.4% new orders</span>
            </div>
          </div>
        </div>

        {/* Customers */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Active Customers</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-gray-900">{totalCustomersCount}</h3>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+19.1% signups</span>
            </div>
          </div>
        </div>

        {/* Coupons */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Active Coupons</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-gray-900">{activeCouponsCount} Active</h3>
            <p className="text-[11px] text-gray-400">WELCOME50 & SURVEY50 live</p>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts & Sales Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sales Trend Bar Visual */}
        <div className="lg:col-span-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Weekly Revenue Breakdown</h3>
              <p className="text-[11px] text-gray-400">Daily turnover across Ahmedabad deliveries</p>
            </div>
            <span className="text-xs font-bold text-[#0B5D3B] bg-emerald-50 px-2.5 py-1 rounded-lg">
              This Week
            </span>
          </div>

          {/* Bar Chart Simulation */}
          <div className="h-52 flex items-end gap-3 pt-6 pb-2 justify-between">
            {[
              { day: 'Mon', amount: 54000, height: '55%' },
              { day: 'Tue', amount: 62000, height: '65%' },
              { day: 'Wed', amount: 71000, height: '75%' },
              { day: 'Thu', amount: 68000, height: '70%' },
              { day: 'Fri', amount: 89000, height: '90%' },
              { day: 'Sat', amount: 95000, height: '98%' },
              { day: 'Sun', amount: 82000, height: '82%' },
            ].map((col) => (
              <div key={col.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div
                  className="w-full rounded-t-lg bg-[#0B5D3B] hover:bg-[#FF7A00] transition-colors relative group"
                  style={{ height: col.height }}
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    ₹{col.amount}
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-gray-500">{col.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="lg:col-span-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-gray-900">Low Stock Alerts</h3>
            </div>
            <Link href="/inventory" className="text-[11px] font-bold text-[#FF7A00] hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-100"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-white p-1 border border-amber-200 shrink-0">
                    <img src={p.images[0]} alt={p.name} className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 line-clamp-1">{p.name}</h4>
                    <span className="text-[10px] text-gray-400">SKU: {p.sku}</span>
                  </div>
                </div>
                <span className="text-xs font-black text-amber-800 bg-white px-2 py-1 rounded-lg border border-amber-200 whitespace-nowrap">
                  {p.stock} left
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-xs overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Recent Customer Orders</h3>
            <p className="text-[11px] text-gray-400">Latest transactions requiring fulfillment</p>
          </div>
          <Link href="/orders" className="text-xs font-bold text-[#0B5D3B] hover:underline">
            View All Orders →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/60 uppercase font-semibold text-gray-500 text-[10px]">
              <tr>
                <th className="px-5 py-3">Order Number</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Items</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-gray-900">#{order.orderNumber}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-800">
                    {order.deliveryAddress.name}
                  </td>
                  <td className="px-5 py-3.5">{order.items.length} items</td>
                  <td className="px-5 py-3.5 font-bold text-[#0B5D3B]">₹{order.total}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        order.status === 'DELIVERED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : order.status === 'OUT_FOR_DELIVERY'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <select
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value as any)}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 focus:outline-none"
                    >
                      <option value="PROCESSING">Processing</option>
                      <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

