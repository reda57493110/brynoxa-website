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
            'fixed end-3 z-40 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_22px_-8px_rgba(37,211,102,0.7)] transition hover:scale-[1.04] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
            'h-12 w-12 bottom-[max(1rem,env(safe-area-inset-bottom))] sm:h-14 sm:w-14 sm:end-6 sm:bottom-6',
            hideFabOnMobile ? 'hidden sm:inline-flex' : 'inline-flex'
          )}
          aria-label={t('contact.whatsapp')}
        >
          <WhatsAppIcon size={22} className="sm:hidden" />
          <WhatsAppIcon size={28} className="hidden sm:block" />
          <span className="absolute end-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-300 sm:end-0.5 sm:top-0.5 sm:h-3 sm:w-3" />
        </button>
      ) : null}

      <Modal open={isOpen} onClose={close} title={t('contact.waTitle')} size="sm" presentation="sheet">
        <div className="flex min-h-0 flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 sm:gap-3 sm:rounded-2xl sm:px-3.5 sm:py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white sm:h-11 sm:w-11">
              <WhatsAppIcon size={16} className="sm:hidden" />
              <WhatsAppIcon size={22} className="hidden sm:block" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-[var(--fg)] sm:text-sm">{t('contact.waReplyHint')}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-[var(--fg-muted)] sm:text-xs sm:leading-relaxed">
                <span className="sm:hidden">{CONTACT.whatsapp.value}</span>
                <span className="hidden sm:inline">
                  {CONTACT.whatsapp.value} · {t('contact.waHours')}
                </span>
              </span>
            </span>
          </div>

          <p className="hidden text-sm leading-relaxed text-[var(--fg-muted)] sm:block">{t('contact.waBody')}</p>

          <ul className="grid grid-cols-2 gap-1.5 sm:gap-2">
            {onProductPage ? (
              <li className="col-span-2">
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
              <li key={option.id} className={option.id === 'other' ? 'col-span-2' : undefined}>
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
            <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5 sm:space-y-3 sm:rounded-2xl sm:p-3.5">
              {needsOrderNumber(selected) ? (
                <Input
                  label={t('contact.waOrderNumber')}
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder={t('contact.waOrderNumberPh')}
                  autoComplete="off"
                  className="h-10 sm:h-11"
                />
              ) : null}
              {selected === 'advice' ? (
                <Input
                  label={t('contact.waBudget')}
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder={t('contact.waBudgetPh')}
                  autoComplete="off"
                  className="h-10 sm:h-11"
                />
              ) : null}
              <Textarea
                label={t('contact.waNote')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('contact.waNotePh')}
                className="min-h-[4.25rem] sm:min-h-[5.5rem]"
              />
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)] sm:mb-1.5 sm:text-xs">
                  {t('contact.waPreview')}
                </p>
                <p className="line-clamp-4 whitespace-pre-wrap rounded-lg bg-[var(--bg-muted)] px-2.5 py-2 text-xs leading-relaxed text-[var(--fg)] sm:line-clamp-none sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm">
                  {preview}
                </p>
              </div>
            </div>
          ) : null}

          <div className="sticky bottom-0 -mx-3 mt-auto border-t border-[var(--border)] bg-[var(--bg-elevated)] px-3 pt-2.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-0">
            <Button
              type="button"
              onClick={startChat}
              disabled={!selected}
              size="md"
              className="h-11 w-full rounded-full bg-[#25D366] text-white shadow-none hover:brightness-110 disabled:opacity-50 sm:h-12"
            >
              <WhatsAppIcon size={16} />
              {t('contact.waContinue')}
            </Button>
          </div>
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
        'flex h-full w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-start transition sm:items-start sm:gap-3 sm:rounded-2xl sm:px-3.5 sm:py-3',
        selected
          ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_10%,var(--bg))] shadow-soft'
          : 'border-[var(--border)] bg-[var(--bg)] hover:border-[var(--brand)]'
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl',
          selected ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'bg-[var(--bg-muted)] text-[var(--brand-text)]'
        )}
      >
        <SiteIcon name={icon} size={15} className="sm:hidden" />
        <SiteIcon name={icon} size={18} className="hidden sm:block" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-tight text-[var(--fg)] sm:text-sm">{title}</span>
        <span className="mt-0.5 line-clamp-1 block text-[11px] leading-snug text-[var(--fg-muted)] sm:line-clamp-2 sm:text-xs">
          {hint}
        </span>
      </span>
      {selected ? (
        <SiteIcon name="check" size={14} className="mt-0.5 shrink-0 text-[var(--brand-text)] sm:mt-1" />
      ) : null}
    </button>
  )
}
