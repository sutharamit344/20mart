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
  Truck,
  BarChart3,
  TicketPercent,
  Megaphone,
  Mail,
  Warehouse,
  Factory,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
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
  /** @deprecated Shown in the header user menu. Kept for API compatibility. */
  user: SidebarUser;
  permissions: string[];
  open: boolean;
  onClose: () => void;
  /** @deprecated Sign out now lives in the header user menu. Kept for API compatibility. */
  onLogout?: () => void;
  storefrontUrl?: string;
  inquiriesBadge?: number;
  /** Desktop icon-only mode (persisted by AdminShell). */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  permissions,
  open,
  onClose,
  storefrontUrl = 'http://localhost:3000',
  inquiriesBadge = 0,
  collapsed = false,
  onToggleCollapsed,
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
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-ink/40 transition-opacity lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 select-none flex-col bg-brand-green-900 text-white transition-[transform,width] duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${
          collapsed ? 'lg:w-[68px]' : 'lg:w-60'
        } ${open ? 'translate-x-0 shadow-pop' : '-translate-x-full'}`}
        aria-label="Admin navigation"
      >
        {/* Brand */}
        <div className={`flex h-14 shrink-0 items-center border-b border-white/10 ${collapsed ? 'lg:justify-center lg:px-0' : ''} justify-between px-3.5`}>
          <Link href="/" className="flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60" aria-label="Admin dashboard">
            <span className={collapsed ? 'lg:hidden' : ''}>
              <Logo size="sm" inverted={true} />
            </span>
            {collapsed && (
              <span className="hidden lg:inline-flex">
                <Logo variant="icon" size="sm" />
              </span>
            )}
          </Link>
          <div className={`flex items-center gap-1 ${collapsed ? 'lg:hidden' : ''}`}>
            <span className="rounded-md bg-brand-orange px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Admin</span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3" aria-label="Sections">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-0.5">
              <p className={`px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/45 ${collapsed ? 'lg:sr-only' : ''}`}>
                {section.title}
              </p>
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                      collapsed ? 'lg:justify-center lg:px-0' : ''
                    } ${active ? 'bg-white/[0.12] text-white' : 'text-white/70 hover:bg-white/[0.07] hover:text-white'}`}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-orange" aria-hidden />}
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-brand-orange-300' : ''}`} />
                    <span className={`truncate ${collapsed ? 'lg:sr-only' : ''}`}>{item.label}</span>
                    {!!item.badge && item.badge > 0 && (
                      <span
                        className={`ml-auto shrink-0 rounded-full bg-brand-orange px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums text-white ${
                          collapsed ? 'lg:absolute lg:right-1 lg:top-1 lg:ml-0' : ''
                        }`}
                        aria-label={`${item.badge} new`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer: storefront link + collapse toggle (user menu lives in the header) */}
        <div className="shrink-0 space-y-1 border-t border-white/10 p-2.5">
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? 'Open storefront' : undefined}
            className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className={collapsed ? 'lg:sr-only' : ''}>Open storefront</span>
          </a>
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={collapsed}
              className={`hidden h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 lg:flex ${
                collapsed ? 'lg:justify-center lg:px-0' : ''
              }`}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4 shrink-0" /> : <PanelLeftClose className="h-4 w-4 shrink-0" />}
              <span className={collapsed ? 'lg:sr-only' : ''}>Collapse</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
