'use client';

import React, { useState } from 'react';
import { useAdmin } from '../../lib/admin-store';
import { Button, Modal } from '@20mart/ui';
import { Boxes, AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw, Plus } from 'lucide-react';
import { Product } from '@20mart/shared';

export default function InventoryManagementPage() {
  const { products, adjustStock } = useAdmin();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustmentDelta, setAdjustmentDelta] = useState(10);
  const [adjustmentType, setAdjustmentType] = useState<'ADD' | 'SUBTRACT'>('ADD');
  const [adjustmentReason, setAdjustmentReason] = useState('Restock shipment from hub');

  const lowStockCount = products.filter((p) => p.stock < 20).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;
  const totalStockUnits = products.reduce((acc, p) => acc + p.stock, 0);

  const openAdjust = (p: Product) => {
    setSelectedProduct(p);
    setAdjustmentDelta(10);
    setAdjustmentType('ADD');
    setAdjustmentReason('Restock shipment from hub');
    setAdjustModalOpen(true);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const delta = adjustmentType === 'ADD' ? adjustmentDelta : -adjustmentDelta;
    adjustStock(selectedProduct.id, delta, adjustmentReason);
    setAdjustModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Inventory Management</h1>
        <p className="text-xs text-gray-500 mt-1">
          Monitor real-time warehouse stock, log restock movements, and resolve low-stock alerts.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs font-bold text-gray-500">Total Units in Hub</span>
          <h3 className="text-2xl font-black text-gray-900">{totalStockUnits} units</h3>
          <p className="text-[11px] text-emerald-600 font-semibold">Across {products.length} SKUs</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs font-bold text-gray-500">Low Stock Warnings</span>
          <h3 className="text-2xl font-black text-amber-600">{lowStockCount} items</h3>
          <p className="text-[11px] text-gray-400">Under 20 units threshold</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-1">
          <span className="text-xs font-bold text-gray-500">Out of Stock</span>
          <h3 className="text-2xl font-black text-red-600">{outOfStockCount} items</h3>
          <p className="text-[11px] text-gray-400">Requires immediate restock</p>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Stock Levels by Product</h3>
          <span className="text-xs text-gray-400">{products.length} registered products</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/60 uppercase font-semibold text-gray-500 text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Product SKU</th>
                <th className="px-5 py-3.5">Product Name</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Current Stock</th>
                <th className="px-5 py-3.5">Threshold Status</th>
                <th className="px-5 py-3.5 text-right">Adjustment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3 font-mono font-bold text-gray-900">{p.sku}</td>
                  <td className="px-5 py-3 flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-gray-50 p-1 border border-gray-100 shrink-0">
                      <img src={p.images[0]} alt={p.name} className="h-full w-full object-contain" />
                    </div>
                    <span className="font-semibold text-gray-800 line-clamp-1">{p.name}</span>
                  </td>
                  <td className="px-5 py-3">{p.category}</td>
                  <td className="px-5 py-3 font-black text-sm text-gray-900">{p.stock}</td>
                  <td className="px-5 py-3">
                    {p.stock === 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700">
                        Out of Stock
                      </span>
                    ) : p.stock < 20 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800">
                        Low Stock Alert
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        Adequate
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAdjust(p)}
                      className="text-xs font-bold"
                    >
                      Adjust Stock
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title={`Adjust Stock: ${selectedProduct?.name}`}
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between">
            <span className="text-gray-500">Current Stock</span>
            <span className="text-base font-black text-gray-900">{selectedProduct?.stock} units</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAdjustmentType('ADD')}
              className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 ${
                adjustmentType === 'ADD'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              <span>Restock (+)</span>
            </button>
            <button
              type="button"
              onClick={() => setAdjustmentType('SUBTRACT')}
              className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 ${
                adjustmentType === 'SUBTRACT'
                  ? 'border-red-500 bg-red-50 text-red-800'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              <ArrowDownRight className="w-4 h-4 text-red-600" />
              <span>Damage / Lost (-)</span>
            </button>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Adjustment Quantity</label>
            <input
              type="number"
              min={1}
              required
              value={adjustmentDelta}
              onChange={(e) => setAdjustmentDelta(Number(e.target.value))}
              className="w-full rounded-xl border border-gray-200 p-2.5 font-bold text-sm"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Reason / Note</label>
            <input
              type="text"
              required
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              className="w-full rounded-xl border border-gray-200 p-2.5"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAdjustModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="brand">
              Confirm Adjustment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

