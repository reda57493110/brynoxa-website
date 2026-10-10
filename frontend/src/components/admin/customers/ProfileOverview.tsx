import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatDate, formatDateTime } from '@/lib/format'
import type {
  BillingAddress,
  BusinessInfo,
  CustomerProfile,
  CustomerType,
  CustomerUpdatePayload,
  WholesaleReviewPayload,
} from '@/types'
import { KV, Section, StatusBadge, WholesaleStatusBadge } from './shared'
import { TYPE_LABELS } from './utils'

type Save = (payload: CustomerUpdatePayload, successMsg: string) => Promise<boolean>
type Review = (payload: WholesaleReviewPayload, successMsg: string) => Promise<boolean>

const BILLING_FIELDS: { key: keyof BillingAddress; label: string }[] = [
  { key: 'fullName', label: 'Full name' },
  { key: 'line1', label: 'Address line 1' },
  { key: 'line2', label: 'Address line 2' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'Region' },
  { key: 'postalCode', label: 'Postal code' },
  { key: 'country', label: 'Country' },
  { key: 'phone', label: 'Phone' },
]

const BUSINESS_FIELDS: { key: keyof BusinessInfo; label: string }[] = [
  { key: 'companyName', label: 'Company name' },
  { key: 'contactName', label: 'Contact name' },
  { key: 'email', label: 'Business email' },
  { key: 'phone', label: 'Business phone' },
  { key: 'address', label: 'Address' },
  { key: 'taxId', label: 'Tax ID (ICE / IF)' },
]

function billingText(b?: BillingAddress) {
  if (!b) return ''
  return [b.fullName, b.line1, b.line2, [b.postalCode, b.city].filter(Boolean).join(' '), b.state, b.country, b.phone]
    .filter(Boolean)
    .join(', ')
}

/* ---------- Personal info ---------- */

function PersonalCard({ profile, save, busy }: { profile: CustomerProfile; save: Save; busy: boolean }) {
  const c = profile.customer
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(c.name)
  const [phone, setPhone] = useState(c.phone || '')
  const [billing, setBilling] = useState<BillingAddress>(c.billingAddress || {})

  const reset = () => {
    setName(c.name)
    setPhone(c.phone || '')
    setBilling(c.billingAddress || {})
  }

  const submit = async () => {
    const hasBilling = Object.values(billing).some((v) => v && String(v).trim())
    const ok = await save(
      { name: name.trim(), phone: phone.trim(), billingAddress: hasBilling ? billing : null },
      'Customer details saved'
    )
    if (ok) setEditing(false)
  }

  return (
    <Section
      title="Personal information"
      actions={
        editing ? null : (
          <Button size="sm" variant="outline" onClick={() => { reset(); setEditing(true) }}>
            Edit
          </Button>
        )
      }
    >
      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Input label="Name" value={name} required maxLength={80} onChange={(e) => setName(e.target.value)} />
          <Input label="Phone" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} />
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium">Billing address</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {BILLING_FIELDS.map((f) => (
                <Input
                  key={f.key}
                  label={f.label}
                  value={billing[f.key] || ''}
                  onChange={(e) => setBilling((b) => ({ ...b, [f.key]: e.target.value }))}
                />
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={busy} disabled={!name.trim()}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="divide-y divide-[var(--border)]">
          <KV label="Name">{c.name}</KV>
          <KV label="Email">
            <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
              <span className="break-all">{c.email}</span>
              <Badge variant={c.emailVerified === false ? 'warning' : 'success'}>
                {c.emailVerified === false ? 'Unverified' : 'Verified'}
              </Badge>
            </span>
          </KV>
          <KV label="Phone">{c.phone || '—'}</KV>
          <KV label="Registered">{formatDate(c.createdAt)}</KV>
          <KV label="Status">
            <StatusBadge status={c.status} />
          </KV>
          <KV label="Billing address">{billingText(c.billingAddress) || '—'}</KV>
          <div className="py-2 text-sm">
            <p className="text-[var(--fg-muted)]">Delivery addresses</p>
            {c.addresses?.length ? (
              <ul className="mt-2 space-y-2">
                {c.addresses.map((a, i) => (
                  <li key={a._id || i} className="rounded-xl bg-[var(--bg-muted)] px-3 py-2 text-xs leading-relaxed">
                    <span className="font-medium">{a.label || 'Address'}</span>
                    {a.isDefault ? <Badge variant="brand" className="ml-2">Default</Badge> : null}
                    <br />
                    {[a.fullName, a.line1, a.line2, a.city, a.state, a.postalCode, a.country, a.phone]
                      .filter(Boolean)
                      .join(', ')}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1">No saved addresses.</p>
            )}
          </div>
        </dl>
      )}
    </Section>
  )
}

