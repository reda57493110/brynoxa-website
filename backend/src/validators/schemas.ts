import { z } from 'zod';

/** Customers; staff accounts are held to 12 in auth.service. */
const CUSTOMER_PASSWORD_MIN = 6;
const customerPassword = z
  .string()
  .min(CUSTOMER_PASSWORD_MIN, `Password must be at least ${CUSTOMER_PASSWORD_MIN} characters`)
  .max(100);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: customerPassword,
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

export const mfaCodeSchema = z.object({
  code: z.string().trim().min(6).max(20),
});

export const mfaLoginSchema = z.object({
  mfaToken: z.string().min(20).max(2000),
  code: z.string().trim().min(6).max(20),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: customerPassword,
});

const oneTimeToken = z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid token');

export const emailSchema = z.object({
  email: z.string().trim().email(),
});

export const verifyEmailSchema = z.object({
  token: oneTimeToken,
});

export const resetPasswordSchema = z.object({
  token: oneTimeToken,
  newPassword: customerPassword,
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
        url: z.union([z.string().url(), z.string().regex(/^\/api\/v1\/images\/[a-f0-9]{24}$/i)]),
        publicId: z.string().optional(),
        alt: z.string().optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .optional(),
  price: z.number().min(0),
  compareAtPrice: z.number().min(0).optional(),
  deposit: z
    .object({ type: z.enum(['fixed', 'percent']), value: z.number().min(0) })
    .nullable()
    .optional(),
  recommended: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(12).optional(),
  recommendedOnly: z.boolean().optional(),
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
  password: customerPassword.optional(),
});

export const guestOrderReceiptSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid receipt token'),
});

export const trackOrderSchema = z.object({
  orderNumber: z.string().trim().min(6).max(40),
  phone: z.string().trim().min(8).max(30),
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

/** Staff: set the deposit amount (0 removes it) and/or mark it received. */
export const orderDepositSchema = z
  .object({
    amount: z.number().min(0).max(10_000_000).optional(),
    received: z.boolean().optional(),
  })
  .refine((v) => v.amount !== undefined || v.received !== undefined, {
    message: 'Nothing to update',
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
  shippingByCity: z
    .array(
      z.object({
        city: z.string().trim().min(2).max(80),
        rate: z.number().min(0),
      })
    )
    .max(200)
    .optional(),
  taxRate: z.number().min(0).max(100).optional(),
  supportEmail: z.string().email().optional(),
  depositInstructions: z.string().max(2000).optional(),
  emailNotifications: z.record(z.string(), z.boolean()).optional(),
  emailMessages: z.record(z.string(), z.string().max(1000)).optional(),
  notifyStaffLoginEmail: z.boolean().optional(),
  pageHeroProducts: z
    .object({
      shop: z.string().max(24).optional(),
      services: z.string().max(24).optional(),
      contact: z.string().max(24).optional(),
    })
    .optional(),
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

/** Push services we accept endpoints from (Chrome/Edge/Firefox/Safari). */
const PUSH_HOST_PATTERN =
  /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/i;

const pushEndpointSchema = z
  .string()
  .url()
  .max(1000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && PUSH_HOST_PATTERN.test(url.hostname);
    } catch {
      return false;
    }
  }, 'Unsupported push endpoint');

export const pushSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: pushEndpointSchema,
    keys: z.object({
      p256dh: z.string().min(1).max(200),
      auth: z.string().min(1).max(100),
    }),
  }),
  locale: z.enum(['en', 'fr', 'ar']).optional(),
  /** Links this browser to an order's customer so they get status updates (works for guests). */
  order: z
    .object({
      orderNumber: z.string().trim().min(6).max(40),
      token: z.string().regex(/^[a-f0-9]{64}$/i),
    })
    .optional(),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().max(1000),
});

export const pushClickSchema = z.object({
  campaignId: z.string().regex(/^[a-f0-9]{24}$/i),
});

const pushTranslationSchema = z
  .object({
    title: z.string().trim().max(80).default(''),
    body: z.string().trim().max(240).default(''),
  })
  .optional();

export const pushSendSchema = z.object({
  translations: z
    .object({
      en: pushTranslationSchema,
      fr: pushTranslationSchema,
      ar: pushTranslationSchema,
    })
    .optional(),
  title: z.string().trim().min(2).max(80),
  body: z.string().trim().min(2).max(240),
  url: z
    .string()
    .trim()
    .max(300)
    .regex(/^\/(?!\/)/, 'Link must be a page on this site, starting with /')
    .optional()
    .or(z.literal('')),
  image: z.string().trim().url().max(500).startsWith('https://').optional().or(z.literal('')),
});

export const setUserRoleSchema = z.object({
  // Owner (admin) cannot be assigned via API — only hireable staff roles + customer (remove)
  role: z.enum(['customer', 'orders', 'catalog', 'support', 'marketing']),
});

export const createStaffUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email(),
  password: z.string().min(12).max(100),
  role: z.enum(['orders', 'catalog', 'support', 'marketing']),
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

export const emailTestSchema = z.object({
  type: z.enum([
    'orderPlaced',
    'orderConfirmed',
    'orderShipped',
    'orderDelivered',
    'orderCancelled',
    'depositRequested',
    'depositReceived',
  ]),
});
