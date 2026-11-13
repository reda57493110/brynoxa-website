import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { SocialGlyph } from '@/components/contact/BrandIcons'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { toast } from '@/store/toastStore'
import { GA_ID_RX, META_PIXEL_RX, TIKTOK_PIXEL_RX } from '@/lib/analytics'
import type { StoreSettings } from '@/types'
import { SaveBar, SettingsCard } from './SettingsUi'
import { useReportDirty } from './dirty'

type Form = { metaPixelId: string; tiktokPixelId: string; gaMeasurementId: string }
const formOf = (s?: StoreSettings): Form => ({
  metaPixelId: s?.tracking?.metaPixelId ?? '',
  tiktokPixelId: s?.tracking?.tiktokPixelId ?? '',
  gaMeasurementId: s?.tracking?.gaMeasurementId ?? '',
})
const tidy = (v: string) => v.trim().replace(/\s+/g, '')
const cleaned = (f: Form): Form => ({
  metaPixelId: tidy(f.metaPixelId),
  tiktokPixelId: tidy(f.tiktokPixelId).toUpperCase(),
  gaMeasurementId: tidy(f.gaMeasurementId).toUpperCase(),
})

const ROWS: { key: keyof Form; label: string; icon: string; placeholder: string; rx: RegExp; error: string; where: string }[] = [
  {
    key: 'metaPixelId',
    label: 'Meta Pixel ID (Facebook & Instagram ads)',
    icon: 'facebook',
    placeholder: '1234567890123456',
    rx: META_PIXEL_RX,
    error: 'Digits only (10 to 20)',
    where: 'Meta Events Manager → Data sources → your pixel → the ID under its name',
  },
  {
    key: 'tiktokPixelId',
    label: 'TikTok Pixel ID',
    icon: 'tiktok',
    placeholder: 'CABCD1234EFGH5678IJK',
    rx: TIKTOK_PIXEL_RX,
    error: 'Letters and digits (15 to 30)',
    where: 'TikTok Ads Manager → Tools → Events → Web events → your pixel → its ID',
  },
  {
    key: 'gaMeasurementId',
    label: 'Google Analytics Measurement ID',
    icon: 'google',
    placeholder: 'G-AB12CD34EF',
    rx: GA_ID_RX,
    error: 'Starts with G-',
    where: 'Google Analytics → Admin → Data streams → your website → Measurement ID',
  },
]

/**
 * Admin → Settings → Tracking codes: the ids of the ad platforms' pixels. The shop then tells them
 * about visits, products viewed, carts, checkouts and orders, so the ads reach people who buy.
 */
export function TrackingSettings({ settings }: { settings?: StoreSettings }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Form>(() => formOf(settings))
  const reset = useCallback(() => setForm(formOf(settings)), [settings])
  useEffect(reset, [reset])

  const next = cleaned(form)
  const errors = Object.fromEntries(ROWS.map((r) => [r.key, next[r.key] && !r.rx.test(next[r.key]) ? r.error : undefined])) as Partial<Record<keyof Form, string>>
  const invalid = Object.values(errors).some(Boolean)
  const dirty = Boolean(settings) && JSON.stringify(next) !== JSON.stringify(cleaned(formOf(settings)))
  useReportDirty('tracking', dirty)

  const save = useMutation({
    mutationFn: () => adminApi.settings.update({ tracking: next }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Tracking codes saved — they load on the shop from the next page visit')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <SettingsCard
      title="Ad platform pixels"
      description="Paste only the ID (not the whole code). The shop then tells each platform about visits, products viewed, add to cart, checkout and orders (with their value), so your ads are shown to people who buy. Empty = not loaded."
      footer={<SaveBar dirty={dirty} saving={save.isPending} invalid={invalid} error={invalid ? 'Fix the highlighted IDs' : undefined} onReset={reset} onSave={() => save.mutate()} />}
    >
      <div className="space-y-4">
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-start gap-2.5">
            <span className="mt-7 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--fg-muted)]">
              {r.icon === 'google' ? <SiteIcon name="sliders" size={14} /> : <SocialGlyph id={r.icon} size={14} />}
            </span>
            <div className="min-w-0 flex-1">
              <Input
                label={r.label}
                placeholder={r.placeholder}
                value={form[r.key]}
                maxLength={40}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setForm((f) => ({ ...f, [r.key]: e.target.value }))}
                error={errors[r.key]}
              />
              <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                {next[r.key] && !errors[r.key] ? (
                  <span className="font-medium text-[var(--success)]">● Loaded on the shop · </span>
                ) : null}
                Where to find it: {r.where}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-[var(--bg-muted)] p-3 text-xs text-[var(--fg-muted)]">
        <p className="font-medium text-[var(--fg)]">Good to know</p>
        <ul className="mt-1 list-disc space-y-0.5 ps-4">
          <li>Not loaded on admin pages, nor on pages whose address carries a private key (password reset, email check, receipt).</li>
          <li>An order is sent as “Purchase” (Meta) / “Place an order” (TikTok) with its value in DH and its number, so a repeat is not counted twice.</li>
          <li>
            Your own campaign results (cost per order, return per 1 DH) stay in{' '}
            <Link to="/admin/ads" className="font-medium text-[var(--brand-text)] hover:underline">
              Ads &amp; social media
            </Link>
            .
          </li>
        </ul>
      </div>
    </SettingsCard>
  )
}
