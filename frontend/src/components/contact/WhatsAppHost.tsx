import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { WhatsAppIcon } from '@/components/contact/BrandIcons'
import { useWhatsAppStore, type WhatsAppTopic } from '@/store/whatsappStore'
import { composeWhatsAppMessage, openWhatsApp } from '@/lib/whatsapp'
import { CONTACT } from '@/lib/site'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'
import type { MessageKey } from '@/i18n'
import type { Product } from '@/types'

const OPTIONS: {
  id: Exclude<WhatsAppTopic, 'product'>
  icon: SiteIconName
  title: MessageKey
  hint: MessageKey
}[] = [
  { id: 'order', icon: 'package', title: 'contact.waOrder', hint: 'contact.waOrderHint' },
  { id: 'advice', icon: 'laptop', title: 'contact.waAdvice', hint: 'contact.waAdviceHint' },
  { id: 'warranty', icon: 'shield', title: 'contact.waWarranty', hint: 'contact.waWarrantyHint' },
  { id: 'return', icon: 'refresh', title: 'contact.waReturn', hint: 'contact.waReturnHint' },
  { id: 'other', icon: 'chat', title: 'contact.waOther', hint: 'contact.waOtherHint' },
]

const STICKY_BAR_ROUTES = ['/cart', '/checkout']

function needsOrderNumber(topic: WhatsAppTopic | null) {
  return topic === 'order' || topic === 'warranty' || topic === 'return'
}

export function WhatsAppHost() {
  const t = useT()
  const location = useLocation()
  const qc = useQueryClient()
  const isOpen = useWhatsAppStore((s) => s.isOpen)
  const storedTopic = useWhatsAppStore((s) => s.topic)
  const storedProductName = useWhatsAppStore((s) => s.productName)
  const open = useWhatsAppStore((s) => s.open)
  const close = useWhatsAppStore((s) => s.close)

  const onProductPage = location.pathname.startsWith('/product/')
  const slug = onProductPage ? location.pathname.split('/')[2] ?? '' : ''
  const cachedProduct = slug ? qc.getQueryData<Product>(['product', slug]) : undefined
  const productName = storedProductName || cachedProduct?.name || ''
  const productUrl = onProductPage ? `${window.location.origin}${location.pathname}` : ''

  const hideFabOnMobile =
    onProductPage || STICKY_BAR_ROUTES.some((route) => location.pathname === route || location.pathname.startsWith(`${route}/`))

  const [selected, setSelected] = useState<WhatsAppTopic | null>(null)
  const [extra, setExtra] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setSelected(storedTopic ?? (onProductPage ? 'product' : null))
    setExtra('')
    setNote('')
  }, [isOpen, storedTopic, onProductPage])

  const preview = useMemo(() => {
    if (!selected) return ''
    const intent =
      selected === 'order'
        ? t('contact.waMsgOrder')
        : selected === 'advice'
          ? t('contact.waMsgAdvice')
          : selected === 'warranty'
            ? t('contact.waMsgWarranty')
            : selected === 'return'
              ? t('contact.waMsgReturn')
              : selected === 'product'
                ? t('contact.waMsgProduct')
                : t('contact.waMsgOther')

    return composeWhatsAppMessage([
      t('contact.waGreeting'),
      '',
      intent,
      selected === 'product' && productName ? productName : undefined,
      selected === 'product' ? productUrl : undefined,
      extra.trim() && needsOrderNumber(selected)
        ? t('contact.waLineOrder', { value: extra.trim() })
        : undefined,
      extra.trim() && selected === 'advice' ? t('contact.waLineBudget', { value: extra.trim() }) : undefined,
      note.trim() ? t('contact.waLineNote') : undefined,
      note.trim() || undefined,
    ])
  }, [extra, note, productName, productUrl, selected, t])

  const startChat = () => {
    if (!selected || !preview) return
    close()
    openWhatsApp(preview)
  }

  return (
    <>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => open(onProductPage ? { topic: 'product', productName } : undefined)}
          className={cn(
            'fixed end-4 z-40 h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_12px_28px_-8px_rgba(37,211,102,0.65)] transition hover:scale-[1.04] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
            'bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:end-6 sm:bottom-6',
            hideFabOnMobile ? 'hidden sm:inline-flex' : 'inline-flex'
          )}
          aria-label={t('contact.whatsapp')}
        >
          <WhatsAppIcon size={28} />
          <span className="absolute end-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-300" />
        </button>
      ) : null}

      <Modal open={isOpen} onClose={close} title={t('contact.waTitle')} size="md">
        <div className="max-h-[min(70vh,40rem)] space-y-4 overflow-y-auto pe-1">
          <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
              <WhatsAppIcon size={22} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--fg)]">{t('contact.waReplyHint')}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-[var(--fg-muted)]">
                {CONTACT.whatsapp.value} · {t('contact.waHours')}
              </span>
            </span>
          </div>

          <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{t('contact.waBody')}</p>

          <ul className="grid gap-2 sm:grid-cols-2">
            {onProductPage ? (
              <li className="sm:col-span-2">
                <TopicButton
                  selected={selected === 'product'}
                  icon="tag"
                  title={t('contact.waProduct')}
                  hint={productName || t('contact.waProductHint')}
                  onClick={() => setSelected('product')}
                />
              </li>
            ) : null}
            {OPTIONS.map((option) => (
              <li key={option.id}>
                <TopicButton
                  selected={selected === option.id}
                  icon={option.icon}
                  title={t(option.title)}
                  hint={t(option.hint)}
                  onClick={() => setSelected(option.id)}
                />
              </li>
            ))}
          </ul>

          {selected ? (
            <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-3.5">
              {needsOrderNumber(selected) ? (
                <Input
                  label={t('contact.waOrderNumber')}
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder={t('contact.waOrderNumberPh')}
                  autoComplete="off"
                />
              ) : null}
              {selected === 'advice' ? (
                <Input
                  label={t('contact.waBudget')}
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder={t('contact.waBudgetPh')}
                  autoComplete="off"
                />
              ) : null}
              <Textarea
                label={t('contact.waNote')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('contact.waNotePh')}
                className="min-h-[5.5rem]"
              />
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                  {t('contact.waPreview')}
                </p>
                <p className="whitespace-pre-wrap rounded-xl bg-[var(--bg-muted)] px-3 py-2.5 text-sm leading-relaxed text-[var(--fg)]">
                  {preview}
                </p>
              </div>
            </div>
          ) : null}

          <Button
            type="button"
            onClick={startChat}
            disabled={!selected}
            className="w-full rounded-full bg-[#25D366] text-white shadow-none hover:brightness-110 disabled:opacity-50"
          >
            <WhatsAppIcon size={18} />
            {t('contact.waContinue')}
          </Button>
        </div>
      </Modal>
    </>
  )
}

function TopicButton({
  selected,
  icon,
  title,
  hint,
  onClick,
}: {
  selected: boolean
  icon: SiteIconName
  title: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex h-full w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-start transition',
        selected
          ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_10%,var(--bg))] shadow-soft'
          : 'border-[var(--border)] bg-[var(--bg)] hover:border-[var(--brand)]'
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          selected ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'bg-[var(--bg-muted)] text-[var(--brand-text)]'
        )}
      >
        <SiteIcon name={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--fg)]">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-[var(--fg-muted)]">{hint}</span>
      </span>
      {selected ? (
        <SiteIcon name="check" size={16} className="mt-1 shrink-0 text-[var(--brand-text)]" />
      ) : null}
    </button>
  )
}
