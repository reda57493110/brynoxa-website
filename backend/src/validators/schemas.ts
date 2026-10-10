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
  costPrice: z.number().min(0).nullable().optional(),
  deposit: z
    .object({ type: z.enum(['fixed', 'percent']), value: z.number().min(0) })
    .nullable()
    .optional(),
  recommended: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(12).optional(),
  recommendedOnly: z.boolean().optional(),
  condition: z.enum(['new', 'refurbished', 'used']).optional(),
  conditionNote: z.string().trim().max(500).optional(),
  serialTracking: z.boolean().optional(),
  inventoryLocation: z.string().trim().max(80).optional(),
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
  inventoryStatuses: z
    .array(z.object({ id: z.string().max(24).optional(), name: z.string().trim().min(1).max(40) }))
    .max(20)
    .optional(),
  inventoryLocations: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  requireInspection: z.boolean().optional(),
  wholesaleTiers: z
    .array(z.object({ id: z.string().max(24).optional(), name: z.string().trim().min(1).max(40), discountPercent: z.number().min(0).max(90) }))
    .max(10)
    .optional(),
  customerSegments: z
    .object({
      newDays: z.number().int().min(1).max(3650).optional(),
      inactiveDays: z.number().int().min(1).max(3650).optional(),
      highSpendMin: z.number().min(0).optional(),
      highProfitMin: z.number().min(0).optional(),
      saved: z
        .array(z.object({ id: z.string().max(24).optional(), name: z.string().trim().min(1).max(40), filters: z.record(z.string(), z.union([z.string().max(60), z.number()])) }))
        .max(20)
        .optional(),
    })
    .optional(),
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
  stock: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  reason: z.string().trim().max(500).optional(),
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

/** Query-string boolean: only "true"/"false" (z.coerce.boolean would turn "false" into true). */
const queryBool = z.preprocess((v) => (v === 'true' || v === true ? true : v === 'false' || v === false ? false : undefined), z.boolean().optional());

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  sort: z.string().optional(),
  q: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  featured: queryBool,
  carousel: queryBool,
  inStock: queryBool,
  isActive: queryBool,
  condition: z.enum(['new', 'refurbished', 'used']).optional(),
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

/** Staff email to one customer from the admin Emails page. */
export const manualEmailSchema = z.object({
  to: z.string().trim().email(),
  subject: z.string().trim().min(2).max(150),
  message: z.string().trim().min(2).max(5000),
  orderId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
});

const businessInfoSchema = z.object({
  companyName: z.string().trim().max(120).optional(),
  contactName: z.string().trim().max(120).optional(),
  email: z.union([z.string().trim().email().max(160), z.literal('')]).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(300).optional(),
  taxId: z.string().trim().max(60).optional(),
});

/** Staff edits on a customer (admin profile page). */
export const updateCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  isActive: z.boolean().optional(),
  customerType: z.enum(['retail', 'wholesale', 'business']).optional(),
  adminNotes: z.string().max(5000).optional(),
  business: businessInfoSchema.optional(),
  billingAddress: z
    .object({
      fullName: z.string().trim().max(120).optional(),
      line1: z.string().trim().max(200).optional(),
      line2: z.string().trim().max(200).optional(),
      city: z.string().trim().max(80).optional(),
      state: z.string().trim().max(80).optional(),
      postalCode: z.string().trim().max(20).optional(),
      country: z.string().trim().max(2).optional(),
      phone: z.string().trim().max(40).optional(),
    })
    .nullable()
    .optional(),
  tierId: z.string().max(24).optional(),
  paymentTerms: z.string().max(200).optional(),
});

export const wholesaleReviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'revoke']),
  tierId: z.string().max(24).optional(),
  paymentTerms: z.string().max(200).optional(),
  reason: z.string().max(500).optional(),
  customerType: z.enum(['wholesale', 'business']).optional(),
});

/** Customer applying for a wholesale / business account from their account page. */
export const wholesaleApplicationSchema = z.object({
  requestedType: z.enum(['wholesale', 'business']),
  business: businessInfoSchema.extend({
    companyName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(40),
  }),
  message: z.string().trim().max(1000).optional(),
});

