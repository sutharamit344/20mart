'use client';

import React, { useState } from 'react';
import { useAdmin } from '../../lib/admin-store';
import { FileText, Shield, Search } from 'lucide-react';

export default function AuditLogsPage() {
  const { auditLogs } = useAdmin();
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const filtered = auditLogs.filter((log) => {
    if (filterCategory === 'ALL') return true;
    return log.category === filterCategory;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Audit & Compliance Trail</h1>
        <p className="text-xs text-gray-500 mt-1">
          Immutable logging of administrator activities, price changes, and system configurations.
        </p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'ALL', label: 'All Activities' },
          { id: 'CONFIG', label: 'Configurations' },
          { id: 'PRODUCT', label: 'Products & Stock' },
          { id: 'ORDER', label: 'Orders & Fulfillment' },
          { id: 'COUPON', label: 'Coupons' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterCategory(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filterCategory === tab.id
                ? 'bg-[#0B5D3B] text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/60 uppercase font-semibold text-gray-500 text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Admin Staff</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Action Executed</th>
                <th className="px-5 py-3.5">Details & Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-gray-400">{log.timestamp}</td>
                  <td className="px-5 py-3.5 font-bold text-gray-900">{log.adminName}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-[10px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      {log.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-[#0B5D3B]">{log.action}</td>
                  <td className="px-5 py-3.5 text-gray-600 max-w-md">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