/* ---------- Notes ---------- */

function NotesCard({ profile, save, busy }: { profile: CustomerProfile; save: Save; busy: boolean }) {
  const [notes, setNotes] = useState(profile.customer.adminNotes || '')
  useEffect(() => setNotes(profile.customer.adminNotes || ''), [profile.customer.adminNotes])
  const dirty = notes !== (profile.customer.adminNotes || '')
  return (
    <Section title="Internal notes">
      <Textarea
        aria-label="Internal notes"
        placeholder="Only visible to staff"
        maxLength={4000}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="mt-3">
        <Button size="sm" loading={busy} disabled={!dirty} onClick={() => void save({ adminNotes: notes }, 'Notes saved')}>
          Save notes
        </Button>
      </div>
    </Section>
  )
}

/* ---------- Customer type ---------- */

function TypeCard({ profile, save, busy }: { profile: CustomerProfile; save: Save; busy: boolean }) {
  const current = profile.customer.customerType || 'retail'
  const [type, setType] = useState<CustomerType>(current)
  useEffect(() => setType(current), [current])
  return (
    <Section title="Customer type">
      <Select
        aria-label="Customer type"
        value={type}
        onChange={(e) => setType(e.target.value as CustomerType)}
        options={(Object.keys(TYPE_LABELS) as CustomerType[]).map((k) => ({ value: k, label: TYPE_LABELS[k] }))}
      />
      <p className="mt-2 text-xs text-[var(--fg-muted)]">
        Changing the type alone does not grant wholesale prices — approve a wholesale application with a tier for
        that.
      </p>
      <div className="mt-3">
        <Button
          size="sm"
          loading={busy}
          disabled={type === current}
          onClick={() => void save({ customerType: type }, 'Customer type updated')}
        >
          Save type
        </Button>
      </div>
    </Section>
  )
}

/* ---------- Business info ---------- */

