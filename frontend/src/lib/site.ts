export const CONTACT = {
  whatsapp: {
    label: 'WhatsApp',
    value: '07 79 31 80 61',
    href: 'https://wa.me/212779318061',
    number: '212779318061',
  },
  phone: {
    label: 'Phone',
    value: '07 79 31 80 61',
    href: 'tel:+212779318061',
  },
  email: {
    label: 'Email',
    value: 'brynoxa.shop@gmail.com',
    href: 'mailto:brynoxa.shop@gmail.com',
  },
  address: {
    label: 'Address',
    value: 'Morocco — cash on delivery nationwide',
    href: 'https://wa.me/212779318061',
  },
  hours: {
    label: 'Working hours',
    value: 'Mon–Fri 9:00–18:00 · Sat 10:00–16:00 · Sun closed',
  },
} as const

/**
 * Business identity shown on the Terms of Sale and Privacy Policy pages.
 * Empty fields are hidden — fill them in once the business is registered.
 */
export const LEGAL = {
  businessName: 'Brynoxa',
  /** Registered business address. */
  address: '',
  /** Identifiant Commun de l’Entreprise. */
  ice: '',
  /** Registre du Commerce number and city, e.g. "RC 12345 Casablanca". */
  rc: '',
  /** Date the legal pages were last changed (YYYY-MM-DD). */
  updated: '2026-10-03',
} as const

export const SOCIAL_LINKS = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    href: CONTACT.whatsapp.href,
    handle: CONTACT.whatsapp.value,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    href: 'https://www.facebook.com/profile.php?id=61594042771780',
    handle: 'Brynoxa',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    href: 'https://www.instagram.com/brynoxa1',
    handle: '@brynoxa1',
  },
] as const

/**
 * Customer services, in display order. Copy lives in i18n `services.items`;
 * `terms` is the matching Terms of Sale section shown on the service page.
 */
export const CUSTOMER_SERVICES = [
  { id: 'warranty', slug: 'warranty', photo: '/services/warranty.jpg', terms: 'warranty' },
  { id: 'returns', slug: 'returns', photo: '/services/returns.jpg', terms: 'returns' },
  { id: 'cod', slug: 'cash-on-delivery', photo: '/services/cod.jpg', terms: 'payment' },
  { id: 'delivery', slug: 'home-delivery', photo: '/services/delivery.jpg', terms: 'delivery' },
  { id: 'support', slug: 'live-support', photo: '/services/support.jpg', terms: null },
  { id: 'repair', slug: 'repair', photo: '/services/repair.jpg', terms: null },
] as const

export type CustomerService = (typeof CUSTOMER_SERVICES)[number]
