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
import { PhoneText } from '@/components/ui/PhoneText'
import { CONTACT } from '@/lib/site'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'
import type { MessageKey } from '@/i18n'
import type { Product } from '@/types'

type TopicConfig = {
  id: WhatsAppTopic
  icon: SiteIconName
  title: MessageKey
  hint: MessageKey
  prompt: MessageKey
  intent: MessageKey
  showOrderNumber?: boolean
  showBudget?: boolean
  showUseCase?: boolean
  noteLabel: MessageKey
  notePh: MessageKey
  noteLine: MessageKey
}

const TOPIC_OPTIONS: Array<Omit<TopicConfig, 'id'> & { id: Exclude<WhatsAppTopic, 'product'> }> = [
  {
    id: 'order',
    icon: 'package',
    title: 'contact.waOrder',
    hint: 'contact.waOrderHint',
    prompt: 'contact.waPromptOrder',
    intent: 'contact.waMsgOrder',
    showOrderNumber: true,
    noteLabel: 'contact.waNoteOrder',
    notePh: 'contact.waNoteOrderPh',
    noteLine: 'contact.waLineHelp',
  },
  {
    id: 'advice',
    icon: 'laptop',
    title: 'contact.waAdvice',
    hint: 'contact.waAdviceHint',
    prompt: 'contact.waPromptAdvice',
    intent: 'contact.waMsgAdvice',
    showBudget: true,
    showUseCase: true,
    noteLabel: 'contact.waNoteAdvice',
    notePh: 'contact.waNoteAdvicePh',
    noteLine: 'contact.waLineNote',
  },
  {
    id: 'warranty',
    icon: 'shield',
    title: 'contact.waWarranty',
    hint: 'contact.waWarrantyHint',
    prompt: 'contact.waPromptWarranty',
    intent: 'contact.waMsgWarranty',
    showOrderNumber: true,
    noteLabel: 'contact.waIssue',
    notePh: 'contact.waIssuePh',
    noteLine: 'contact.waLineIssue',
  },
  {
    id: 'return',
    icon: 'refresh',
    title: 'contact.waReturn',
    hint: 'contact.waReturnHint',
    prompt: 'contact.waPromptReturn',
    intent: 'contact.waMsgReturn',
    showOrderNumber: true,
    noteLabel: 'contact.waReason',
    notePh: 'contact.waReasonPh',
    noteLine: 'contact.waLineReason',
  },
  {
    id: 'other',
    icon: 'chat',
    title: 'contact.waOther',
    hint: 'contact.waOtherHint',
    prompt: 'contact.waPromptOther',
    intent: 'contact.waMsgOther',
    noteLabel: 'contact.waNoteOther',
    notePh: 'contact.waNoteOtherPh',
    noteLine: 'contact.waLineQuestion',
  },
]

const PRODUCT_TOPIC: TopicConfig = {
  id: 'product',
  icon: 'tag',
  title: 'contact.waProduct',
  hint: 'contact.waProductHint',
  prompt: 'contact.waPromptProduct',
  intent: 'contact.waMsgProduct',
  noteLabel: 'contact.waNoteProduct',
  notePh: 'contact.waNoteProductPh',
  noteLine: 'contact.waLineQuestion',
}

function topicConfig(id: WhatsAppTopic | null): TopicConfig | null {
  if (!id) return null
  if (id === 'product') return PRODUCT_TOPIC
  return TOPIC_OPTIONS.find((option) => option.id === id) ?? null
}