export const refundSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  reason: z.string().trim().min(3).max(300),
  itemsReturned: z.boolean().optional(),
});

/* ---------------- Inventory ---------------- */

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const bucket = z.string().regex(/^(available|reserved|awaitingInspection|returned|defective|underRepair|writtenOff|custom:[a-z0-9-]{1,24})$/);
const serialList = z.array(z.string().trim().min(1).max(80)).max(500).optional();

export const receiptSchema = z.object({
  supplier: z.string().trim().min(2).max(120),
  reference: z.string().trim().max(120).optional(),
  receivedAt: z.coerce.date().optional(),
  location: z.string().trim().max(80).optional(),
  notes: z.string().max(2000).optional(),
  evidenceUrls: z.array(z.string().url().max(500)).max(10).optional(),
  lines: z
    .array(
      z.object({
        productId: objectId,
        qty: z.number().int().min(1).max(100000),
        unitCost: z.number().min(0).optional(),
        serials: serialList,
        warranty: z.string().trim().max(200).optional(),
        result: z
          .object({
            available: z.number().int().min(0).optional(),
            defective: z.number().int().min(0).optional(),
            underRepair: z.number().int().min(0).optional(),
          })
          .optional(),
        unitResults: z
          .array(z.object({ serial: z.string().trim().min(1).max(80), result: z.enum(['available', 'defective', 'underRepair', 'awaitingInspection']), fault: z.string().max(300).optional() }))
          .max(500)
          .optional(),
        faultNotes: z.string().trim().max(500).optional(),
      })
    )
    .min(1)
    .max(100),
});

export const conditionChangeSchema = z.object({
  productId: objectId,
  from: bucket,
  to: bucket,
  qty: z.number().int().min(1).max(100000),
  serials: serialList,
  reason: z.string().trim().min(3).max(500),
  fault: z.string().trim().max(500).optional(),
});

export const stockAdjustmentSchema = z.object({
  productId: objectId,
  bucket,
  delta: z.number().int().min(-100000).max(100000),
  reason: z.string().trim().min(3).max(500),
  unitCost: z.number().min(0).optional(),
});

export const registerSerialsSchema = z.object({
  productId: objectId,
  bucket,
  serials: z.array(z.string().trim().min(1).max(80)).min(1).max(500),
  location: z.string().trim().max(80).optional(),
});

export const conditionListingSchema = z.object({
  condition: z.enum(['refurbished', 'used']),
  price: z.number().positive().optional(),
});

export const returnSchema = z.object({
  returnedAt: z.coerce.date().optional(),
  lines: z
    .array(
      z.object({
        productId: objectId,
        qty: z.number().int().min(1),
        serials: serialList,
        reason: z.string().trim().min(3).max(300),
        conditionNote: z.string().trim().max(500).optional(),
      })
    )
    .min(1)
    .max(50),
});

export const assessReturnSchema = z.object({
  lineId: objectId,
  qty: z.number().int().min(1),
  outcome: z.enum(['restock-new', 'used', 'repair', 'defective', 'write-off']),
  note: z.string().trim().max(500).optional(),
  targetProductId: objectId.optional(),
  meetsNewCriteria: z.boolean().optional(),
  serials: serialList,
});

export const repairUpdateSchema = z.object({
  status: z.enum(['awaiting-diagnosis', 'awaiting-parts', 'in-repair', 'repair-completed', 'qc-pending']).optional(),
  diagnosis: z.string().max(1000).optional(),
  cost: z.number().min(0).max(10000000).optional(),
  technician: z.string().max(120).optional(),
  partsReplaced: z.array(z.string().max(120)).max(30).optional(),
  note: z.string().max(500).optional(),
});

export const repairCompleteSchema = z.object({
  qcResult: z.enum(['passed', 'failed']),
  finalStatus: z.enum(['new', 'refurbished', 'used', 'defective', 'write-off']),
  targetProductId: objectId.optional(),
  qcNote: z.string().trim().max(500).optional(),
});
