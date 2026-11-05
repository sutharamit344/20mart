'use client';

import React, { useState } from 'react';
import { useAdmin } from '../../lib/admin-store';
import { Order, OrderStatus } from '@20mart/shared';
import { Button, Drawer } from '@20mart/ui';
import { Eye, Truck, CheckCircle2, AlertTriangle, MapPin, X } from 'lucide-react';

export default function OrdersManagementPage() {
  const { orders, updateOrderStatus } = useAdmin();

  const [filter, setFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredOrders = orders.filter((o) => {
    if (filter === 'ALL') return true;
    return o.status === filter;
  });

  const openDetails = (order: Order) => {
    setSelectedOrder(order);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Orders & Fulfillment</h1>
        <p className="text-xs text-gray-500 mt-1">
          Review customer orders, dispatch packages, and process status transitions.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'ALL', label: 'All Orders' },
          { id: 'PROCESSING', label: 'Processing' },
          { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
          { id: 'DELIVERED', label: 'Delivered' },
          { id: 'CANCELLED', label: 'Cancelled' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filter === tab.id
                ? 'bg-[#0B5D3B] text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/60 uppercase font-semibold text-gray-500 text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Order ID</th>
                <th className="px-5 py-3.5">Customer Name</th>
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-5 py-3.5">Method</th>
                <th className="px-5 py-3.5">Payment</th>
                <th className="px-5 py-3.5">Total Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-bold font-mono text-gray-900">
                    #{order.orderNumber}
                  </td>
                  <td className="px-5 py-3.5 font-bold text-gray-800">
                    {order.deliveryAddress.name}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400">{order.createdAt}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {order.deliveryMethod === 'HOME_DELIVERY' ? 'Doorstep' : 'Pickup'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      PAID
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-black text-gray-900">₹{order.total}</td>
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDetails(order)}
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                    >
                      Inspect
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedOrder ? `Order Details #${selectedOrder.orderNumber}` : ''}
        position="right"
      >
        {selectedOrder && (
          <div className="space-y-6 text-xs">
            {/* Status Quick Updater */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
              <label className="block font-bold text-gray-700">Update Fulfillment Status</label>
              <select
                value={selectedOrder.status}
                onChange={(e) => {
                  updateOrderStatus(selectedOrder.id, e.target.value as any);
                  setSelectedOrder({ ...selectedOrder, status: e.target.value as any });
                }}
                className="w-full rounded-xl border border-gray-200 bg-white p-2.5 font-bold text-xs"
              >
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            {/* Customer & Address */}
            <div className="space-y-2">
              <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">
                Customer Address
              </h4>
              <div className="p-4 rounded-2xl border border-gray-100 bg-white space-y-1">
                <p className="font-bold text-gray-900">{selectedOrder.deliveryAddress.name}</p>
                <p className="text-gray-600">
                  {selectedOrder.deliveryAddress.addressLine1}, {selectedOrder.deliveryAddress.city} –{' '}
                  {selectedOrder.deliveryAddress.pincode}
                </p>
                <p className="text-gray-500 font-medium">{selectedOrder.deliveryAddress.phone}</p>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">
                Order Items ({selectedOrder.items.length})
              </h4>
              <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white p-3">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-gray-50 p-1 border border-gray-100 shrink-0">
                        <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 line-clamp-1">{item.name}</p>
                        <span className="text-[10px] text-gray-400">Qty: {item.quantity}</span>
                      </div>
                    </div>
                    <span className="font-black text-gray-900">₹{item.price}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-2 p-4 rounded-2xl border border-gray-100 bg-white">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span className="font-bold text-gray-900">₹{selectedOrder.subtotal}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Delivery Charge</span>
                <span className="font-bold text-gray-900">₹{selectedOrder.deliveryCharge}</span>
              </div>
              <hr className="border-gray-100" />
              <div className="flex justify-between text-sm font-black text-gray-900">
                <span>Total Paid</span>
                <span className="text-[#0B5D3B]">₹{selectedOrder.total}</span>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

