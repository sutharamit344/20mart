import { z } from 'zod';

export const AddressSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  type: z.enum(['Home', 'Work', 'Other']),
  addressLine1: z.string().min(5, 'Address line is required'),
  addressLine2: z.string().optional(),
  locality: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  isDefault: z.boolean().optional(),
});

export const LoginPhoneSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
});

export const VerifyOtpSchema = z.object({
  otp: z.string().length(4, 'OTP must be 4 digits'),
});

export const ProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number'),
});

export const ProductSchema = z.object({
  sku: z.string().min(3, 'SKU must be at least 3 characters'),
  name: z.string().min(3, 'Product name is required'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  brand: z.string().min(1, 'Brand is required'),
  description: z.string().min(10, 'Provide a detailed description'),
  price: z.number().positive('Price must be greater than zero'),
  originalPrice: z.number().positive('Original price must be greater than zero'),
  stock: z.number().int().nonnegative('Stock cannot be negative'),
  inStock: z.boolean().default(true),
  featured: z.boolean().default(false),
  trending: z.boolean().default(false),
  dailyDeal: z.boolean().default(false),
  specialOffer: z.boolean().default(false),
});

export const CouponSchema = z.object({
  code: z.string().min(3, 'Code must be at least 3 characters').toUpperCase(),
  title: z.string().min(3, 'Title is required'),
  description: z.string().min(5, 'Description is required'),
  discountType: z.enum(['FIXED', 'PERCENT']),
  discountValue: z.number().positive('Discount value must be positive'),
  minOrderValue: z.number().nonnegative('Minimum order value required'),
  validUntil: z.string().min(1, 'Expiration date is required'),
  category: z.string().optional(),
});

export const QuestionSchema = z.object({
  question: z.string().min(5, 'Question text is required'),
  targetCategory: z.string().optional(),
  options: z.array(z.string().min(1, 'Option text cannot be empty')).min(2, 'At least 2 options required'),
  correctOptionIndex: z.number().optional(),
});

export type AddressFormData = z.infer<typeof AddressSchema>;
export type LoginPhoneFormData = z.infer<typeof LoginPhoneSchema>;
export type VerifyOtpFormData = z.infer<typeof VerifyOtpSchema>;
export type ProfileFormData = z.infer<typeof ProfileSchema>;
export type ProductFormData = z.infer<typeof ProductSchema>;
export type CouponFormData = z.infer<typeof CouponSchema>;
export type QuestionFormData = z.infer<typeof QuestionSchema>;

