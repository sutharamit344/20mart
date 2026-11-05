'use client';

import React, { useState } from 'react';
import { useAdmin } from '../../lib/admin-store';
import { Coupon } from '@20mart/shared';
import { Button, Modal } from '@20mart/ui';
import { Plus, Tag, CheckCircle2, XCircle } from 'lucide-react';

export default function CouponsManagementPage() {
  const { coupons, addCoupon, toggleCouponActive } = useAdmin();

  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountValue, setDiscountValue] = useState(50);
  const [minOrderValue, setMinOrderValue] = useState(99);
  const [validUntil, setValidUntil] = useState('30 Nov 2026');
  const [source, setSource] = useState<'LAUNCH' | 'SURVEY' | 'CAMPAIGN'>('CAMPAIGN');

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    addCoupon({
      code: code.toUpperCase().trim(),
      title,
      description,
      discountType: 'FIXED',
      discountValue,
      minOrderValue,
      validUntil,
      source,
      isUnlocked: true,
      isUsed: false,
    });
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Coupons & Rewards Engine</h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure discount codes, welcome vouchers, and survey reward vouchers.
          </p>
        </div>
        <Button
          size="md"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setCode(`FESTIVE${Math.floor(10 + Math.random() * 90)}`);
            setTitle('Festive Household Discount');
            setDescription('Special flat discount across essentials.');
            setDiscountValue(40);
            setMinOrderValue(149);
            setModalOpen(true);
          }}
          className="rounded-xl font-bold"
        >
          Create Coupon
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/60 uppercase font-semibold text-gray-500 text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Coupon Code</th>
                <th className="px-5 py-3.5">Campaign Title</th>
                <th className="px-5 py-3.5">Discount</th>
                <th className="px-5 py-3.5">Min Order</th>
                <th className="px-5 py-3.5">Source Type</th>
                <th className="px-5 py-3.5">Valid Until</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-black text-sm text-[#FF7A00]">
                    {coupon.code}
                  </td>
                  <td className="px-5 py-3.5 font-bold text-gray-900">{coupon.title}</td>
                  <td className="px-5 py-3.5 font-black text-[#0B5D3B]">₹{coupon.discountValue} OFF</td>
                  <td className="px-5 py-3.5">₹{coupon.minOrderValue}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {coupon.source}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-400">{coupon.validUntil}</td>
                  <td className="px-5 py-3.5">
                    {coupon.isUnlocked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggleCouponActive(coupon.id)}
                      className="text-xs font-bold text-[#0B5D3B] hover:underline"
                    >
                      {coupon.isUnlocked ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create New Coupon Voucher"
      >
        <form onSubmit={handleCreateCoupon} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Coupon Code *</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-gray-200 p-2.5 uppercase font-mono font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Coupon Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-gray-200 p-2.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Discount (₹) *</label>
              <input
                type="number"
                required
                min={1}
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 p-2.5"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Min Order Value (₹) *</label>
              <input
                type="number"
                required
                min={0}
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 p-2.5"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Valid Until *</label>
            <input
              type="text"
              required
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full rounded-xl border border-gray-200 p-2.5"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="brand">
              Save Coupon
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

