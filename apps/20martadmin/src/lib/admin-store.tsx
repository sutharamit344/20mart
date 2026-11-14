'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Product,
  Order,
  Coupon,
  SurveyQuestion,
  AdminUser,
  AuditLogEntry,
  ContactInquiry,
  mockProducts,
  mockOrders,
  mockCoupons,
  mockSurveyQuestions,
  mockAdminUsers,
  mockAuditLogs,
  mockContactInquiries,
  BusinessConfigurations,
  defaultBusinessConfigurations,
} from '@20mart/shared';

interface AdminContextType {
  // Current admin
  currentUser: AdminUser;
  setCurrentUserRole: (role: AdminUser['role']) => void;

  // Inquiries / Customer Messages
  inquiries: ContactInquiry[];
  updateInquiryStatus: (id: string, status: ContactInquiry['status'], notes?: string) => void;
  addInquiry: (inquiry: Omit<ContactInquiry, 'id' | 'ticketNumber' | 'createdAt'>) => void;
  deleteInquiry: (id: string) => void;

  // Products
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (productId: string, delta: number, note?: string) => void;

  // Orders
  orders: Order[];
  updateOrderStatus: (orderId: string, status: Order['status']) => void;

  // Coupons
  coupons: Coupon[];
  addCoupon: (coupon: Omit<Coupon, 'id'>) => void;
  toggleCouponActive: (id: string) => void;

  // Questions
  questions: SurveyQuestion[];
  addQuestion: (q: Omit<SurveyQuestion, 'id' | 'order'>) => void;
  deleteQuestion: (id: string) => void;

  // Configurations
  configs: BusinessConfigurations;
  updateConfigs: (section: keyof BusinessConfigurations, values: any) => void;
  configHistory: { timestamp: string; section: string; admin: string; changeNote: string }[];

  // Audit
  auditLogs: AuditLogEntry[];
  addAuditLog: (action: string, category: AuditLogEntry['category'], details: string) => void;

