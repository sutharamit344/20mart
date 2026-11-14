'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar, type SidebarUser } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { useAdmin } from '../lib/admin-store';

interface AdminShellProps {
  user: SidebarUser;
  permissions: string[];
  storefrontUrl: string;
  children: React.ReactNode;
}

export const AdminShell: React.FC<AdminShellProps> = ({ user, permissions, storefrontUrl, children }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { inquiries } = useAdmin();
  const newInquiries = inquiries.filter((i) => i.status === 'NEW').length;

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
      />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <AdminHeader
          user={user}
          onMenuClick={() => setOpen(true)}
          canSearchProducts={permissions.includes('products.view')}
        />
        <main className="p-3 sm:p-5 lg:p-6 flex-1 w-full max-w-[1400px] mx-auto">{children}</main>
      </div>
    </div>
  );
};
