import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { waNumber } from '@/lib/customerContact'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Locale } from '@/i18n'

const LANGS: { id: Locale; label: string }[] = [
  { id: 'fr', label: 'Français' },
  { id: 'ar', label: 'العربية' },
  { id: 'en', label: 'English' },
]

const TEXT: Record<Locale, (name: string, link: string) => string> = {
  fr: (n, l) =>
    `Bonjour ${n},\nVoici votre lien pour choisir un nouveau mot de passe Brynoxa :\n${l}\nIl marche une seule fois et pendant 24 heures.\nMerci — Brynoxa`,
  ar: (n, l) =>
    `مرحبا ${n}،\nهذا رابط اختيار كلمة سر جديدة لحسابك في Brynoxa:\n${l}\nيعمل مرة واحدة فقط ولمدة 24 ساعة.\nشكرا — Brynoxa`,
  en: (n, l) =>
    `Hello ${n},\nHere is your link to choose a new Brynoxa password:\n${l}\nIt works once, for 24 hours.\nThank you — Brynoxa`,
}

/** The link opens the shop in the message's language: /fr/… or /ar/… (English has no prefix). */
export function linkInLanguage(link: string, lang: Locale) {
  if (lang === 'en') return link
  try {
    const u = new URL(link)
    u.pathname = `/${lang}${u.pathname}`
    return u.toString()
  } catch {
    return link
  }
}

/**
 * Admin → customer → "Password reset link": makes a one-time link (24 h) the owner sends on
 * WhatsApp to a customer who forgot their password. The customer chooses the new password.
 */
export function PasswordLinkDialog({
  open,
  onClose,
  customer,
}: {
  open: boolean
  onClose: () => void
  customer: { id: string; name: string; phone?: string }
}) {
  const [lang, setLang] = useState<Locale>('fr')
  const [copied, setCopied] = useState(false)
  const make = useMutation({
    mutationFn: async () => (await adminApi.customers.passwordLink(customer.id)).data.data,
  })

  const close = () => {
    make.reset()
    setCopied(false)
    onClose()
  }

  const result = make.data
  const link = result ? linkInLanguage(result.link, lang) : ''
  const first = customer.name.split(/[\s/]+/)[0] || customer.name
  const message = result ? TEXT[lang](first, link) : ''
  const wa = waNumber(result?.phone || customer.phone)
  const chip = (active: boolean) =>
    cn(
      'h-8 rounded-full border px-3 text-xs font-medium transition',
      active ? 'border-transparent bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--brand)]'
    )

  return (
    <Modal open={open} onClose={close} title="Password reset link" size="md">
      {!result ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--fg-muted)]">
            For a customer who forgot their password. You get a link to send to {customer.name} on WhatsApp: they open it and
            choose a new password themselves. You never see their password.
          </p>
          <ul className="list-disc space-y-1 ps-5 text-sm text-[var(--fg-muted)]">
            <li>The link works once, for 24 hours.</li>
            <li>A new link replaces the previous one.</li>
            <li>After the change, they are signed out on their other devices.</li>
          </ul>
          {make.isError ? <p className="text-sm text-[var(--danger)]">{getErrorMessage(make.error)}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button size="sm" loading={make.isPending} onClick={() => make.mutate()}>
              Make the link
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {LANGS.map((l) => (
              <button key={l.id} type="button" className={chip(lang === l.id)} onClick={() => setLang(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          <pre
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            className="whitespace-pre-wrap break-all rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 font-sans text-sm leading-relaxed"
          >
            {message}
          </pre>
          <p className="text-xs text-[var(--fg-muted)]">Valid until {formatDateTime(result.expiresAt)} · works once</p>
          <div className="flex flex-wrap gap-2">
            {wa ? (
              <a
                href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white hover:brightness-105"
              >
                <SiteIcon name="chat" size={14} /> WhatsApp {result.phone || customer.phone}
              </a>
            ) : (
              <p className="w-full text-xs text-[var(--fg-muted)]">No usable phone number: copy the message and send it yourself.</p>
            )}
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                } catch {
                  /* clipboard blocked */
                }
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] px-4 text-sm font-medium hover:border-[var(--brand)]"
            >
              <SiteIcon name={copied ? 'check' : 'layers'} size={14} /> {copied ? 'Copied' : 'Copy message'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
