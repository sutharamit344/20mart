'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

/**
 * Minimal client context for the admin UI: the signed-in admin's display name
 * and a toast helper. All business data (catalog, inventory, orders, customers,
 * inquiries, admins, audit) is loaded from the database by server components.
 */
interface AdminContextType {
  adminName: string;
  toast: string | null;
  showToast: (msg: string) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ adminName: string; children: React.ReactNode }> = ({ adminName, children }) => {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <AdminContext.Provider value={{ adminName, toast, showToast }}>
      {children}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-xs font-bold text-white shadow-xl border border-gray-700">
            <span className="h-2 w-2 rounded-full bg-brand-orange" />
            <span>{toast}</span>
          </div>
        </div>
      )}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) throw new Error('useAdmin must be used within an AdminProvider');
  return context;
};
