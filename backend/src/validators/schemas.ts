import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(6).max(100),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.string().optional(),
});

export const addressSchema = z.object({
  label: z.string().default('Home'),
  fullName: z.string().min(2),
  line1: z.string().min(3),
  line2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().optional(),
  postalCode: z.string().optional().default('00000'),
  country: z.string().optional().default('MA'),
  phone: z.string().min(5),
  isDefault: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  image: z.string().optional(),
  parent: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export const brandSchema = z.object({
  name: z.string().min(2),
  logo: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const productSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(2),
  description: z.string().min(10),
  shortDescription: z.string().optional(),
  category: z.string().min(1),
  brand: z.string().min(1),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        publicId: z.string().optional(),
        alt: z.string().optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .optional(),
  price: z.number().min(0),
  compareAtPrice: z.number().min(0).optional(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).optional(),
  specs: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.string()).optional(),
  isFeatured: z.boolean().optional(),
  isCarousel: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(3).max(120),
  comment: z.string().min(10).max(2000),
});

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().min(1).max(99),
      })
    )
    .min(1),
  shippingAddress: addressSchema,
  couponCode: z.string().optional(),
  customerNote: z.string().max(500).optional(),
  /** Guest checkout — required when not logged in */
  email: z.string().trim().email().optional(),
  /** Optional: create / upgrade account at checkout */
  password: z.string().min(6).max(100).optional(),
});

export const guestOrderReceiptSchema = z.object({
  email: z.string().trim().email(),
});

export const updateOrderItemsSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().min(1).max(99),
      })
    )
    .min(1)
    .max(50),
});
export const updateOrderStatusSchema = z.object({
  orderStatus: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']),
  adminNote: z.string().optional(),
  note: z.string().optional(),
});

export const couponSchema = z.object({
  code: z.string().min(3).max(32),
  type: z.enum(['percent', 'fixed']),
  value: z.number().min(0),
  minOrder: z.number().min(0).optional(),
  maxUses: z.number().int().min(0).optional(),
  startsAt: z.string().datetime().optional().or(z.string().optional()),
  expiresAt: z.string().datetime().optional().or(z.string().optional()),
  isActive: z.boolean().optional(),
});

export const validateCouponSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().min(0),
});

export const settingsSchema = z.object({
  storeName: z.string().optional(),
  currency: z.string().optional(),
  shippingFlatRate: z.number().min(0).optional(),
  freeShippingMin: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  supportEmail: z.string().email().optional(),
  codEnabled: z.boolean().optional(),
});

export const inventorySchema = z.object({
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).optional(),
});

export const contactSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  subject: z.string().min(3).max(120),
  message: z.string().min(10).max(5000),
});

export const newsletterSchema = z.object({
  email: z.string().email(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  sort: z.string().optional(),
  q: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  featured: z.coerce.boolean().optional(),
  carousel: z.coerce.boolean().optional(),
  inStock: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
});
