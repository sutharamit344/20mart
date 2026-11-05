'use client';

import React from 'react';
import { useAdmin } from '../lib/admin-store';
import { Search, Bell } from 'lucide-react';

export const AdminHeader: React.FC = () => {
  const { currentUser } = useAdmin();

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 shadow-2xs">
      {/* Search Input */}
      <div className="relative w-72 sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search products, orders, customers..."
          className="w-full h-9 rounded-xl border border-gray-200 bg-gray-50/80 py-1.5 pl-9 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#0B5D3B] focus:outline-none"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Hub status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Ahmedabad Hub • Online</span>
        </div>

        {/* Notifications */}
        <button
          type="button"
          className="relative rounded-xl p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#FF7A00]" />
        </button>

        {/* Current user badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
          <div className="h-7 w-7 rounded-full bg-[#0B5D3B] text-white flex items-center justify-center text-xs font-bold">
            {currentUser.name
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </div>
          <div className="hidden sm:block text-left text-xs">
            <p className="font-bold text-gray-900 leading-tight">{currentUser.name}</p>
            <p className="text-[10px] text-gray-400">{currentUser.role.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
