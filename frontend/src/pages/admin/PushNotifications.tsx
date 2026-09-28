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

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Push notifications</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          Send a notification to every shopper who allowed notifications on the website.
        </p>
      </div>

      {!data?.configured ? (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--bg-elevated))] p-4 text-sm">
          Push is not configured on the server yet. Add <code>VAPID_PUBLIC_KEY</code>,{' '}
          <code>VAPID_PRIVATE_KEY</code> and <code>VAPID_SUBJECT</code> to the Vercel environment
          variables, then redeploy.
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
            Subscribers
          </p>
          <p className="mt-1 font-display text-2xl font-semibold">{subscribers}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:col-span-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
            By language
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['fr', 'ar', 'en'] as const).map((locale) => (
              <Badge key={locale} variant="default">
                {locale.toUpperCase()} · {data?.byLocale?.[locale] ?? 0}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {data?.configured ? <ThisDeviceCard data={data} /> : null}

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">New notification</h2>
        <form
          className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSend) setConfirmOpen(true)
          }}
        >
          <Select
            label="Announce a product (optional)"
            value={productId}
            onChange={(e) => pickProduct(e.target.value)}
            placeholder={products.isLoading ? 'Loading products…' : 'Choose a product to link'}
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
            placeholder="e.g. RTX 4060 laptops from 9,990 MAD — cash on delivery everywhere in Morocco."
            className="min-h-24"
            required
          />

          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={showLanguages}
                onChange={(e) => setShowLanguages(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
              />
              <span>
                <span className="font-medium">Write French and Arabic versions</span>
                <span className="block text-xs text-[var(--fg-muted)]">
                  Shoppers get the version in the language they use on the site. Anyone without a
                  version below gets the main message above.
                </span>
              </span>
            </label>

            {showLanguages ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(
                  [
                    { lang: 'fr', label: 'Français', dir: 'ltr' },
                    { lang: 'ar', label: 'العربية', dir: 'rtl' },
                  ] as const
                ).map(({ lang, label, dir }) => (
                  <div key={lang} className="space-y-3" dir={dir}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                      {label}
                    </p>
                    <Input
                      label={`${lang.toUpperCase()} · Title`}
                      value={translations[lang].title}
                      maxLength={TITLE_MAX}
                      onChange={(e) => setTranslation(lang, 'title', e.target.value)}
                    />
                    <Textarea
                      label={`${lang.toUpperCase()} · Message`}
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

          <Input
            label="Link when tapped (optional)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/shop or /product/your-product"
          />
          <Input
            label="Big image URL (optional, https)"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://…"
          />

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
              Preview
            </p>
            <div className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
              <img
                src="/brand/icon-192.png"
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{title || 'Notification title'}</p>
                <p className="line-clamp-3 text-xs text-[var(--fg-muted)]">
                  {body || 'Your message will appear here.'}
                </p>
                {image ? (
                  <img
                    src={image}
                    alt=""
                    className="mt-2 max-h-40 w-full rounded-lg object-cover"
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!canSend} loading={send.isPending}>
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
              Send test to my devices
            </Button>
          </div>
          {subscribers === 0 && data?.configured ? (
            <p className="text-xs text-[var(--fg-muted)]">
              No subscribers yet — shoppers are asked after they view a few products or place an
              order.
            </p>
          ) : null}
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">History</h2>
        {data?.campaigns?.length ? (
          <ul className="space-y-2">
            {data.campaigns.map((c) => {
              const clicks = c.clicks ?? 0
              const rate = c.delivered ? Math.round((clicks / c.delivered) * 100) : 0
              return (
                <li
                  key={c._id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{c.title}</p>
                      <p className="line-clamp-2 text-sm text-[var(--fg-muted)]">{c.body}</p>
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
                  <p className="mt-1.5 text-xs text-[var(--fg-muted)]">
                    {formatDateTime(c.createdAt)}
                    {c.sentByName ? ` · ${c.sentByName}` : ''}
                    {c.url ? ` · ${c.url}` : ''}
                    {c.translations?.fr || c.translations?.ar ? ' · FR/AR versions' : ''}
                    {c.removed ? ` · ${c.removed} expired removed` : ''}
                  </p>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">No notifications sent yet.</p>
        )}
      </section>

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
    description = `On — this device gets new-order alerts and your test sends. Your account has ${data.myDevices} ${
      data.myDevices === 1 ? 'device' : 'devices'
    } turned on.`
  else if (status === 'subscribed')
    description = 'Notifications are on, but this device is not linked to your account yet.'
  else description = 'Turn on to get an alert here for every new order, and to receive test sends.'

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_15%,transparent)] text-[var(--brand-text)]">
          <SiteIcon name="bell" size={18} />
        </span>
        <div className="min-w-0">
          <p className="font-medium">This device · new-order alerts</p>
          <p className="text-sm text-[var(--fg-muted)]">{description}</p>
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