  // Feedback Toast
  toast: string | null;
  showToast: (msg: string) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AdminUser>(mockAdminUsers[0]);
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [coupons, setCoupons] = useState<Coupon[]>(mockCoupons);
  const [questions, setQuestions] = useState<SurveyQuestion[]>(mockSurveyQuestions);
  const [configs, setConfigs] = useState<BusinessConfigurations>(defaultBusinessConfigurations);
  const [configHistory, setConfigHistory] = useState([
    {
      timestamp: 'Today, 11:42 PM',
      section: 'shopping',
      admin: 'Pooja Sharma',
      changeNote: 'Maintained free delivery at ₹199; min cart value ₹50.',
    },
    {
      timestamp: 'Yesterday, 02:15 PM',
      section: 'delivery',
      admin: 'Rahul Patel',
      changeNote: 'Set standard delivery charge to ₹40 across Ahmedabad.',
    },
  ]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(mockAuditLogs);
  // Start from deterministic data so server and client render identically;
  // persisted inquiries are loaded after mount to avoid hydration mismatches.
  const [inquiries, setInquiries] = useState<ContactInquiry[]>(mockContactInquiries);
  const inquiriesLoaded = React.useRef(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('20mart_admin_inquiries');
      if (saved) setInquiries(JSON.parse(saved));
    } catch {
      // storage unavailable or corrupt: keep defaults
    }
    inquiriesLoaded.current = true;
  }, []);

  useEffect(() => {
    if (!inquiriesLoaded.current) return;
    try {
      localStorage.setItem('20mart_admin_inquiries', JSON.stringify(inquiries));
    } catch {
      // ignore storage quota error
    }
  }, [inquiries]);

  // Try fetching any newly submitted inquiries from API
  useEffect(() => {
    const fetchInquiries = async () => {
      try {
        const res = await fetch('/api/inquiries');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setInquiries((prev) => {
              const existingIds = new Set(prev.map((i) => i.id));
              const newItems = data.filter((d: ContactInquiry) => !existingIds.has(d.id));
              if (newItems.length > 0) {
                return [...newItems, ...prev];
              }
              return prev;
            });
          }
        }
      } catch (err) {
        // fallback
      }
    };
    fetchInquiries();
  }, []);

  const updateInquiryStatus = (id: string, status: ContactInquiry['status'], notes?: string) => {
    setInquiries((prev) =>
      prev.map((inq) =>
        inq.id === id
          ? {
              ...inq,
              status,
              adminNotes: notes !== undefined ? notes : inq.adminNotes,
            }
          : inq
      )
    );
    addAuditLog(
      `Updated Inquiry #${id}`,
      'USER_MANAGEMENT',
      `Status changed to ${status}${notes ? `. Notes: ${notes}` : ''}`
    );
    showToast(`Inquiry status updated to ${status}`);
  };

  const addInquiry = (inquiryData: Omit<ContactInquiry, 'id' | 'ticketNumber' | 'createdAt'>) => {
    const newInquiry: ContactInquiry = {
      ...inquiryData,
      id: `inq-${Date.now()}`,
      ticketNumber: `INQ-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: 'Just now',
    };
    setInquiries((prev) => [newInquiry, ...prev]);
    addAuditLog('Created Customer Inquiry', 'USER_MANAGEMENT', `Inquiry for ${inquiryData.name} (${inquiryData.subject})`);
    showToast('Customer inquiry created successfully!');
  };

  const deleteInquiry = (id: string) => {
    setInquiries((prev) => prev.filter((i) => i.id !== id));
    addAuditLog('Deleted Customer Inquiry', 'USER_MANAGEMENT', `Deleted inquiry ${id}`);
    showToast('Inquiry removed');
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const addAuditLog = (action: string, category: AuditLogEntry['category'], details: string) => {
    const entry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: 'Just now',
      adminName: currentUser.name,
      action,
      category,
      details,
    };
    setAuditLogs((prev) => [entry, ...prev]);
  };

  const setCurrentUserRole = (role: AdminUser['role']) => {
    const found = mockAdminUsers.find((u) => u.role === role);
    if (found) {
      setCurrentUser(found);
      showToast(`Switched active admin to ${found.name} (${role})`);
    } else {
      setCurrentUser((prev) => ({ ...prev, role }));
      showToast(`Switched role to ${role}`);
    }
  };

  // Products
  const addProduct = (prodData: Omit<Product, 'id'>) => {
    const newProd: Product = {
      ...prodData,
      id: `prod-${Date.now()}`,
    };
    setProducts((prev) => [newProd, ...prev]);
    addAuditLog('Created New Product', 'PRODUCT', `Added SKU ${newProd.sku}: ${newProd.name}`);
    showToast(`Product "${newProd.name}" created!`);
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    addAuditLog('Updated Product', 'PRODUCT', `Modified product details for ID ${id}`);
    showToast('Product updated successfully!');
  };

  const deleteProduct = (id: string) => {
    const prod = products.find((p) => p.id === id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
    addAuditLog('Deleted Product', 'PRODUCT', `Removed product ${prod?.name || id}`);
    showToast('Product removed');
  };

  const adjustStock = (productId: string, delta: number, note?: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const newStock = Math.max(0, p.stock + delta);
          return { ...p, stock: newStock, inStock: newStock > 0 };
        }
        return p;
      })
    );
    addAuditLog(
      'Adjusted Stock',
      'PRODUCT',
      `Modified stock by ${delta > 0 ? `+${delta}` : delta} for product ID ${productId}. Note: ${note || 'Manual adjustment'}`
    );
    showToast('Stock level adjusted!');
  };

  // Orders
  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId || o.orderNumber === orderId ? { ...o, status } : o))
    );
    addAuditLog('Updated Order Status', 'ORDER', `Order #${orderId} marked as ${status}`);
    showToast(`Order #${orderId} updated to ${status}`);
  };

  // Coupons
  const addCoupon = (couponData: Omit<Coupon, 'id'>) => {
    const newCoupon: Coupon = {
      ...couponData,
      id: `cp-${Date.now()}`,
    };
    setCoupons((prev) => [newCoupon, ...prev]);
    addAuditLog('Created Coupon', 'COUPON', `Created code ${newCoupon.code}`);
    showToast(`Coupon ${newCoupon.code} created!`);
  };

  const toggleCouponActive = (id: string) => {
    setCoupons((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isUnlocked: !c.isUnlocked } : c))
    );
    showToast('Coupon status updated');
  };

  // Questions
  const addQuestion = (q: Omit<SurveyQuestion, 'id' | 'order'>) => {
    const newQ: SurveyQuestion = {
      ...q,
      id: `sq-${Date.now()}`,
      order: questions.length + 1,
    };
    setQuestions((prev) => [...prev, newQ]);
    showToast('Survey question added!');
  };

  const deleteQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    showToast('Question deleted');
  };

  // Configurations
  const updateConfigs = (section: keyof BusinessConfigurations, values: any) => {
    setConfigs((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...values },
    }));
    setConfigHistory((prev) => [
      {
        timestamp: 'Just now',
        section,
        admin: currentUser.name,
        changeNote: `Updated ${section} configuration rules`,
      },
      ...prev,
    ]);
    addAuditLog('Updated Configuration', 'CONFIG', `Modified section: ${section}`);
    showToast(`Configuration for ${section} saved successfully!`);
  };

  return (
    <AdminContext.Provider
      value={{
        currentUser,
        setCurrentUserRole,
        inquiries,
        updateInquiryStatus,
        addInquiry,
        deleteInquiry,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        adjustStock,
        orders,
        updateOrderStatus,
        coupons,
        addCoupon,
        toggleCouponActive,
        questions,
        addQuestion,
        deleteQuestion,
        configs,
        updateConfigs,
        configHistory,
        auditLogs,
        addAuditLog,
        toast,
        showToast,
      }}
    >
      {children}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5 rounded-xl bg-gray-900 px-4 py-3 text-xs font-bold text-white shadow-xl border border-gray-700">
            <span className="h-2 w-2 rounded-full bg-[#FF7A00]" />
            <span>{toast}</span>
          </div>
        </div>
      )}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

