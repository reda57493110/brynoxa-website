import { useLocation } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { useWhatsAppStore } from '@/store/whatsappStore'
import { openWhatsApp } from '@/lib/whatsapp'
import { useT } from '@/hooks/useT'
import type { MessageKey } from '@/i18n'

const OPTIONS: {
  id: 'order' | 'advice' | 'warranty' | 'return' | 'other'
  icon: SiteIconName
  title: MessageKey
  hint: MessageKey
  message: MessageKey
}[] = [
  {
    id: 'order',
    icon: 'package',
    title: 'contact.waOrder',
    hint: 'contact.waOrderHint',
    message: 'contact.waMsgOrder',
  },
  {
    id: 'advice',
    icon: 'laptop',
    title: 'contact.waAdvice',
    hint: 'contact.waAdviceHint',
    message: 'contact.waMsgAdvice',
  },
  {
    id: 'warranty',
    icon: 'shield',
    title: 'contact.waWarranty',
    hint: 'contact.waWarrantyHint',
    message: 'contact.waMsgWarranty',
  },
  {
    id: 'return',
    icon: 'refresh',
    title: 'contact.waReturn',
    hint: 'contact.waReturnHint',
    message: 'contact.waMsgReturn',
  },
  {
    id: 'other',
    icon: 'chat',
    title: 'contact.waOther',
    hint: 'contact.waOtherHint',
    message: 'contact.waMsgOther',
  },
]

export function WhatsAppHost() {
  const t = useT()
  const location = useLocation()
  const isOpen = useWhatsAppStore((s) => s.isOpen)
  const open = useWhatsAppStore((s) => s.open)
  const close = useWhatsAppStore((s) => s.close)
  const onProductPage = location.pathname.startsWith('/product/')
  const showFab = !onProductPage

  const startChat = (text: string) => {
    close()
    openWhatsApp(text)
  }

  return (
    <>
      {showFab ? (
        <button
          type="button"
          onClick={open}
          className="fixed end-4 bottom-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-soft-lg transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:end-6"
          aria-label={t('contact.whatsapp')}
        >
          <SiteIcon name="chat" size={26} />
        </button>
      ) : null}

      <Modal open={isOpen} onClose={close} title={t('contact.waTitle')} size="sm">
        <p className="mb-4 text-sm leading-relaxed text-[var(--fg-muted)]">{t('contact.waBody')}</p>
        <ul className="space-y-2">
          {onProductPage ? (
            <li>
              <button
                type="button"
                onClick={() =>
                  startChat(
                    t('contact.waMsgProduct', {
                      url: `${window.location.origin}${location.pathname}`,
                    })
                  )
                }
                className="flex w-full items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3 text-start transition hover:border-[var(--brand)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-muted)] text-[var(--brand-text)]">
                  <SiteIcon name="tag" size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[var(--fg)]">
                    {t('contact.waProduct')}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
                    {t('contact.waProductHint')}
                  </span>
                </span>
              </button>
            </li>
          ) : null}
          {OPTIONS.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => startChat(t(option.message))}
                className="flex w-full items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3 text-start transition hover:border-[var(--brand)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-muted)] text-[var(--brand-text)]">
                  <SiteIcon name={option.icon} size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[var(--fg)]">
                    {t(option.title)}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
                    {t(option.hint)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  )
}
