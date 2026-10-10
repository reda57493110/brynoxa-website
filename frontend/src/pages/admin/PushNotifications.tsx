import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { productsApi } from '@/api/productsApi'
import { getErrorMessage } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToastStore } from '@/store/toastStore'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Panel } from '@/components/admin/Panel'
import { StatCard } from '@/components/admin/customers/shared'
import { Switch } from '@/components/admin/settings/SettingsUi'
import { usePush } from '@/hooks/usePush'
import { formatDateTime } from '@/lib/format'
import type { PushOverview, PushSendPayload } from '@/types'

const TITLE_MAX = 80
const BODY_MAX = 240

type Lang = 'fr' | 'ar'
type Draft = { title: string; body: string }

const EMPTY_TRANSLATIONS: Record<Lang, Draft> = {
  fr: { title: '', body: '' },
  ar: { title: '', body: '' },
}

const PRODUCT_COPY = {
  main: { title: (name: string) => `New: ${name}`, body: 'Now available at Brynoxa. Tap to see price and details.' },
  fr: { title: (name: string) => `Nouveau : ${name}`, body: 'Disponible maintenant chez Brynoxa. Touchez pour voir le prix et les détails.' },
  ar: { title: (name: string) => `جديد: ${name}`, body: 'متوفر الآن لدى برينوكسا. اضغط لرؤية السعر والتفاصيل.' },
}

