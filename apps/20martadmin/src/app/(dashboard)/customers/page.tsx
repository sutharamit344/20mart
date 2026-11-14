'use client';

import React, { useState } from 'react';
import { Button, Drawer } from '@20mart/ui';
import { Eye, UserCheck, ShieldAlert, ShoppingBag, MapPin } from 'lucide-react';
import { mockOrders } from '@20mart/shared';

export default function CustomersManagementPage() {
  const [customers, setCustomers] = useState([
    {
      id: 'cust-1',
      name: 'Amit Kumar',
      phone: '+91 98765 43210',
      email: 'amit@example.com',
      ordersCount: 3,
      totalSpent: 530,
      joined: '20 Oct 2026',
      status: 'ACTIVE',
      address: 'A-21, Chanakyapuri, Ahmedabad – 380061',
    },
    {
      id: 'cust-2',
      name: 'Priya Joshi',
      phone: '+91 98251 98765',
      email: 'priya.j@example.com',
      ordersCount: 5,
      totalSpent: 1240,
      joined: '15 Oct 2026',
      status: 'ACTIVE',
      address: 'B-104, Bodakdev, Ahmedabad – 380054',
    },
    {
      id: 'cust-3',
      name: 'Hardik Mehta',
      phone: '+91 97123 45678',
      email: 'hardik.m@example.com',
      ordersCount: 1,
      totalSpent: 190,
      joined: '01 Nov 2026',
      status: 'ACTIVE',
      address: 'C-302, Vastrapur, Ahmedabad – 380015',
    },
    {
      id: 'cust-4',
      name: 'Sneha Shah',
      phone: '+91 99090 11223',
      email: 'sneha.shah@example.com',
      ordersCount: 0,
      totalSpent: 0,
      joined: '02 Nov 2026',
      status: 'ACTIVE',
      address: 'Satellite, Ahmedabad – 380015',
    },
  ]);

  const [selectedCust, setSelectedCust] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleStatus = (id: string) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: c.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } : c
      )
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Customer Directory</h1>
        <p className="text-xs text-gray-500 mt-1">
          View registered customer accounts, order history, and account activity.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/60 uppercase font-semibold text-gray-500 text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Customer Name</th>
                <th className="px-5 py-3.5">Mobile Phone</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Total Orders</th>
                <th className="px-5 py-3.5">Total Spent</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customers.map((cust) => (
                <tr key={cust.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-gray-900">{cust.name}</td>
                  <td className="px-5 py-3.5 font-mono text-gray-700">{cust.phone}</td>
                  <td className="px-5 py-3.5 text-gray-500">{cust.email}</td>
                  <td className="px-5 py-3.5 font-bold">{cust.ordersCount} orders</td>
                  <td className="px-5 py-3.5 font-black text-[#0B5D3B]">₹{cust.totalSpent}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        cust.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {cust.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedCust(cust);
                          setDrawerOpen(true);
                        }}
                      >
                        Profile
                      </Button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(cust.id)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${
                          cust.status === 'ACTIVE'
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {cust.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedCust ? `Customer: ${selectedCust.name}` : ''}
        position="right"
      >
        {selectedCust && (
          <div className="space-y-6 text-xs">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="h-12 w-12 rounded-2xl bg-[#0B5D3B] text-white flex items-center justify-center text-lg font-black">
                {selectedCust.name.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">{selectedCust.name}</h3>
                <p className="text-gray-500">{selectedCust.phone}</p>
                <p className="text-gray-400">{selectedCust.email}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-gray-100 bg-white space-y-1">
              <span className="font-bold text-gray-900">Primary Delivery Address</span>
              <p className="text-gray-600">{selectedCust.address}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-orange-50 border border-orange-100">
                <span className="text-gray-500 text-[10px]">Total Orders</span>
                <p className="text-lg font-black text-[#FF7A00]">{selectedCust.ordersCount}</p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                <span className="text-gray-500 text-[10px]">Total Lifetime Spent</span>
                <p className="text-lg font-black text-[#0B5D3B]">₹{selectedCust.totalSpent}</p>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

