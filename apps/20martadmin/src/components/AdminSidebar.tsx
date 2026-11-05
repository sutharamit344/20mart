'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@20mart/ui';
import { useAdmin } from '../lib/admin-store';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingBag,
  Users,
  Tag,
  HelpCircle,
  Megaphone,
  Sliders,
  ShieldCheck,
  FileText,
  ExternalLink,
} from 'lucide-react';

export const AdminSidebar: React.FC = () => {
  const pathname = usePathname();
  const { currentUser, setCurrentUserRole } = useAdmin();

  const navSections = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Operations & Catalog',
      items: [
        { label: 'Products', href: '/products', icon: Package },
        { label: 'Inventory', href: '/inventory', icon: Boxes },
        { label: 'Orders', href: '/orders', icon: ShoppingBag },
        { label: 'Customers', href: '/customers', icon: Users },
      ],
    },
    {
      title: 'Growth & Rewards',
      items: [
        { label: 'Coupons', href: '/coupons', icon: Tag },
        { label: 'Product Questions', href: '/questions', icon: HelpCircle },
        { label: 'Promotions', href: '/promotions', icon: Megaphone },
      ],
    },
    {
      title: 'Settings & Security',
      items: [
        { label: 'Configurations', href: '/configurations', icon: Sliders },
        { label: 'Access Management', href: '/access', icon: ShieldCheck },
        { label: 'Audit Logs', href: '/audit', icon: FileText },
      ],
    },
  ];

  return (
    <aside className="w-60 bg-[#074028] text-white flex flex-col justify-between shrink-0 h-screen sticky top-0 overflow-y-auto z-40 select-none">
      <div className="p-4 space-y-5">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" inverted={true} />
          </Link>
          <span className="px-2 py-0.5 rounded-md bg-[#FF7A00] text-[9px] font-black uppercase tracking-wider text-white">
            Admin
          </span>
        </div>

        {/* Navigation Groups */}
        <div className="space-y-4">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-300/60 px-2.5">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-[#FF7A00] text-white shadow-xs font-bold'
                          : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer / Current Admin Card & Role Switcher */}
      <div className="p-3.5 border-t border-white/10 bg-[#042819] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-700 flex items-center justify-center text-xs font-bold text-white">
              {currentUser.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-white leading-tight">{currentUser.name}</p>
              <p className="text-[10px] text-emerald-300/70">{currentUser.role.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        {/* Quick Role Switcher for Testing Authorization */}
        <div>
          <label className="block text-[9px] uppercase font-bold text-emerald-400/80 mb-1">
            Simulate Role:
          </label>
          <select
            value={currentUser.role}
            onChange={(e) => setCurrentUserRole(e.target.value as any)}
            className="w-full rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-[11px] font-semibold text-white focus:outline-none"
          >
            <option value="SUPER_ADMIN" className="bg-[#074028]">Super Admin</option>
            <option value="OPERATIONS" className="bg-[#074028]">Operations</option>
            <option value="CATALOG_MANAGER" className="bg-[#074028]">Catalog Manager</option>
            <option value="SUPPORT_AGENT" className="bg-[#074028]">Support Agent</option>
          </select>
        </div>

        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-emerald-200 transition-colors"
        >
          <span>Storefront Portal</span>
          <ExternalLink className="w-3 h-3 text-[#FF7A00]" />
        </a>
      </div>
    </aside>
  );
};
