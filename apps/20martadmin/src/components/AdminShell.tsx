'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar, type SidebarUser } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

interface AdminShellProps {
  user: SidebarUser;
  permissions: string[];
  storefrontUrl: string;
  /** Count of NEW contact inquiries (from the database). */
  newInquiries: number;
  children: React.ReactNode;
}

export const AdminShell: React.FC<AdminShellProps> = ({ user, permissions, storefrontUrl, newInquiries, children }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  // Desktop sidebar collapse is a per-browser preference (UI only).
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('admin.sidebarCollapsed') === '1');
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('admin.sidebarCollapsed', c ? '0' : '1');
      } catch {
        /* storage unavailable */
      }
      return !c;
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }, [router]);

  return (
    <div className="flex min-h-screen w-full">
      <AdminSidebar
        user={user}
        permissions={permissions}
        open={open}
        onClose={close}
        onLogout={logout}
        storefrontUrl={storefrontUrl}
        inquiriesBadge={newInquiries}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-y-auto bg-surface-page">
        <AdminHeader
          user={user}
          onMenuClick={() => setOpen(true)}
          canSearchProducts={permissions.includes('products.view')}
          onLogout={logout}
          storefrontUrl={storefrontUrl}
        />
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-3 sm:p-5 lg:p-6">{children}</main>
      </div>
    </div>
  );
};
