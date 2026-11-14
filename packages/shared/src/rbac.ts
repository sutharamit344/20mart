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
  'media.upload': { group: 'Media', description: 'Upload images' },
  'pricepoints.manage': { group: 'Products', description: 'Manage price points' },
  'users.view': { group: 'Administration', description: 'View admin users and customers' },
  'users.manage': { group: 'Administration', description: 'Create, activate and deactivate admin users' },
  'roles.manage': { group: 'Administration', description: 'Assign roles and edit role permissions' },
  'audit.view': { group: 'Administration', description: 'View audit logs' },
  'settings.view': { group: 'Settings', description: 'View business settings and operations modules' },
  'settings.update': { group: 'Settings', description: 'Change business settings' },
} as const satisfies Record<string, { group: string; description: string }>;

export type PermissionKey = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

export const ROLE_KEYS = ['SUPER_ADMIN', 'ADMIN', 'PRODUCT_MANAGER', 'INVENTORY_MANAGER', 'CONTENT_MANAGER'] as const;
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
    description: 'Maintains stock levels and thresholds.',
    permissions: ['dashboard.view', 'products.view', 'inventory.view', 'inventory.update', 'inventory.adjust'],
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
