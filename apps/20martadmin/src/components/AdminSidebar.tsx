'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@20mart/ui';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingBag,
  Users,
  ShieldCheck,
  FileText,
  ExternalLink,
  MessageSquare,
  FolderTree,
  BadgeCheck,
  X,
  LogOut,
  Truck,
  BarChart3,
  TicketPercent,
  Megaphone,
  Mail,
  Warehouse,
  Factory,
  ClipboardList,
} from 'lucide-react';

export interface SidebarUser {
  name: string;
  roleLabel: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Permission required to see the link. Server routes enforce it independently. */
  permission?: string;
  badge?: number;
}

interface AdminSidebarProps {
  user: SidebarUser;
  permissions: string[];
  open: boolean;
  onClose: () => void;
  onLogout?: () => void;
  storefrontUrl?: string;
  inquiriesBadge?: number;
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  user,
  permissions,
  open,
  onClose,
  onLogout,
  storefrontUrl = 'http://localhost:3000',
  inquiriesBadge = 0,
}) => {
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const can = (perm?: string) => !perm || permissions.includes(perm);

  const navSections: { title: string; items: NavItem[] }[] = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', href: '/', icon: LayoutDashboard, permission: 'dashboard.view' },
        { label: 'Analytics', href: '/analytics', icon: BarChart3, permission: 'analytics.view' },
      ],
    },
    {
      title: 'Catalog & Stock',
      items: [
        { label: 'Products', href: '/products', icon: Package, permission: 'products.view' },
        { label: 'Categories', href: '/categories', icon: FolderTree, permission: 'categories.view' },
        { label: 'Brands', href: '/brands', icon: BadgeCheck, permission: 'brands.view' },
        { label: 'Inventory', href: '/inventory', icon: Boxes, permission: 'inventory.view' },
        { label: 'Warehouses', href: '/warehouses', icon: Warehouse, permission: 'warehouses.view' },
        { label: 'Purchase Orders', href: '/purchase-orders', icon: ClipboardList, permission: 'purchasing.view' },
        { label: 'Suppliers', href: '/suppliers', icon: Factory, permission: 'suppliers.view' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { label: 'Orders', href: '/orders', icon: ShoppingBag, permission: 'orders.view' },
        { label: 'Customer Inquiries', href: '/inquiries', icon: MessageSquare, permission: 'inquiries.view', badge: inquiriesBadge },
        { label: 'Customers', href: '/customers', icon: Users, permission: 'customers.view' },
        { label: 'Delivery & Payments', href: '/delivery', icon: Truck, permission: 'delivery.view' },
      ],
    },
    {
      title: 'Marketing',
      items: [
        { label: 'Coupons', href: '/coupons', icon: TicketPercent, permission: 'coupons.view' },
        { label: 'Campaigns', href: '/campaigns', icon: Megaphone, permission: 'campaigns.view' },
        { label: 'Email log', href: '/notifications', icon: Mail, permission: 'notifications.view' },
      ],
    },
    {
      title: 'Settings & Security',
      items: [
        { label: 'Access Management', href: '/access', icon: ShieldCheck, permission: 'users.view' },
        { label: 'Audit Logs', href: '/audit', icon: FileText, permission: 'audit.view' },
      ],
    },
  ]
    .map((s) => ({ ...s, items: s.items.filter((i) => can(i.permission)) }))
    .filter((s) => s.items.length > 0);

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 lg:w-60 bg-brand-green-900 text-white flex flex-col justify-between shrink-0 h-screen overflow-y-auto select-none transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
        aria-label="Admin navigation"
      >
        <div className="p-3.5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <Link href="/" className="flex items-center gap-2">
              <Logo size="sm" inverted={true} />
            </Link>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-brand-orange text-[9px] font-black uppercase tracking-wider text-white">
                Admin
              </span>
              <button
                type="button"
                onClick={onClose}
                className="lg:hidden rounded-lg p-1 text-emerald-100 hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <nav className="space-y-3.5">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-0.5">
                <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-300/60 px-2.5 pb-0.5">
                  {section.title}
                </p>
                {section.items.map((item) => {
                  const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-brand-orange text-white shadow-xs'
                          : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {!!item.badge && item.badge > 0 && (
                        <span className="ml-auto px-1.5 py-0.5 rounded-full bg-amber-400 text-gray-950 text-[10px] font-black leading-none shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="p-3 border-t border-white/10 bg-[#042819] space-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 shrink-0 rounded-lg bg-emerald-700 flex items-center justify-center text-[11px] font-bold text-white">
              {initials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white leading-tight truncate">{user.name}</p>
              <p className="text-[10px] text-emerald-300/70 truncate">{user.roleLabel}</p>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="rounded-lg p-1.5 text-emerald-200 hover:bg-white/10 hover:text-white"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-emerald-200 transition-colors"
          >
            <span>Storefront</span>
            <ExternalLink className="w-3 h-3 text-brand-orange" />
          </a>
        </div>
      </aside>
    </>
  );
};
