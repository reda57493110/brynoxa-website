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
 * Photos are free Unsplash / Pexels photos (their free licenses), linked from their image servers.
 */
const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&h=1000&q=80`
const pexels = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600&h=1000&fit=crop`

export const CUSTOMER_SERVICES = [
  // technician fixing a laptop
  { id: 'warranty', slug: 'warranty', photo: pexels(10558598), terms: 'warranty' },
  // customer handing a parcel back to a courier
  { id: 'returns', slug: 'returns', photo: pexels(7843933), terms: 'returns' },
  // customer paying the courier in cash at the door
  { id: 'cod', slug: 'cash-on-delivery', photo: pexels(6818151), terms: 'payment' },
  // courier carrying parcels to the door
  { id: 'delivery', slug: 'home-delivery', photo: unsplash('1615897370727-d091b76d47a5'), terms: 'delivery' },
  // support team on headsets
  { id: 'support', slug: 'live-support', photo: unsplash('1626863905121-3b0c0ed7b94c'), terms: null },
  // technician fitting a graphics card
  { id: 'repair', slug: 'repair', photo: unsplash('1604754742629-3e5728249d73'), terms: null },
] as const

export type CustomerService = (typeof CUSTOMER_SERVICES)[number]
