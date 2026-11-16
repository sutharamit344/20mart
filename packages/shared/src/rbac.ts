/**
 * Canonical permission catalogue and default role → permission mapping.
 * The database is the source of truth at runtime (Role/Permission/RolePermission);
 * these definitions are what `db:seed` syncs into it.
 */

export const PERMISSIONS = {
  'dashboard.view': { group: 'Dashboard', description: 'View the admin dashboard' },
  'products.view': { group: 'Products', description: 'View products' },
  'products.create': { group: 'Products', description: 'Create products' },
  'products.update': { group: 'Products', description: 'Edit products, prices, variants and images' },
  'products.delete': { group: 'Products', description: 'Archive or delete products' },
  'categories.view': { group: 'Categories', description: 'View categories' },
  'categories.create': { group: 'Categories', description: 'Create categories' },
  'categories.update': { group: 'Categories', description: 'Edit categories' },
  'categories.delete': { group: 'Categories', description: 'Delete empty categories' },
  'brands.view': { group: 'Brands', description: 'View brands' },
  'brands.create': { group: 'Brands', description: 'Create brands' },
  'brands.update': { group: 'Brands', description: 'Edit brands' },
  'brands.delete': { group: 'Brands', description: 'Delete unused brands' },
  'inventory.view': { group: 'Inventory', description: 'View stock levels and history' },
  'inventory.update': { group: 'Inventory', description: 'Change low-stock thresholds' },
  'inventory.adjust': { group: 'Inventory', description: 'Add, remove or correct stock' },
  'warehouses.view': { group: 'Warehouses', description: 'View warehouses, their stock and delivery-area coverage' },
  'warehouses.manage': { group: 'Warehouses', description: 'Create, edit, activate or pause warehouses and map them to delivery areas' },
  'suppliers.view': { group: 'Procurement', description: 'View suppliers' },
  'suppliers.manage': { group: 'Procurement', description: 'Create and edit suppliers' },
  'purchasing.view': { group: 'Procurement', description: 'View purchase orders and goods receipts' },
  'purchasing.manage': { group: 'Procurement', description: 'Create, edit, order, cancel and close purchase orders' },
  'purchasing.receive': { group: 'Procurement', description: 'Confirm received goods (adds stock to the receiving warehouse)' },
  'media.upload': { group: 'Media', description: 'Upload images' },
  'pricepoints.manage': { group: 'Products', description: 'Manage price points' },
  'orders.view': { group: 'Orders', description: 'View orders, payments and status history' },
  'orders.update': { group: 'Orders', description: 'Move orders through fulfilment statuses and add notes' },
  'orders.cancel': { group: 'Orders', description: 'Cancel eligible orders' },
  'orders.refund': { group: 'Orders', description: 'Initiate and record refunds' },
  'customers.view': { group: 'Customers', description: 'View customer accounts, orders and coupon history' },
  'customers.update': { group: 'Customers', description: 'Activate or deactivate customer accounts' },
  'inquiries.view': { group: 'Customers', description: 'Read customer contact messages' },
  'inquiries.manage': { group: 'Customers', description: 'Update status, priority and notes of contact messages' },
  'delivery.view': { group: 'Delivery', description: 'View delivery zones, PIN codes, charges and payment methods' },
  'delivery.update': { group: 'Delivery', description: 'Change delivery zones, PIN codes, charges and payment methods' },
  'coupons.view': { group: 'Marketing', description: 'View coupons and redemption history' },
  'coupons.create': { group: 'Marketing', description: 'Create coupons' },
  'coupons.update': { group: 'Marketing', description: 'Edit, activate, deactivate and issue coupons' },
  'coupons.delete': { group: 'Marketing', description: 'Delete unused coupons' },
  'campaigns.view': { group: 'Marketing', description: 'View campaigns and campaign demand analytics' },
  'campaigns.create': { group: 'Marketing', description: 'Create campaigns' },
  'campaigns.update': { group: 'Marketing', description: 'Edit, schedule, activate and deactivate campaigns' },
  'campaigns.delete': { group: 'Marketing', description: 'Delete campaigns without participants' },
  'notifications.view': { group: 'Marketing', description: 'View the email and notification log' },
  'notifications.manage': { group: 'Marketing', description: 'Send campaign announcements and retry failed emails' },
  'analytics.view': { group: 'Dashboard', description: 'View sales, customer, coupon and campaign analytics' },
  'users.view': { group: 'Administration', description: 'View admin users and customers' },
  'users.manage': { group: 'Administration', description: 'Create, activate and deactivate admin users' },
  'roles.manage': { group: 'Administration', description: 'Assign roles and edit role permissions' },
  'audit.view': { group: 'Administration', description: 'View audit logs' },
  'settings.view': { group: 'Settings', description: 'View business settings and operations modules' },
  'settings.update': { group: 'Settings', description: 'Change business settings' },
} as const satisfies Record<string, { group: string; description: string }>;

