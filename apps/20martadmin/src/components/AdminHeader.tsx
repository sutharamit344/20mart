'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Menu } from 'lucide-react';
import type { SidebarUser } from './AdminSidebar';

interface AdminHeaderProps {
  user: SidebarUser;
  onMenuClick: () => void;
  canSearchProducts: boolean;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ user, onMenuClick, canSearchProducts }) => {
  const router = useRouter();
  const [q, setQ] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/products?q=${encodeURIComponent(term)}`);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center gap-2 sm:gap-3 border-b border-gray-200 bg-white/95 backdrop-blur px-3 sm:px-5">
      <button
        type="button"
        onClick={onMenuClick}
        className="lg:hidden -ml-1 rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {canSearchProducts ? (
        <form onSubmit={onSubmit} className="relative flex-1 max-w-sm" role="search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products by name or SKU…"
            aria-label="Search products"
            className="w-full h-9 rounded-lg border border-gray-200 bg-gray-50/80 pl-9 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#0B5D3B] focus:outline-none"
          />
        </form>
      ) : (
        <div className="flex-1" />
      )}

      <div className="ml-auto flex items-center gap-2 pl-2 sm:border-l border-gray-200 min-w-0">
        <div className="h-7 w-7 shrink-0 rounded-full bg-[#0B5D3B] text-white flex items-center justify-center text-[11px] font-bold">
          {user.name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((n) => n[0]?.toUpperCase())
            .join('')}
        </div>
        <div className="hidden sm:block text-left text-xs min-w-0">
          <p className="font-bold text-gray-900 leading-tight truncate max-w-[10rem]">{user.name}</p>
          <p className="text-[10px] text-gray-400 truncate max-w-[10rem]">{user.roleLabel}</p>
        </div>
      </div>
    </header>
  );
};
