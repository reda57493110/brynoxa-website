import { CONTACT } from '@/lib/site'

export function whatsappHref(text?: string) {
  const base = `https://wa.me/${CONTACT.whatsapp.number}`
  if (!text?.trim()) return base
  return `${base}?text=${encodeURIComponent(text.trim())}`
}

export function openWhatsApp(text?: string) {
  window.open(whatsappHref(text), '_blank', 'noopener,noreferrer')
}