export type PermissionKey = keyof typeof PERMISSIONS;

/** Permissions removed from the catalogue → the permissions that replace them (db:seed migrates role grants). */
export const RETIRED_PERMISSIONS: Record<string, PermissionKey[]> = {
  'delivery.manage': ['delivery.view', 'delivery.update'],
};
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

export const ROLE_KEYS = ['SUPER_ADMIN', 'ADMIN', 'PRODUCT_MANAGER', 'INVENTORY_MANAGER', 'CONTENT_MANAGER', 'ORDER_MANAGER', 'MARKETING_MANAGER'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];
export const SUPER_ADMIN_ROLE: RoleKey = 'SUPER_ADMIN';

export const ROLE_DEFINITIONS: Record<
  RoleKey,
  { name: string; description: string; permissions: PermissionKey[] }
> = {
  SUPER_ADMIN: {
    name: 'Super Admin',
    description: 'Full administrative access, including roles and settings.',
    permissions: ALL_PERMISSIONS,
  },
  ADMIN: {
    name: 'Admin',
    description: 'Runs day-to-day operations. Cannot change roles or settings.',
    permissions: ALL_PERMISSIONS.filter((p) => p !== 'roles.manage' && p !== 'settings.update'),
  },
  PRODUCT_MANAGER: {
    name: 'Product Manager',
    description: 'Manages the catalog: products, categories, brands and images.',
    permissions: [
      'dashboard.view',
      'products.view',
      'products.create',
      'products.update',
      'products.delete',
      'categories.view',
      'categories.create',
      'categories.update',
      'categories.delete',
      'brands.view',
      'brands.create',
      'brands.update',
      'brands.delete',
      'media.upload',
      'pricepoints.manage',
      'inventory.view',
    ],
  },
  INVENTORY_MANAGER: {
    name: 'Inventory Manager',
    description: 'Maintains stock levels, suppliers, purchase orders and goods receiving.',
    permissions: [
      'dashboard.view',
      'products.view',
      'inventory.view',
      'inventory.update',
      'inventory.adjust',
      'warehouses.view',
      'suppliers.view',
      'suppliers.manage',
      'purchasing.view',
      'purchasing.manage',
      'purchasing.receive',
    ],
  },
  ORDER_MANAGER: {
    name: 'Order Manager',
    description: 'Processes and fulfils customer orders. Cannot refund or change catalog.',
    permissions: ['dashboard.view', 'orders.view', 'orders.update', 'orders.cancel', 'customers.view', 'inquiries.view', 'inquiries.manage', 'products.view', 'inventory.view', 'delivery.view', 'warehouses.view'],
  },
  MARKETING_MANAGER: {
    name: 'Marketing Manager',
    description: 'Runs coupons, campaigns, Fill Your Cart and announcements. No order or stock changes.',
    permissions: [
      'dashboard.view',
      'analytics.view',
      'products.view',
      'categories.view',
      'brands.view',
      'media.upload',
      'coupons.view',
      'coupons.create',
      'coupons.update',
      'coupons.delete',
      'campaigns.view',
      'campaigns.create',
      'campaigns.update',
      'campaigns.delete',
      'notifications.view',
      'notifications.manage',
      'customers.view',
    ],
  },
  CONTENT_MANAGER: {
    name: 'Content Manager',
    description: 'Edits product, category and brand content, SEO and imagery.',
    permissions: [
      'dashboard.view',
      'products.view',
      'products.update',
      'categories.view',
      'categories.update',
      'brands.view',
      'brands.update',
      'media.upload',
    ],
  },
};

export const roleLabel = (key: string) =>
  (ROLE_DEFINITIONS as Record<string, { name: string }>)[key]?.name ??
  key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' ');