function BusinessCard({ profile, save, busy }: { profile: CustomerProfile; save: Save; busy: boolean }) {
  const b = profile.customer.business || {}
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<BusinessInfo>(b)
  return (
    <Section
      title="Business information"
      actions={
        editing ? null : (
          <Button size="sm" variant="outline" onClick={() => { setForm(profile.customer.business || {}); setEditing(true) }}>
            Edit
          </Button>
        )
      }
    >
      {editing ? (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (await save({ business: form }, 'Business details saved')) setEditing(false)
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {BUSINESS_FIELDS.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                value={form[f.key] || ''}
                onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={busy}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="divide-y divide-[var(--border)]">
          {BUSINESS_FIELDS.map((f) => (
            <KV key={f.key} label={f.label}>
              {b[f.key] || '—'}
            </KV>
          ))}
        </dl>
      )}
    </Section>
  )
}

/* ---------- Wholesale ---------- */

function WholesaleCard({
  profile,
  save,
  review,
  busy,
}: {
  profile: CustomerProfile
  save: Save
  review: Review
  busy: boolean
}) {
  const c = profile.customer
  const w = c.wholesale || { status: 'none' as const }
  const tiers = profile.wholesaleTiers
  const [tierId, setTierId] = useState(w.tierId || tiers[0]?.id || '')
  const [approveType, setApproveType] = useState<'wholesale' | 'business'>(w.requestedType || 'wholesale')
  const [terms, setTerms] = useState(w.paymentTerms || '')
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState<'idle' | 'reject'>('idle')
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  useEffect(() => {
    setTierId(w.tierId || tiers[0]?.id || '')
    setTerms(w.paymentTerms || '')
  }, [w.tierId, w.paymentTerms, tiers])

  const reviewedBy = typeof w.reviewedBy === 'string' ? w.reviewedBy : w.reviewedBy?.name
  const tierOptions = tiers.map((t) => ({ value: t.id, label: `${t.name} (−${t.discountPercent}%)` }))
  const noTiers = (
    <p className="rounded-xl bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] px-3 py-2 text-xs text-[var(--warning)]">
      No wholesale tiers exist yet. Create tiers in Admin → Settings before approving.
    </p>
  )

  return (
    <Section title="Wholesale account">
      <dl className="divide-y divide-[var(--border)]">
        <KV label="Status">
          <WholesaleStatusBadge status={w.status} />
        </KV>
        {c.tier ? (
          <KV label="Tier">
            {c.tier.name} (−{c.tier.discountPercent}%)
          </KV>
        ) : null}
        {w.requestedType ? <KV label="Requested type">{TYPE_LABELS[w.requestedType]}</KV> : null}
        {w.requestedAt ? <KV label="Requested">{formatDateTime(w.requestedAt)}</KV> : null}
        {w.reviewedAt ? (
          <KV label="Reviewed">
            {formatDateTime(w.reviewedAt)}
            {reviewedBy ? ` by ${reviewedBy}` : ''}
          </KV>
        ) : null}
        {w.paymentTerms ? <KV label="Payment terms">{w.paymentTerms}</KV> : null}
        {w.status === 'rejected' && w.rejectionReason ? <KV label="Rejection reason">{w.rejectionReason}</KV> : null}
      </dl>
      {w.applicationMessage ? (
        <div className="mt-3 rounded-xl bg-[var(--bg-muted)] p-3 text-sm">
          <p className="text-xs text-[var(--fg-muted)]">Application message</p>
          <p className="mt-1 whitespace-pre-wrap">{w.applicationMessage}</p>
        </div>
      ) : null}

      {w.status === 'pending' ? (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          {mode === 'reject' ? (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!reason.trim()) return
                if (await review({ action: 'reject', reason: reason.trim() }, 'Application rejected')) {
                  setMode('idle')
                  setReason('')
                }
              }}
            >
              <Textarea
                label="Reason for rejection (sent to the customer)"
                required
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" variant="danger" loading={busy} disabled={!reason.trim()}>
                  Reject application
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setMode('idle')}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              {tiers.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select label="Tier" value={tierId} onChange={(e) => setTierId(e.target.value)} options={tierOptions} />
                  <Select
                    label="Customer type"
                    value={approveType}
                    onChange={(e) => setApproveType(e.target.value as 'wholesale' | 'business')}
                    options={[
                      { value: 'wholesale', label: 'Wholesale' },
                      { value: 'business', label: 'Business' },
                    ]}
                  />
                  <div className="sm:col-span-2">
                    <Input
                      label="Payment terms (optional)"
                      placeholder="e.g. 50% deposit, balance on delivery"
                      maxLength={200}
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                noTiers
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  loading={busy}
                  disabled={!tierId || !tiers.length}
                  onClick={() =>
                    void review(
                      {
                        action: 'approve',
                        tierId,
                        customerType: approveType,
                        paymentTerms: terms.trim() || undefined,
                      },
                      'Wholesale account approved'
                    )
                  }
                >
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMode('reject')}>
                  Reject
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {w.status === 'approved' ? (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          {tiers.length ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Select label="Change tier" value={tierId} onChange={(e) => setTierId(e.target.value)} options={tierOptions} />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="sm:mb-1"
                loading={busy}
                disabled={!tierId || tierId === w.tierId}
                onClick={() => void save({ tierId }, 'Tier updated')}
              >
                Save tier
              </Button>
            </div>
          ) : (
            noTiers
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Input
                label="Payment terms"
                maxLength={200}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="sm:mb-1"
              loading={busy}
              disabled={terms === (w.paymentTerms || '')}
              onClick={() => void save({ paymentTerms: terms.trim() }, 'Payment terms updated')}
            >
              Save terms
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="text-[var(--danger)]" onClick={() => setConfirmRevoke(true)}>
            Revoke wholesale access
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmRevoke}
        title="Revoke wholesale access?"
        description="The customer will lose wholesale prices on future orders. Existing orders keep the prices they were placed with."
        confirmLabel="Revoke"
        loading={busy}
        onClose={() => setConfirmRevoke(false)}
        onConfirm={async () => {
          if (await review({ action: 'revoke' }, 'Wholesale access revoked')) setConfirmRevoke(false)
        }}
      />
    </Section>
  )
}

export function ProfileOverview({
  profile,
  save,
  review,
  busy,
}: {
  profile: CustomerProfile
  save: Save
  review: Review
  busy: boolean
}) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <PersonalCard profile={profile} save={save} busy={busy} />
        <NotesCard profile={profile} save={save} busy={busy} />
      </div>
      <div className="min-w-0 space-y-4">
        <WholesaleCard profile={profile} save={save} review={review} busy={busy} />
        <TypeCard profile={profile} save={save} busy={busy} />
        <BusinessCard profile={profile} save={save} busy={busy} />
      </div>
    </div>
  )
}
