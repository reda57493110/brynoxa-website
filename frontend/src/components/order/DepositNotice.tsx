import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi } from '@/api/ordersApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { formatCurrency, formatDate } from '@/lib/format'
import { receiptToDataUrl } from '@/lib/receiptImage'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'
import { toast } from '@/store/toastStore'
import { useWhatsAppStore } from '@/store/whatsappStore'
import { useLocaleStore } from '@/store/localeStore'
import { depositSteps } from '@/lib/depositSteps'
import type { DepositMethod, DepositMethodType, Order } from '@/types'
import { PhotoLightbox, PhotoTile } from '@/components/order/PrivatePhoto'

const TYPE_KEY = {
  bank: 'deposit.typeBank',
  cashplus: 'deposit.typeCashplus',
  wafacash: 'deposit.typeWafacash',
  barid: 'deposit.typeBarid',
  other: 'deposit.typeOther',
} as const satisfies Record<DepositMethodType, string>

function CopyButton({ value }: { value: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard blocked: the number stays visible to copy by hand */
        }
      }}
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[var(--border)] px-2.5 text-[11px] font-medium text-[var(--brand-text)] transition hover:border-[var(--brand)]"
    >
      <SiteIcon name={copied ? 'check' : 'layers'} size={12} />
      {copied ? t('deposit.copied') : t('deposit.copy')}
    </button>
  )
}

function MethodCard({ method, order }: { method: DepositMethod; order: Order }) {
  const t = useT()
  const locale = useLocaleStore((st) => st.locale)
  const amount = formatCurrency(order.deposit?.amount ?? 0)
  const steps = depositSteps(method, { customer: order.shippingAddress?.fullName || '', amount, order: order.orderNumber }, locale)
  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)]">
          <SiteIcon name={method.type === 'bank' ? 'banknote' : 'send'} size={15} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[var(--fg)]">{method.name || t(TYPE_KEY[method.type])}</span>
          {method.name ? <span className="block text-[11px] text-[var(--fg-muted)]">{t(TYPE_KEY[method.type])}</span> : null}
        </span>
      </div>
      <dl className="mt-2 space-y-1.5 text-sm">
        {method.holder ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-[var(--fg-muted)]">{t('deposit.holder')}</dt>
            <dd className="min-w-0 truncate font-medium text-[var(--fg)]">{method.holder}</dd>
          </div>
        ) : null}
        {method.account ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="sr-only">{t('deposit.account')}</dt>
            <dd dir="ltr" className="min-w-0 break-all font-mono text-[13px] font-semibold tracking-wide text-[var(--fg)]">
              {method.account}
            </dd>
            <CopyButton value={method.account} />
          </div>
        ) : null}
      </dl>
      {steps.length ? (
        <ol className="mt-2.5 space-y-1.5 border-t border-[var(--border)] pt-2.5">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-[var(--fg)]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[10px] font-bold text-[var(--brand-text)]">
                {i + 1}
              </span>
              <span className="min-w-0 pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {method.note ? <p className="mt-2 text-xs leading-relaxed text-[var(--fg-muted)]">{method.note}</p> : null}
    </li>
  )
}

