import { CONTACT } from '@/lib/site'

export function whatsappHref(text?: string) {
  const base = `https://wa.me/${CONTACT.whatsapp.number}`
  if (!text?.trim()) return base
  return `${base}?text=${encodeURIComponent(text.trim())}`
}

export function openWhatsApp(text?: string) {
  window.open(whatsappHref(text), '_blank', 'noopener,noreferrer')
}

export function composeWhatsAppMessage(lines: Array<string | false | undefined>) {
  return lines
    .filter((line): line is string => Boolean(line && line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