export function PushNotifications() {
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [image, setImage] = useState('')
  const [productId, setProductId] = useState('')
  const [showLanguages, setShowLanguages] = useState(false)
  const [translations, setTranslations] = useState(EMPTY_TRANSLATIONS)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const overview = useQuery({
    queryKey: ['admin', 'push'],
    queryFn: async () => (await adminApi.push.overview()).data.data,
  })

  const products = useQuery({
    queryKey: ['admin', 'push', 'products'],
    queryFn: async () => (await productsApi.list({ limit: 50 })).data.data,
    staleTime: 60_000,
  })

  const payload = (): PushSendPayload => ({
    title: title.trim(),
    body: body.trim(),
    url: url.trim() || undefined,
    image: image.trim() || undefined,
    translations: showLanguages ? translations : undefined,
  })

  const resetForm = () => {
    setTitle('')
    setBody('')
    setUrl('')
    setImage('')
    setProductId('')
    setTranslations(EMPTY_TRANSLATIONS)
  }

  const send = useMutation({
    mutationFn: () => adminApi.push.send(payload()),
    onSuccess: (res) => {
      const result = res.data.data
      qc.invalidateQueries({ queryKey: ['admin', 'push'] })
      setConfirmOpen(false)
      resetForm()
      toast(`Sent to ${result.delivered} of ${result.targeted} subscribers`, 'success')
    },
    onError: (e) => {
      setConfirmOpen(false)
      toast(getErrorMessage(e), 'error')
    },
  })

  const test = useMutation({
    mutationFn: () => adminApi.push.test(payload()),
    onSuccess: (res) => {
      const result = res.data.data
      qc.invalidateQueries({ queryKey: ['admin', 'push'] })
      toast(
        `Test sent to ${result.delivered} of your ${result.targeted} ${result.targeted === 1 ? 'device' : 'devices'}`,
        result.delivered ? 'success' : 'error'
      )
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const setTranslation = (lang: Lang, field: keyof Draft, value: string) =>
    setTranslations((prev) => ({ ...prev, [lang]: { ...prev[lang], [field]: value } }))

  const pickProduct = (id: string) => {
    setProductId(id)
    const product = products.data?.find((p) => p._id === id)
    if (!product) return
    const picture = product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url || ''
    setUrl(`/product/${product.slug}`)
    setImage(picture.startsWith('https://') ? picture : '')
    if (!title.trim()) setTitle(PRODUCT_COPY.main.title(product.name).slice(0, TITLE_MAX))
    if (!body.trim()) setBody(PRODUCT_COPY.main.body)
    setTranslations((prev) => {
      const next = { ...prev }
      for (const lang of ['fr', 'ar'] as const) {
        next[lang] = {
          title: prev[lang].title || PRODUCT_COPY[lang].title(product.name).slice(0, TITLE_MAX),
          body: prev[lang].body || PRODUCT_COPY[lang].body,
        }
      }
      return next
    })
  }

  if (overview.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (overview.isError) {
    return <QueryErrorState onRetry={() => overview.refetch()} />
  }

  const data = overview.data
  const subscribers = data?.subscribers ?? 0
  const hasDraft = title.trim().length >= 2 && body.trim().length >= 2
  const canSend = Boolean(data?.configured) && subscribers > 0 && hasDraft
  const canTest = Boolean(data?.configured) && (data?.myDevices ?? 0) > 0 && hasDraft

  const preview = (
    <div className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
      <img src="/brand/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title || 'Notification title'}</p>
        <p className="line-clamp-3 text-xs text-[var(--fg-muted)]">{body || 'Your message will appear here.'}</p>
        {image ? <img src={image} alt="" className="mt-2 max-h-40 w-full rounded-lg object-cover" /> : null}
      </div>
    </div>
  )

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <AdminHeader title="Push notifications" description="Send a message to shoppers who allowed notifications." />

      {!data?.configured ? (
        <p className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-4 py-3 text-sm">
          Push is not configured on the server. Add <code>VAPID_PUBLIC_KEY</code>, <code>VAPID_PRIVATE_KEY</code> and{' '}
          <code>VAPID_SUBJECT</code> in Vercel, then redeploy.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <StatCard label="Subscribers" value={subscribers} />
        {(['fr', 'ar', 'en'] as const).map((locale) => (
          <StatCard key={locale} label={`${locale.toUpperCase()} speakers`} value={data?.byLocale?.[locale] ?? 0} />
        ))}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <Panel
          title="New notification"
          description="Pick a product to fill the text, link and image automatically."
          footer={
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] bg-[var(--bg-muted)]/30 px-4 py-3 sm:px-5">
              <Button type="submit" form="push-form" disabled={!canSend} loading={send.isPending}>
                <SiteIcon name="send" size={14} />
                Send to {subscribers} {subscribers === 1 ? 'subscriber' : 'subscribers'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!canTest}
                loading={test.isPending}
                onClick={() => test.mutate()}
                title={data?.myDevices ? undefined : 'Turn on notifications on this device first'}
              >
                Test on my devices
              </Button>
              {subscribers === 0 && data?.configured ? (
                <span className="text-xs text-[var(--fg-muted)]">No subscribers yet.</span>
              ) : null}
            </div>
          }
        >
          <form
            id="push-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (canSend) setConfirmOpen(true)
            }}
          >
            <Select
              label="Announce a product (optional)"
              value={productId}
              onChange={(e) => pickProduct(e.target.value)}
              placeholder={products.isLoading ? 'Loading products…' : 'Choose a product'}
              options={(products.data ?? []).map((p) => ({ value: p._id, label: p.name }))}
            />
            <Input
              label={`Title (${title.length}/${TITLE_MAX})`}
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New gaming laptops just arrived"
              required
            />
            <Textarea
              label={`Message (${body.length}/${BODY_MAX})`}
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. RTX 4060 laptops from 9,990 DH — cash on delivery everywhere in Morocco."
              className="min-h-24"
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Link when tapped" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/shop or /product/…" />
              <Input label="Big image (https)" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" />
            </div>

            <div className="space-y-3 border-t border-[var(--border)] pt-4">
              <Switch
                checked={showLanguages}
                onChange={setShowLanguages}
                label="French and Arabic versions"
                hint="Each shopper gets their site language; others get the main message."
              />
              {showLanguages ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      { lang: 'fr', label: 'Français', dir: 'ltr' },
                      { lang: 'ar', label: 'العربية', dir: 'rtl' },
                    ] as const
                  ).map(({ lang, label, dir }) => (
                    <div key={lang} className="space-y-3" dir={dir}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{label}</p>
                      <Input
                        aria-label={`${label} title`}
                        placeholder="Title"
                        value={translations[lang].title}
                        maxLength={TITLE_MAX}
                        onChange={(e) => setTranslation(lang, 'title', e.target.value)}
                      />
                      <Textarea
                        aria-label={`${label} message`}
                        placeholder="Message"
                        value={translations[lang].body}
                        maxLength={BODY_MAX}
                        onChange={(e) => setTranslation(lang, 'body', e.target.value)}
                        className="min-h-20"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </form>
        </Panel>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-4">
          <Panel title="Preview">{preview}</Panel>
          {data?.configured ? <ThisDeviceCard data={data} /> : null}
        </div>
      </div>

      <Panel title="History" description={data?.campaigns?.length ? `Last ${data.campaigns.length} sent` : undefined}>
        {data?.campaigns?.length ? (
          <ul className="-my-2 divide-y divide-[var(--border)]">
            {data.campaigns.map((c) => {
              const clicks = c.clicks ?? 0
              const rate = c.delivered ? Math.round((clicks / c.delivered) * 100) : 0
              return (
                <li key={c._id} className="py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.title}</p>
                      <p className="line-clamp-1 text-xs text-[var(--fg-muted)]">{c.body}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={c.delivered > 0 ? 'success' : 'default'}>
                        {c.delivered}/{c.targeted} delivered
                      </Badge>
                      <Badge variant={clicks > 0 ? 'brand' : 'default'}>
                        {clicks} {clicks === 1 ? 'tap' : 'taps'}
                        {c.delivered ? ` · ${rate}%` : ''}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                    {formatDateTime(c.createdAt)}
                    {c.sentByName ? ` · ${c.sentByName}` : ''}
                    {c.url ? ` · ${c.url}` : ''}
                    {c.translations?.fr || c.translations?.ar ? ' · FR/AR' : ''}
                    {c.removed ? ` · ${c.removed} expired removed` : ''}
                  </p>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">No notifications sent yet.</p>
        )}
      </Panel>

      <ConfirmDialog
        open={confirmOpen}
        title="Send this notification?"
        description={`It will be delivered right away to ${subscribers} ${
          subscribers === 1 ? 'subscriber' : 'subscribers'
        }. This cannot be undone.`}
        confirmLabel="Send now"
        loading={send.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => send.mutate()}
      />
    </div>
  )
}

/** Lets staff turn on push for the current browser so they get new-order alerts and test sends. */
function ThisDeviceCard({ data }: { data: PushOverview }) {
  const qc = useQueryClient()
  const { status, ready, busy, enable, disable } = usePush()

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'push'] })
  const linked = status === 'subscribed' && data.myDevices > 0

  let description: string
  if (!ready) description = 'Checking this browser…'
  else if (status === 'unsupported')
    description =
      'This browser cannot receive notifications. On iPhone, add the site to your home screen first.'
  else if (status === 'denied')
    description = 'Notifications are blocked for this site in your browser settings.'
  else if (linked)
    description = `On — gets new-order alerts and test sends (${data.myDevices} ${data.myDevices === 1 ? 'device' : 'devices'} on your account).`
  else if (status === 'subscribed')
    description = 'Notifications are on, but this device is not linked to your account yet.'
  else description = 'Turn on to get new-order alerts and test sends here.'

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_15%,transparent)] text-[var(--brand-text)]">
          <SiteIcon name="bell" size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">This device</p>
          <p className="text-xs text-[var(--fg-muted)]">{description}</p>
        </div>
      </div>
      {ready && status !== 'unsupported' && status !== 'denied' ? (
        linked ? (
          <Button
            variant="ghost"
            size="sm"
            loading={busy}
            onClick={() => void disable().then(refresh)}
          >
            Turn off here
          </Button>
        ) : (
          <Button size="sm" loading={busy} onClick={() => void enable().then(refresh)}>
            {status === 'subscribed' ? 'Link to my account' : 'Turn on for this device'}
          </Button>
        )
      ) : null}
    </section>
  )
}