/** "I've paid": how, the transaction reference and/or a photo of the receipt. */
function ReportPaymentForm({ order, methods, onDone }: { order: Order; methods: DepositMethod[]; onDone: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [methodId, setMethodId] = useState(methods[0]?.id ?? 'other')
  const [reference, setReference] = useState('')
  const [payerName, setPayerName] = useState('')
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')

  const send = useMutation({
    mutationFn: () =>
      ordersApi.reportDeposit(order.orderNumber, {
        methodId,
        reference: reference.trim() || undefined,
        payerName: payerName.trim() || undefined,
        note: note.trim() || undefined,
        receipt: receipt || undefined,
      }),
    onSuccess: (res) => {
      qc.setQueryData(['order', order.orderNumber], res.data.data)
      void qc.invalidateQueries({ queryKey: ['order', order.orderNumber] })
      void qc.invalidateQueries({ queryKey: ['orders'] })
      toast.success(t('deposit.reportSent'))
      onDone()
    },
    onError: (e) => setError(getErrorMessage(e)),
  })

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setPreparing(true)
    try {
      setReceipt(await receiptToDataUrl(file))
    } catch {
      setError(t('deposit.badPhoto'))
    } finally {
      setPreparing(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!reference.trim() && !receipt) {
      setError(t('deposit.needProof'))
      return
    }
    setError('')
    send.mutate()
  }

  const options = [...methods.map((m) => ({ id: m.id, label: m.name || t(TYPE_KEY[m.type]) })), { id: 'other', label: t('deposit.typeOther') }]

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:p-4">
      <fieldset>
        <legend className="text-sm font-medium text-[var(--fg)]">{t('deposit.paidWith')}</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {options.map((o) => (
            <label
              key={o.id}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition',
                methodId === o.id
                  ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand-text)]'
                  : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--brand)]'
              )}
            >
              <input type="radio" name="deposit-method" value={o.id} checked={methodId === o.id} onChange={() => setMethodId(o.id)} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Input
        label={t('deposit.payerName')}
        value={payerName}
        onChange={(e) => setPayerName(e.target.value)}
        maxLength={120}
        placeholder={t('deposit.payerNameHint')}
      />

      <Input
        label={t('deposit.reference')}
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        maxLength={80}
        dir="ltr"
        placeholder={t('deposit.referenceHint')}
      />

      <div>
        <p className="text-sm font-medium text-[var(--fg)]">{t('deposit.receipt')}</p>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            void pickFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {receipt ? (
          <div className="mt-1.5 flex items-center gap-3">
            <img src={receipt} alt="" className="h-16 w-16 rounded-lg border border-[var(--border)] object-cover" />
            <button type="button" onClick={() => fileInput.current?.click()} className="text-xs font-medium text-[var(--brand-text)] hover:underline">
              {t('deposit.changePhoto')}
            </button>
            <button type="button" onClick={() => setReceipt('')} className="text-xs text-[var(--fg-muted)] hover:underline">
              {t('deposit.removePhoto')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={preparing}
            className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--fg-muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            <SiteIcon name="plus" size={15} />
            {preparing ? '…' : t('deposit.addPhoto')}
          </button>
        )}
      </div>

      <Input label={t('deposit.noteLabel')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />

      {error ? <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" loading={send.isPending} disabled={preparing} className="h-10 rounded-full px-5">
          <SiteIcon name="send" size={15} />
          {t('deposit.submit')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} className="h-10 rounded-full">
          {t('deposit.close')}
        </Button>
      </div>
    </form>
  )
}

/**
 * Deposit status, amounts and how to pay — shown on an order that needs a deposit. With
 * `canReport` (the customer's own signed-in order) they can also send their payment details.
 */
export function DepositNotice({ order, className, canReport = false }: { order: Order; className?: string; canReport?: boolean }) {
  const t = useT()
  const openWhatsApp = useWhatsAppStore((s) => s.open)
  const [reporting, setReporting] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const deposit = order.deposit
  const awaiting = deposit?.status === 'pending' && (order.orderStatus === 'pending' || order.orderStatus === 'no_answer')
  const [revealed, setRevealed] = useState(false)

  // Links like /account/orders/123#deposit land here once the order has loaded
  const shown = Boolean(deposit && deposit.amount > 0)
  useEffect(() => {
    if (shown && window.location.hash === '#deposit') {
      document.getElementById('deposit')?.scrollIntoView({ block: 'start' })
    }
  }, [shown])

  if (!deposit || !(deposit.amount > 0) || order.orderStatus === 'cancelled') return null

  const received = deposit.status === 'received'
  const report = deposit.payment
  const instructions = deposit.paymentOptions?.instructions?.trim()
  const methods = deposit.paymentOptions?.methods ?? []

  return (
    <section
      id="deposit"
      aria-labelledby="deposit-heading"
      className={cn(
        'scroll-mt-24 rounded-2xl border p-4 text-start sm:p-5',
        received
          ? 'border-[var(--border)] bg-[var(--bg-elevated)]'
          : 'border-[var(--brand)]/50 bg-[var(--brand)]/[0.06]',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="deposit-heading" className="flex items-center gap-2 font-display text-base font-semibold text-[var(--fg)]">
          <SiteIcon name={received ? 'check' : 'banknote'} size={18} className="text-[var(--brand-text)]" />
          {received ? t('deposit.receivedTitle') : t('deposit.title')}
        </h2>
        {awaiting && report ? (
          <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--fg)]">
            {t('deposit.badgeReported')}
          </span>
        ) : null}
      </div>

      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--fg-muted)]">{received ? t('deposit.paid') : t('deposit.payNow')}</dt>
          <dd className="font-display text-base font-semibold text-[var(--fg)]">{formatCurrency(deposit.amount)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--fg-muted)]">{t('deposit.payOnDelivery')}</dt>
          <dd className="font-semibold text-[var(--fg)]">{formatCurrency(Math.max(0, order.pricing.total - deposit.amount))}</dd>
        </div>
      </dl>

      {deposit.proofs?.length ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-[var(--fg)]">{t('deposit.proofTitle')}</p>
          <div className="mt-1.5 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {deposit.proofs.map((p) => (
              <PhotoTile
                key={p.id}
                photoKey={['my-deposit-proof', p.id]}
                load={() => ordersApi.depositProofImage(order.orderNumber, p.id)}
                onOpen={setViewing}
              />
            ))}
          </div>
          <PhotoLightbox url={viewing} title={t('deposit.proofTitle')} openLabel={t('deposit.openPhoto')} onClose={() => setViewing(null)} />
        </div>
      ) : null}

      {received ? (
        <p className="mt-3 text-sm leading-relaxed text-[var(--fg-muted)]">{t('deposit.receivedBody')}</p>
      ) : awaiting && report && !reporting ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-[var(--fg)]">
            <SiteIcon name="clock" size={14} className="text-[var(--brand-text)]" />
            {t('deposit.reportedTitle')}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">
            {t('deposit.reportedBody', { date: formatDate(report.reportedAt), method: report.methodName })}
          </p>
          {report.reference ? (
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              {t('deposit.reference')}: <span dir="ltr" className="font-mono font-semibold text-[var(--fg)]">{report.reference}</span>
            </p>
          ) : null}
          {canReport ? (
            <button type="button" onClick={() => setReporting(true)} className="mt-2 text-xs font-medium text-[var(--brand-text)] hover:underline">
              {t('deposit.reportAgain')}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-[var(--fg-muted)]">{t('deposit.pendingBody')}</p>
      )}

      {awaiting && (!report || reporting) ? (
        <>
          {methods.length && !revealed && !reporting ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 text-start transition hover:border-[var(--brand)]"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)]">
                  <SiteIcon name="banknote" size={15} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[var(--fg)]">{t('deposit.showDetails')}</span>
                  <span className="block text-[11px] text-[var(--fg-muted)]">{methods.map((m) => m.name || t(TYPE_KEY[m.type])).join(' · ')}</span>
                </span>
              </span>
              <SiteIcon name="chevron-down" size={16} className="shrink-0 text-[var(--fg-muted)]" />
            </button>
          ) : null}
          {methods.length && (revealed || reporting) ? (
          <h3 className="mt-4 text-sm font-semibold text-[var(--fg)]">
            {t('deposit.payWithOne')}
          </h3>
          ) : !methods.length ? (
          <h3 className="mt-4 text-sm font-semibold text-[var(--fg)]">{t('deposit.howToPay')}</h3>
          ) : null}
          {methods.length && (revealed || reporting) ? (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {methods.map((m) => (
                <MethodCard key={m.id} method={m} order={order} />
              ))}
            </ul>
          ) : null}
          {instructions || !methods.length ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--fg)]/85">
              {instructions || t('deposit.noInstructions')}
            </p>
          ) : null}

          {canReport ? (
            reporting || !report ? (
              reporting ? (
                <ReportPaymentForm order={order} methods={methods} onDone={() => setReporting(false)} />
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" onClick={() => setReporting(true)} className="h-10 rounded-full px-4">
                    <SiteIcon name="check" size={15} />
                    {t('deposit.iPaid')}
                  </Button>
                  <button
                    type="button"
                    onClick={() => openWhatsApp({ topic: 'order' })}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)]"
                  >
                    <SiteIcon name="chat" size={15} />
                    {t('deposit.askWhatsApp')}
                  </button>
                </div>
              )
            ) : null
          ) : (
            <button
              type="button"
              onClick={() => openWhatsApp({ topic: 'order' })}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              <SiteIcon name="chat" size={16} />
              {t('deposit.sendReceipt')}
            </button>
          )}
        </>
      ) : null}
    </section>
  )
}

/** Short status for order lists: due / sent (being checked) / paid. */
export function depositState(order: Order): 'due' | 'reported' | 'paid' | null {
  const d = order.deposit
  if (!d || !(d.amount > 0) || order.orderStatus === 'cancelled') return null
  if (d.status === 'received') return 'paid'
  if (order.orderStatus !== 'pending' && order.orderStatus !== 'no_answer') return null
  return d.payment ? 'reported' : 'due'
}
