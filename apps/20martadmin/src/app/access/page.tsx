'use client';

import React from 'react';
import { useAdmin } from '../../lib/admin-store';
import { mockAdminUsers } from '@20mart/shared';
import { ShieldCheck, UserCheck, Check, X, ShieldAlert } from 'lucide-react';
import { Button } from '@20mart/ui';

export default function AccessManagementPage() {
  const { currentUser, setCurrentUserRole, showToast } = useAdmin();

  const matrix = [
    { module: 'Products Catalog', superAdmin: 'Full', ops: 'Read-Only', catalog: 'Full', support: 'Read-Only' },
    { module: 'Inventory Adjustments', superAdmin: 'Full', ops: 'Full', catalog: 'Read-Only', support: 'None' },
    { module: 'Customer Orders & Dispatch', superAdmin: 'Full', ops: 'Full', catalog: 'Read-Only', support: 'Read & Update' },
    { module: 'Coupons & Vouchers', superAdmin: 'Full', ops: 'Read-Only', catalog: 'Full', support: 'Read-Only' },
    { module: 'Product Survey Questions', superAdmin: 'Full', ops: 'Read-Only', catalog: 'Full', support: 'Read-Only' },
    { module: 'Business Configurations', superAdmin: 'Full', ops: 'None', catalog: 'None', support: 'None' },
    { module: 'Admin Access & Audit', superAdmin: 'Full', ops: 'None', catalog: 'None', support: 'None' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Admin Access & Role-Based Permissions</h1>
        <p className="text-xs text-gray-500 mt-1">
          Manage administrator roles, assign permission matrices, and audit privilege delegations.
        </p>
      </div>

      {/* Admin Users Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Registered Admin Staff</h3>
          <span className="text-xs text-gray-400">{mockAdminUsers.length} administrators</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/60 uppercase font-semibold text-gray-500 text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Admin User</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Assigned Role</th>
                <th className="px-5 py-3.5">Account Status</th>
                <th className="px-5 py-3.5">Last Active</th>
                <th className="px-5 py-3.5 text-right">Switch Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mockAdminUsers.map((admin) => {
                const isCurrent = currentUser.email === admin.email;
                return (
                  <tr key={admin.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-gray-900 flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-[#0B5D3B] text-white flex items-center justify-center text-[10px] font-black">
                        {admin.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <span>{admin.name}</span>
                      {isCurrent && (
                        <span className="text-[9px] font-black uppercase text-[#FF7A00] bg-orange-50 px-1.5 py-0.5 rounded">
                          Active You
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{admin.email}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-800">
                        {admin.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>Active</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400">{admin.lastActive}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setCurrentUserRole(admin.role)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                          isCurrent
                            ? 'border-[#0B5D3B] bg-emerald-50 text-[#0B5D3B]'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {isCurrent ? 'Current' : 'Simulate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Permission Matrix */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Role-Based Permission Matrix (RBAC)</h3>
          <p className="text-[11px] text-gray-400">
            Enforced both at UI view layer and server action endpoints
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/60 uppercase font-semibold text-gray-500 text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Module Scope</th>
                <th className="px-5 py-3.5">SUPER ADMIN</th>
                <th className="px-5 py-3.5">OPERATIONS</th>
                <th className="px-5 py-3.5">CATALOG MANAGER</th>
                <th className="px-5 py-3.5">SUPPORT AGENT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {matrix.map((row) => (
                <tr key={row.module} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-gray-900">{row.module}</td>
                  <td className="px-5 py-3.5 font-bold text-emerald-700">{row.superAdmin}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-700">{row.ops}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-700">{row.catalog}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-500">{row.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