export function WhatsAppHost() {
  const t = useT()
  const location = useLocation()
  const qc = useQueryClient()
  const isOpen = useWhatsAppStore((s) => s.isOpen)
  const storedTopic = useWhatsAppStore((s) => s.topic)
  const storedProductName = useWhatsAppStore((s) => s.productName)
  const close = useWhatsAppStore((s) => s.close)

  const onProductPage = location.pathname.startsWith('/product/')
  const slug = onProductPage ? location.pathname.split('/')[2] ?? '' : ''
  const cachedProduct = slug ? qc.getQueryData<Product>(['product', slug]) : undefined
  const productName = storedProductName || cachedProduct?.name || ''
  const productUrl = onProductPage ? `${window.location.origin}${location.pathname}` : ''

  const [selected, setSelected] = useState<WhatsAppTopic | null>(null)
  const [orderNumber, setOrderNumber] = useState('')
  const [budget, setBudget] = useState('')
  const [useCase, setUseCase] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setSelected(storedTopic ?? (onProductPage ? 'product' : null))
    setOrderNumber('')
    setBudget('')
    setUseCase('')
    setNote('')
  }, [isOpen, storedTopic, onProductPage])

  const config = topicConfig(selected)

  const selectTopic = (id: WhatsAppTopic) => {
    setSelected(id)
    setOrderNumber('')
    setBudget('')
    setUseCase('')
    setNote('')
  }

  const preview = useMemo(() => {
    if (!config) return ''
    const orderValue = orderNumber.trim()
    const budgetValue = budget.trim()
    const useValue = useCase.trim()
    const noteValue = note.trim()

    return composeWhatsAppMessage([
      t('contact.waGreeting'),
      '',
      t(config.intent),
      config.id === 'product' && productName ? productName : undefined,
      config.id === 'product' ? productUrl : undefined,
      orderValue ? t('contact.waLineOrder', { value: orderValue }) : undefined,
      budgetValue ? t('contact.waLineBudget', { value: budgetValue }) : undefined,
      useValue ? t('contact.waLineUse', { value: useValue }) : undefined,
      noteValue
        ? config.noteLine === 'contact.waLineNote'
          ? `${t(config.noteLine)}\n${noteValue}`
          : t(config.noteLine, { value: noteValue })
        : undefined,
    ])
  }, [budget, config, note, orderNumber, productName, productUrl, t, useCase])

  const startChat = () => {
    if (!selected || !preview) return
    close()
    openWhatsApp(preview)
  }

  return (
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
                <span className="sm:hidden">
                  <PhoneText>{CONTACT.whatsapp.value}</PhoneText>
                </span>
                <span className="hidden sm:inline">
                  <PhoneText>{CONTACT.whatsapp.value}</PhoneText>
                  {' · '}
                  {t('contact.waHours')}
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
                  onClick={() => selectTopic('product')}
                />
              </li>
            ) : null}
            {TOPIC_OPTIONS.map((option) => (
              <li key={option.id} className={option.id === 'other' ? 'col-span-2' : undefined}>
                <TopicButton
                  selected={selected === option.id}
                  icon={option.icon}
                  title={t(option.title)}
                  hint={t(option.hint)}
                  onClick={() => selectTopic(option.id)}
                />
              </li>
            ))}
          </ul>

          {config ? (
            <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5 sm:space-y-3 sm:rounded-2xl sm:p-3.5">
              <p className="text-xs leading-snug text-[var(--fg-muted)] sm:text-sm sm:leading-relaxed">
                {t(config.prompt)}
              </p>

              {config.showOrderNumber ? (
                <Input
                  label={t('contact.waOrderNumber')}
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder={t('contact.waOrderNumberPh')}
                  autoComplete="off"
                  className="h-10 sm:h-11"
                />
              ) : null}

              {config.showBudget ? (
                <Input
                  label={t('contact.waBudget')}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder={t('contact.waBudgetPh')}
                  autoComplete="off"
                  className="h-10 sm:h-11"
                />
              ) : null}

              {config.showUseCase ? (
                <Input
                  label={t('contact.waUseCase')}
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  placeholder={t('contact.waUseCasePh')}
                  autoComplete="off"
                  className="h-10 sm:h-11"
                />
              ) : null}

              <Textarea
                label={t(config.noteLabel)}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t(config.notePh)}
                className="min-h-[4.25rem] sm:min-h-[5.5rem]"
              />

              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)] sm:mb-1.5 sm:text-xs">
                  {t('contact.waPreview')}
                </p>
                <p className="line-clamp-5 whitespace-pre-wrap rounded-lg bg-[var(--bg-muted)] px-2.5 py-2 text-xs leading-relaxed text-[var(--fg)] sm:line-clamp-none sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm">
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
