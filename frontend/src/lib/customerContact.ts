/** Phone links for staff contacting a customer (Moroccan numbers written any way). */

/** "06 12-34 56 78", "+212 612345678", "00212…" → "212612345678" (WhatsApp format); '' if unusable. */
export function waNumber(phone?: string | null): string {
  let d = String(phone || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0') && d.length === 10) d = `212${d.slice(1)}`
  if (d.length === 9 && /^[5-7]/.test(d)) d = `212${d}`
  return d.length >= 11 ? d : ''
}

export function telHref(phone?: string | null) {
  const d = String(phone || '').replace(/[^\d+]/g, '')
  return d ? `tel:${d}` : ''
}

/** WhatsApp chat with the customer, with a first message about their order. */
export function customerWhatsAppHref(phone: string | null | undefined, name: string, orderNumber: string) {
  const n = waNumber(phone)
  if (!n) return ''
  const first = name.split(/[\s/]+/)[0] || ''
  const text = `Bonjour ${first}, c'est Brynoxa à propos de votre commande ${orderNumber}.`
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}
