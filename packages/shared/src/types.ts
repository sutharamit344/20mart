export type ProductCategory = {
  id: string;
  name: string;
  slug: string;
  iconName?: string;
  itemCount: number;
  image: string;
  color: string; // for icon circle background
  subcategories?: string[];
};

export type ProductVariant = {
  id: string;
  sku: string;
  name: string; // e.g. "Pack of 1", "Pack of 3", "500ml", "1000ml"
  price: number;
  originalPrice: number;
  stock: number;
  isDefault?: boolean;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  categorySlug: string;
  subcategory?: string;
  brand: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  rating: number;
  reviewCount: number;
  stock: number;
  inStock: boolean;
  images: string[];
  featured?: boolean;
  trending?: boolean;
  dailyDeal?: boolean;
  specialOffer?: boolean;
  tags: string[];
  variants?: ProductVariant[];
  features?: string[];
  deliveryInfo?: string;
  badge?: string;
};

export type CartItem = {
  id: string;
  productId: string;
  product: Product;
  variantId?: string;
  variantName?: string;
  quantity: number;
  price: number;
  selected?: boolean;
};

export type DeliveryAddress = {
  id: string;
  name: string;
  type: 'Home' | 'Work' | 'Other';
  addressLine1: string;
  addressLine2?: string;
  locality?: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  isDefault?: boolean;
};

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

export type OrderTimelineEvent = {
  status: OrderStatus;
  title: string;
  timestamp: string;
  description?: string;
  completed: boolean;
};

export type OrderItem = {
  id: string;
  productId: string;
  name: string;
  image: string;
  quantity: number;
  price: number;
  variantName?: string;
};

export type Order = {
  id: string;
  orderNumber: string; // e.g. "ZM78321"
  createdAt: string;
  status: OrderStatus;
  items: OrderItem[];
  itemCount: number;
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  total: number;
  deliveryAddress: DeliveryAddress;
  deliveryMethod: 'HOME_DELIVERY' | 'STORE_PICKUP';
  paymentMethod: 'ONLINE_UPI' | 'CARD' | 'CASH_ON_DELIVERY';
  paymentStatus: 'PAID' | 'PENDING' | 'REFUNDED';
  estimatedDelivery: string;
  timeline: OrderTimelineEvent[];
};

export type Coupon = {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'FIXED' | 'PERCENT';
  discountValue: number;
  minOrderValue: number;
  validUntil: string;
  category?: string;
  isUnlocked?: boolean;
  isUsed?: boolean;
  source: 'LAUNCH' | 'SURVEY' | 'CAMPAIGN' | 'REGISTRATION';
};

export type SurveyQuestion = {
  id: string;
  order: number;
  question: string;
  targetCategory?: string;
  options: {
    id: string;
    text: string;
    isRecommended?: boolean;
  }[];
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'OPERATIONS' | 'CATALOG_MANAGER' | 'SUPPORT_AGENT';
  status: 'ACTIVE' | 'SUSPENDED';
  lastActive: string;
  avatar?: string;
};

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  adminName: string;
  action: string;
  category: 'CONFIG' | 'PRODUCT' | 'ORDER' | 'COUPON' | 'USER_MANAGEMENT';
  details: string;
};

