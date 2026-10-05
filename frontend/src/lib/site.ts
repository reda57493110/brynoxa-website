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

export const CUSTOMER_SERVICES = [
  {
    id: 'warranty',
    title: 'Official warranty',
    highlight: '6 months',
    summary: 'Covered for manufacturing defects for six months from delivery.',
    details:
      'Every eligible product includes a 6-month Brynoxa warranty from the day it arrives. It covers manufacturing defects only. Your order number is your proof of purchase — no extra paperwork.',
  },
  {
    id: 'returns',
    title: 'Returns',
    highlight: '14 days',
    summary: 'Changed your mind? Send it back unused, in its original box.',
    details:
      'You have 14 days after delivery to return most products, as long as they are unused and complete. We approve the request first, then a courier picks it up. Defective or wrong items are collected free of charge.',
  },
  {
    id: 'cod',
    title: 'Cash on delivery',
    highlight: 'Pay on arrival',
    summary: 'Inspect the box, then pay the courier. No card needed.',
    details:
      'We deliver across Morocco with cash on delivery. Check the package when it arrives, then pay. If something looks wrong, refuse the shipment and contact us the same day.',
  },
  {
    id: 'delivery',
    title: 'Home delivery',
    highlight: '2–5 days',
    summary: 'Packed after confirmation, then shipped to your city.',
    details:
      'Once your COD order is confirmed, we pack it within 1–2 business days. Delivery usually takes 2–5 days depending on the city. Track everything from your account.',
  },
  {
    id: 'support',
    title: 'Live support',
    highlight: 'WhatsApp & phone',
    summary: 'Real people for setup, compatibility, and order help.',
    details:
      'Need the right RAM, GPU, or laptop for your work? Message us. For an existing order, send your order number on WhatsApp or the contact form and we reply the same business day.',
  },
  {
    id: 'repair',
    title: 'Repair service',
    highlight: 'RMA pickup',
    summary: 'If it fails under warranty, we diagnose it and fix or replace it.',
    details:
      'Send a short video of the issue. After we approve the claim, we arrange pickup. Keep the product sealed if you can — opening it yourself can void coverage.',
  },
] as const
