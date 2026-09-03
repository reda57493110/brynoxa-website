export const TAGLINE =
  'PCs, laptops, and components — delivered across Morocco, paid on arrival.'

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
    value: 'brynoxa.com@gmail.com',
    href: 'mailto:brynoxa.com@gmail.com',
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

export const CONTACT_FAQS = [
  {
    q: 'How long does COD delivery take?',
    a: 'Most orders ship within 1–2 business days after confirmation. Delivery typically takes 2–5 business days depending on your city.',
  },
  {
    q: 'Can I change or cancel my order?',
    a: 'Yes — while an order is still pending, open it from your account and choose Cancel order. Once it is confirmed or packed, contact support with your order number.',
  },
  {
    q: 'What is your return policy?',
    a: 'Eligible unused products can be returned within 14 days of delivery in original packaging. Contact support to start a return.',
  },
  {
    q: 'Do you offer business / bulk orders?',
    a: 'Absolutely. Email brynoxa.com@gmail.com with your requirements and our team will prepare a custom quote.',
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

export const SERVICE_STEPS = {
  warranty: [
    'Save your order number. That is your warranty card.',
    'Message us with a photo or a 10-second video of the problem.',
    'We confirm coverage and book pickup or a drop-off.',
    'We repair, replace, or credit you after diagnosis.',
  ],
  returns: [
    'Ask for a return within 14 days of delivery.',
    'Wait for our confirmation before handing the box to anyone.',
    'Give the courier the sealed original packaging.',
    'We inspect it, then exchange it or refund you.',
  ],
  cod: [
    'Place the order — no card, no deposit.',
    'We confirm, then pack within 1–2 business days.',
    'The courier brings it to your city in Morocco.',
    'Inspect the box, pay cash, or refuse if something is wrong.',
  ],
} as const

export const SERVICE_FAQS = [
  {
    q: 'How long is the warranty?',
    a: 'Six months from the delivery date — always under one year. After that, repairs can be quoted separately.',
  },
  {
    q: 'Does warranty cover drops or liquid?',
    a: 'No. Warranty is for manufacturing defects only — not accidents, water, or repairs done outside Brynoxa.',
  },
  {
    q: 'Who pays for return shipping?',
    a: 'If the product is defective or we sent the wrong one, pickup is free. If you simply changed your mind, a small courier fee may apply.',
  },
  {
    q: 'How do refunds work with COD?',
    a: 'After inspection, we refund by bank transfer or store credit, usually within 3–7 business days.',
  },
  {
    q: 'Can I swap for a different model?',
    a: 'Yes, if it is in stock. You only pay (or receive) the difference in price.',
  },
] as const
