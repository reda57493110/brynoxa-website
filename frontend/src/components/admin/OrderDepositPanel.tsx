import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { useDepositMethods } from '@/hooks/useDepositMethods'
import { getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { PhotoLightbox, PhotoTile } from '@/components/order/PrivatePhoto'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { receiptToDataUrl } from '@/lib/receiptImage'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import type { Order } from '@/types'
import { AskToPay } from '@/components/admin/AskToPay'

const MAX_PROOFS = 6

const METHOD_TYPE_LABEL: Record<string, string> = {
  bank: 'Bank transfer',
  cashplus: 'Cash Plus',
  wafacash: 'Wafacash',
  barid: 'Barid Cash',
  atm: 'ATM',
  other: 'Other',
}

/** Which of your payment options this customer sees on their order (saved right away). */
function SharedOptions({ order }: { order: Order }) {
  const qc = useQueryClient()
  const all = useDepositMethods()
  const visible = (all.data?.depositMethods ?? []).filter((m) => m.visible !== false)
  const chosen = order.deposit?.methodIds ?? []
  const isOn = (id: string) => !chosen.length || chosen.includes(id)
  const save = useMutation({
    mutationFn: (methodIds: string[]) => adminApi.orders.setDeposit(order._id, { methodIds }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-order', order._id] })
      toast.success('Saved — the customer sees these options')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  if (!visible.length) return null

  const toggle = (id: string) => {
    const on = visible.filter((m) => isOn(m.id)).map((m) => m.id)
    const next = on.includes(id) ? on.filter((x) => x !== id) : [...on, id]
    if (!next.length) {
      toast.error('Keep at least one option')
      return
    }
    // All of them = the default (empty), so new options also show
    save.mutate(next.length === visible.length ? [] : next)
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] pb-3">
      <span className="me-1 text-xs text-[var(--fg-muted)]">Shown to this customer:</span>
      {visible.map((m) => (
        <button
          key={m.id}
          type="button"
          disabled={save.isPending}
          onClick={() => toggle(m.id)}
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition disabled:opacity-60',
            isOn(m.id)
              ? 'border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]'
              : 'border-[var(--border)] text-[var(--fg-muted)] line-through'
          )}
        >
          <SiteIcon name={isOn(m.id) ? 'check' : 'close'} size={11} />
          {m.name || m.type}
        </button>
      ))}
    </div>
  )
}

/** Staff: record how the deposit was paid — method, the name on the transfer, reference. */
function PaymentRecorder({
  order,
  onDone,
  onCancel,
}: {
  order: Order
  onDone: () => void
  onCancel?: () => void
}) {
  const qc = useQueryClient()
  const current = order.deposit?.payment
  const allMethods = useDepositMethods()
  const methods = allMethods.data?.depositMethods ?? []
  const customerName = order.shippingAddress?.fullName || (typeof order.user === 'object' && order.user ? order.user.name : '') || ''
  const [methodId, setMethodId] = useState(current?.methodId || methods[0]?.id || 'other')
  const [payerName, setPayerName] = useState(current?.payerName || customerName)
  const [reference, setReference] = useState(current?.reference || '')
  const [markReceived, setMarkReceived] = useState(order.deposit?.status !== 'received')
  const editable = order.orderStatus === 'pending' || order.orderStatus === 'no_answer'

  useEffect(() => {
    if (!current?.methodId && methods[0] && methodId === 'other') setMethodId(methods[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods.length])

  const save = useMutation({
    mutationFn: () =>
      adminApi.orders.setDeposit(order._id, {
        payment: { methodId, payerName: payerName.trim() || undefined, reference: reference.trim() || undefined },
        ...(markReceived && editable && order.deposit?.status !== 'received' ? { received: true } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-order', order._id] })
      void qc.invalidateQueries({ queryKey: ['admin-orders'] })
      toast.success(markReceived && editable ? 'Payment recorded and deposit marked as received' : 'Payment recorded')
      onDone()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const options = [
    ...methods.map((m) => ({ id: m.id, label: m.name || METHOD_TYPE_LABEL[m.type] || 'Other' })),
    { id: 'other', label: 'Other' },
  ]

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setMethodId(o.id)}
            className={cn(
              'h-8 rounded-full border px-3 text-xs font-medium transition',
              methodId === o.id
                ? 'border-transparent bg-[var(--brand)] text-[var(--brand-fg)]'
                : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--brand)]'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input label="Paid by (name on the transfer)" value={payerName} maxLength={120} onChange={(e) => setPayerName(e.target.value)} />
        <Input label="Reference (optional)" value={reference} maxLength={80} dir="ltr" onChange={(e) => setReference(e.target.value)} />
      </div>
      {editable && order.deposit?.status !== 'received' ? (
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input type="checkbox" className="accent-[var(--brand)]" checked={markReceived} onChange={(e) => setMarkReceived(e.target.checked)} />
          Money received — mark the deposit as received
        </label>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          <SiteIcon name="check" size={13} /> Save payment
        </Button>
        {onCancel ? (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function Block({ icon, title, aside, children }: { icon: SiteIconName; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 sm:p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <SiteIcon name={icon} size={14} className="shrink-0 text-[var(--brand-text)]" />
        <h3 className="text-sm font-semibold">{title}</h3>
        {aside ? <span className="ms-auto">{aside}</span> : null}
      </div>
      {children}
    </div>
  )
}

/**
 * Staff view of an order's deposit, in blocks: amount, the customer's report, payment proof photos
 * (add from phone camera/gallery or PC, drag & drop or paste) and the "Mark as received" action.
 */
export function OrderDepositPanel({ order }: { order: Order }) {
  const qc = useQueryClient()
  const deposit = order.deposit
  const editable = order.orderStatus === 'pending' || order.orderStatus === 'no_answer'
  const payment = deposit?.payment
  const proofs = deposit?.proofs ?? []
  const [amount, setAmount] = useState('')
  const [viewing, setViewing] = useState<{ url: string; title: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [recording, setRecording] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setAmount(deposit?.amount ? String(deposit.amount) : '')
  }, [deposit?.amount])

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin-order', order._id] })
    void qc.invalidateQueries({ queryKey: ['admin-orders'] })
  }

  const save = useMutation({
    mutationFn: (payload: { amount?: number; received?: boolean }) => adminApi.orders.setDeposit(order._id, payload),
    onSuccess: (_res, payload) => {
      refresh()
      toast.success(payload.received === true ? 'Deposit marked as received' : 'Deposit updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const room = MAX_PROOFS - proofs.length
      for (const file of files.slice(0, room)) {
        const image = await receiptToDataUrl(file)
        await adminApi.orders.addDepositProof(order._id, image)
      }
      return Math.min(files.length, room)
    },
    onSuccess: (count) => {
      refresh()
      toast.success(count === 1 ? 'Photo added' : `${count} photos added`)
    },
    onError: (e) => {
      refresh()
      toast.error(e instanceof Error && e.message === 'not-image' ? 'That file is not a photo' : getErrorMessage(e))
    },
  })

  const remove = useMutation({
    mutationFn: (proofId: string) => adminApi.orders.removeDepositProof(order._id, proofId),
    onSuccess: () => {
      refresh()
      toast.success('Photo deleted')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const addFiles = (list: FileList | File[] | null | undefined) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'))
    if (!files.length || upload.isPending) return
    if (proofs.length >= MAX_PROOFS) {
      toast.error(`Up to ${MAX_PROOFS} photos. Delete one first.`)
      return
    }
    upload.mutate(files)
  }

  const parsed = amount.trim() === '' ? 0 : Number(amount)
  const invalid = !Number.isFinite(parsed) || parsed < 0 || parsed > order.pricing.total
  const unchanged = parsed === (deposit?.amount ?? 0)

  if (!deposit && !editable) return null

  const statusBadge = !deposit ? (
    <Badge variant="muted">None</Badge>
  ) : deposit.status === 'received' ? (
    <Badge variant="success">Received</Badge>
  ) : (
    <Badge variant={payment ? 'brand' : 'warning'}>{payment ? 'Customer says paid' : 'Awaiting deposit'}</Badge>
  )

  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-5"
      onPaste={(e) => deposit && addFiles(e.clipboardData.files)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Deposit</h2>
        {statusBadge}
        {deposit ? (
          <span className="text-xs text-[var(--fg-muted)]">{deposit.source === 'products' ? 'From product rules' : 'Set by staff'}</span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {/* 1 · Amount */}
        <Block icon="banknote" title="Amount">
          {deposit ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--fg-muted)]">Deposit</dt>
                <dd className="font-semibold tabular-nums">{formatCurrency(deposit.amount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--fg-muted)]">Collect on delivery</dt>
                <dd className="tabular-nums">{formatCurrency(Math.max(0, order.pricing.total - deposit.amount))}</dd>
              </div>
              {deposit.receivedAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--fg-muted)]">Received</dt>
                  <dd className="text-xs">{formatDateTime(deposit.receivedAt)}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-xs text-[var(--fg-muted)]">No deposit on this order.</p>
          )}
          {editable ? (
            <div className="mt-3 flex items-end gap-2">
              <Input
                label="Change amount (DH)"
                type="number"
                inputMode="decimal"
                min={0}
                max={order.pricing.total}
                step="any"
                placeholder="0 = no deposit"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                error={invalid ? `Between 0 and ${formatCurrency(order.pricing.total)}` : undefined}
              />
              <Button
                variant="outline"
                className="h-11 shrink-0"
                disabled={invalid || unchanged}
                loading={save.isPending && save.variables?.amount !== undefined}
                onClick={() => save.mutate({ amount: parsed })}
              >
                {parsed === 0 && deposit ? 'Remove' : 'Save'}
              </Button>
            </div>
          ) : null}
        </Block>

        {/* 2 · What the customer reported */}
        {deposit ? (
          <Block
            icon="user"
            title="Payment"
            aside={
              payment && !recording ? (
                <button type="button" onClick={() => setRecording(true)} className="text-xs font-medium text-[var(--brand-text)] hover:underline">
                  Edit
                </button>
              ) : null
            }
          >
            {recording || !payment ? (
              recording ? (
                <PaymentRecorder order={order} onDone={() => setRecording(false)} onCancel={() => setRecording(false)} />
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--fg-muted)]">No payment details yet.</p>
                  <Button size="sm" variant="outline" onClick={() => setRecording(true)}>
                    <SiteIcon name="plus" size={13} /> Record payment
                  </Button>
                </div>
              )
            ) : (
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--fg-muted)]">Paid with</dt>
                  <dd className="font-medium">{payment.methodName}</dd>
                </div>
                {payment.payerName ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--fg-muted)]">Paid by</dt>
                    <dd className="text-end font-medium">{payment.payerName}</dd>
                  </div>
                ) : null}
                {payment.senderPhone ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--fg-muted)]">Sender phone</dt>
                    <dd className="text-end font-mono text-xs" dir="ltr">{payment.senderPhone}</dd>
                  </div>
                ) : null}
                {typeof payment.amountSent === 'number' ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--fg-muted)]">Amount sent</dt>
                    <dd
                      className={cn(
                        'text-end font-semibold tabular-nums',
                        deposit && payment.amountSent < deposit.amount ? 'text-[var(--danger)]' : 'text-[var(--success)]'
                      )}
                    >
                      {formatCurrency(payment.amountSent)}
                      {deposit && payment.amountSent < deposit.amount ? (
                        <span className="block text-[10px] font-medium">{formatCurrency(deposit.amount - payment.amountSent)} missing</span>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                {typeof payment.fee === 'number' ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--fg-muted)]">Fees paid</dt>
                    <dd className="tabular-nums">{formatCurrency(payment.fee)}</dd>
                  </div>
                ) : null}
                {payment.paidOn ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--fg-muted)]">Paid on</dt>
                    <dd className="text-xs">{payment.paidOn.includes('T') ? formatDateTime(payment.paidOn) : formatDate(payment.paidOn)}</dd>
                  </div>
                ) : null}
                {payment.place ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--fg-muted)]">Where</dt>
                    <dd className="text-end text-xs">{payment.place}</dd>
                  </div>
                ) : null}
                {payment.codes?.length ? (
                  <div className="space-y-1 rounded-lg bg-[var(--bg-muted)] p-2">
                    <p className="text-[11px] font-medium text-[var(--fg-muted)]">ATM codes</p>
                    {payment.codes.map((c) => (
                      <div key={c.label} className="flex items-center justify-between gap-3">
                        <dt className="text-xs text-[var(--fg-muted)]">{c.label}</dt>
                        <dd className="flex items-center gap-1.5">
                          <span className="font-mono text-sm font-bold tracking-widest" dir="ltr">{c.value}</span>
                          <button
                            type="button"
                            onClick={() => void navigator.clipboard?.writeText(c.value).then(() => toast.success('Copied'))}
                            aria-label={`Copy ${c.label}`}
                            className="flex h-6 w-6 items-center justify-center rounded text-[var(--fg-muted)] hover:text-[var(--brand-text)]"
                          >
                            <SiteIcon name="layers" size={12} />
                          </button>
                        </dd>
                      </div>
                    ))}
                  </div>
                ) : null}
                {payment.reference ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--fg-muted)]">Reference</dt>
                    <dd className="break-all font-mono text-xs font-semibold">{payment.reference}</dd>
                  </div>
                ) : null}
                {payment.note ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--fg-muted)]">Note</dt>
                    <dd className="text-end text-xs">{payment.note}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--fg-muted)]">{payment.source === 'staff' ? 'Recorded' : 'Sent by customer'}</dt>
                  <dd className="text-xs">{formatDateTime(payment.reportedAt)}</dd>
                </div>
              </dl>
            )}
          </Block>
        ) : null}

        {/* Ask the customer to pay: ready message with their name, the amount and the steps */}
        {deposit && deposit.status === 'pending' && editable ? (
          <div className="lg:col-span-2">
            <Block icon="send" title="Ask to pay">
              <SharedOptions order={order} />
              <AskToPay order={order} />
            </Block>
          </div>
        ) : null}

        {/* 3 · Proof photos */}
        {deposit ? (
          <div className="lg:col-span-2">
            <Block
              icon="package-check"
              title="Payment proof"
              aside={<span className="text-[11px] text-[var(--fg-muted)]">The customer sees your photos on their order</span>}
            >
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  addFiles(e.dataTransfer.files)
                }}
                className={cn(
                  'grid grid-cols-3 gap-2 rounded-xl transition sm:grid-cols-4 xl:grid-cols-6',
                  dragging && 'outline outline-2 outline-offset-4 outline-[var(--brand)]'
                )}
              >
                {payment?.hasReceipt ? (
                  <PhotoTile
                    photoKey={['deposit-receipt', order._id, payment.reportedAt]}
                    load={() => adminApi.orders.depositReceipt(order._id)}
                    label="From customer"
                    sublabel={formatDate(payment.reportedAt)}
                    onOpen={(url) => setViewing({ url, title: 'Receipt sent by the customer' })}
                  />
                ) : null}
                {proofs.map((p) => (
                  <PhotoTile
                    key={p.id}
                    photoKey={['deposit-proof', p.id]}
                    load={() => adminApi.orders.depositProofImage(order._id, p.id)}
                    label={p.addedByName || 'Staff'}
                    sublabel={formatDate(p.addedAt)}
                    onOpen={(url) => setViewing({ url, title: 'Deposit proof' })}
                    onDelete={() => {
                      if (window.confirm('Delete this photo? The customer will no longer see it.')) remove.mutate(p.id)
                    }}
                    deleting={remove.isPending && remove.variables === p.id}
                  />
                ))}
                {proofs.length < MAX_PROOFS ? (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={upload.isPending}
                    className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--border)] p-2 text-center text-[var(--fg-muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
                  >
                    {upload.isPending ? (
                      <Spinner />
                    ) : (
                      <>
                        <SiteIcon name="plus" size={20} />
                        <span className="text-xs font-medium">Add photo</span>
                        <span className="hidden text-[10px] sm:block">or drop / paste</span>
                      </>
                    )}
                  </button>
                ) : null}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <p className="mt-2 text-[11px] text-[var(--fg-muted)]">
                Screenshot of the transfer, Cash Plus / Wafacash slip… From a phone you can take a photo or pick one from the gallery. Up to {MAX_PROOFS}.
              </p>
            </Block>
          </div>
        ) : null}
      </div>

      {/* 4 · Action */}
      {deposit ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
          {deposit.status === 'pending' ? (
            <p className="min-w-0 flex-1 basis-56 text-xs text-[var(--fg-muted)]">
              {editable
                ? "Check the money arrived, then mark it received. The order can't be confirmed before."
                : 'This order is no longer pending.'}
            </p>
          ) : (
            <p className="min-w-0 flex-1 basis-56 text-xs text-[var(--success)]">
              Received{deposit.receivedAt ? ` on ${formatDateTime(deposit.receivedAt)}` : ''}. The customer was told by email.
            </p>
          )}
          {editable ? (
            <Button
              className="h-11 w-full shrink-0 sm:w-auto"
              variant={deposit.status === 'received' ? 'ghost' : 'primary'}
              loading={save.isPending && save.variables?.received !== undefined}
              onClick={() => save.mutate({ received: deposit.status !== 'received' })}
            >
              <SiteIcon name={deposit.status === 'received' ? 'refresh' : 'check'} size={15} />
              {deposit.status === 'received' ? 'Mark as not received' : 'Mark as received'}
            </Button>
          ) : null}
        </div>
      ) : null}

      <PhotoLightbox url={viewing?.url ?? null} title={viewing?.title ?? ''} onClose={() => setViewing(null)} />
    </section>
  )
}
