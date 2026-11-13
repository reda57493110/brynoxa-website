import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { SocialGlyph } from '@/components/contact/BrandIcons'
import { toast } from '@/store/toastStore'
import {
  EMPTY_SITE_CONTACT,
  SOCIAL_HOSTS,
  SOCIAL_KEYS,
  SOCIAL_NAME,
  formatPhone,
  normalizePhone,
  normalizeSocialUrl,
  type SiteContact,
} from '@/lib/siteContact'
import { BUILT_IN_SOCIAL } from '@/lib/site'
import type { StoreSettings } from '@/types'
import { SaveBar, SettingsCard } from './SettingsUi'
import { useReportDirty } from './dirty'

const formOf = (s?: StoreSettings): SiteContact => {
  const saved = { ...EMPTY_SITE_CONTACT, ...(s?.siteContact ?? {}) }
  // Never saved yet: start with the pages the shop shows today
  const c = Object.values(saved).some(Boolean) ? saved : { ...saved, ...BUILT_IN_SOCIAL }
  return { ...c, whatsapp: c.whatsapp ? formatPhone(c.whatsapp) : '', phone: c.phone ? formatPhone(c.phone) : '' }
}

/** What would be saved (same cleaning as the server), to compare with what is saved */
const cleaned = (f: SiteContact): SiteContact => ({
  whatsapp: normalizePhone(f.whatsapp),
  phone: normalizePhone(f.phone),
  facebook: normalizeSocialUrl('facebook', f.facebook),
  instagram: normalizeSocialUrl('instagram', f.instagram),
  tiktok: normalizeSocialUrl('tiktok', f.tiktok),
  youtube: normalizeSocialUrl('youtube', f.youtube),
  businessName: f.businessName.replace(/\s+/g, ' ').trim(),
  address: f.address.replace(/\s+/g, ' ').trim(),
  ice: f.ice.replace(/\D/g, ''),
  rc: f.rc.replace(/\s+/g, ' ').trim(),
})

/**
 * Admin → Settings → Contact & business: numbers and pages customers use to reach the shop (footer,
 * Contact, Help, WhatsApp buttons, delivery slips) and the business details of the legal pages.
 */
export function ContactSettings({ settings }: { settings?: StoreSettings }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<SiteContact>(() => formOf(settings))
  const reset = useCallback(() => setForm(formOf(settings)), [settings])
  useEffect(reset, [reset])
  const set = (k: keyof SiteContact, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const errors: Partial<Record<keyof SiteContact, string>> = {}
  for (const k of ['whatsapp', 'phone'] as const) {
    if (form[k].trim() && !normalizePhone(form[k])) errors[k] = 'A full number, e.g. 06 12 34 56 78'
  }
  for (const k of SOCIAL_KEYS) {
    if (form[k].trim() && !normalizeSocialUrl(k, form[k])) errors[k] = `An address on ${SOCIAL_HOSTS[k][0]}`
  }
  if (form.ice.trim() && !/^\d{9,20}$/.test(form.ice.replace(/\s/g, ''))) errors.ice = 'Digits only (15 digits)'
  const invalid = Object.values(errors).some(Boolean)

  const saved = cleaned(formOf(settings))
  const next = cleaned(form)
  const dirty = Boolean(settings) && JSON.stringify(saved) !== JSON.stringify(next)
  useReportDirty('contact', dirty)

  const save = useMutation({
    mutationFn: () => adminApi.settings.update({ siteContact: next }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Contact details saved — the shop shows them now')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const footer = <SaveBar dirty={dirty} saving={save.isPending} invalid={invalid} error={invalid ? 'Fix the highlighted fields' : undefined} onReset={reset} onSave={() => save.mutate()} />

  return (
    <>
      <SettingsCard
        title="How customers reach you"
        description="Shown in the footer, Contact, Help, the WhatsApp buttons and on delivery slips. Empty = the built-in number. The email shown is General → Support email."
        footer={footer}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="WhatsApp number" inputMode="tel" placeholder="07 79 31 80 61" value={form.whatsapp} maxLength={30} onChange={(e) => set('whatsapp', e.target.value)} error={errors.whatsapp} />
          <Input label="Phone (calls)" inputMode="tel" placeholder="Same as WhatsApp" value={form.phone} maxLength={30} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium">Social pages</p>
          <p className="text-[11px] text-[var(--fg-muted)]">Paste the address of your page. Empty = no icon for it. Shown in the footer and on Contact.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {SOCIAL_KEYS.map((k) => (
              <div key={k} className="flex items-start gap-2">
                <span className="mt-7 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--fg-muted)]">
                  <SocialGlyph id={k} size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <Input
                    label={SOCIAL_NAME[k]}
                    inputMode="url"
                    placeholder={`${SOCIAL_HOSTS[k][0]}/…`}
                    value={form[k]}
                    maxLength={300}
                    onChange={(e) => set(k, e.target.value)}
                    error={errors[k]}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Business details"
        description="Shown on the Terms of Sale and Privacy Policy pages. Empty fields are hidden — fill them in once the business is registered."
        footer={footer}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Business name" placeholder="Brynoxa" value={form.businessName} maxLength={120} onChange={(e) => set('businessName', e.target.value)} />
          <Input label="Registered address" value={form.address} maxLength={300} onChange={(e) => set('address', e.target.value)} />
          <Input label="ICE" inputMode="numeric" value={form.ice} maxLength={30} onChange={(e) => set('ice', e.target.value)} error={errors.ice} />
          <Input label="RC (number and city)" placeholder="RC 12345 Casablanca" value={form.rc} maxLength={60} onChange={(e) => set('rc', e.target.value)} />
        </div>
      </SettingsCard>
    </>
  )
}
