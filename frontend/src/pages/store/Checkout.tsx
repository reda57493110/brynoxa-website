import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ordersApi } from '@/api/ordersApi'
import { couponsApi } from '@/api/couponsApi'
import { settingsApi } from '@/api/settingsApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { formatCurrency } from '@/lib/format'
import type { Address } from '@/types'

const emptyAddress: Address = {
  label: 'Home',
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
  phone: '',
}

export function Checkout() {
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const clear = useCartStore((s) => s.clear)
  const subtotal = useCartStore((s) => s.subtotal())
  const user = useAuthStore((s) => s.user)

  const defaultAddr = user?.addresses?.find((a) => a.isDefault) || user?.addresses?.[0]
  const [address, setAddress] = useState<Address>({
    ...emptyAddress,
    fullName: defaultAddr?.fullName || user?.name || '',
    line1: defaultAddr?.line1 || '',
    line2: defaultAddr?.line2 || '',
    city: defaultAddr?.city || '',
    state: defaultAddr?.state || '',
    postalCode: defaultAddr?.postalCode || '',
    country: defaultAddr?.country || 'US',
    phone: defaultAddr?.phone || user?.phone || '',
    label: defaultAddr?.label || 'Home',
  })
  const [couponCode, setCouponCode] = useState('')
  const [discount, setDiscount] = useState(0)
  const [note, setNote] = useState('')
  const [validating, setValidating] = useState(false)

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
  })

  const shipping = useMemo(() => {
    const flat = settings.data?.shippingFlatRate ?? 15
    const freeMin = settings.data?.freeShippingMin ?? 200
    return subtotal >= freeMin ? 0 : flat
  }, [settings.data, subtotal])

  const taxRate = settings.data?.taxRate ?? 0
  const taxable = Math.max(0, subtotal - discount)
  const tax = (taxable * taxRate) / 100
  const total = taxable + shipping + tax

  const placeOrder = useMutation({
    mutationFn: () =>
      ordersApi.create({
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        shippingAddress: {
          label: address.label,
          fullName: address.fullName,
          line1: address.line1,
          line2: address.line2 || undefined,
          city: address.city,
          state: address.state || undefined,
          postalCode: address.postalCode,
          country: address.country,
          phone: address.phone,
        },
        couponCode: couponCode || undefined,
        customerNote: note || undefined,
      }),
    onSuccess: (res) => {
      clear()
      toast.success('Order placed')
      navigate(`/order-confirmation/${res.data.data.orderNumber}`)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const validateCoupon = async () => {
    if (!couponCode.trim()) return
    setValidating(true)
    try {
      const res = await couponsApi.validate(couponCode.trim(), subtotal)
      setDiscount(res.data.data.discount || 0)
      toast.success(res.data.message || 'Coupon applied')
    } catch (e) {
      setDiscount(0)
      toast.error(getErrorMessage(e, 'Invalid coupon'))
    } finally {
      setValidating(false)
    }
  }

  if (!items.length) {
    return (
      <Container className="py-16">
        <EmptyState title="Nothing to checkout" actionLabel="Go to shop" onAction={() => navigate('/shop')} />
      </Container>
    )
  }

  const set = (key: keyof Address, value: string) =>
    setAddress((prev) => ({ ...prev, [key]: value }))

  return (
    <Container className="py-10">
      <h1 className="font-display text-3xl font-semibold">Checkout</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">Cash on delivery only</p>

      <form
        className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]"
        onSubmit={(e) => {
          e.preventDefault()
          placeOrder.mutate()
        }}
      >
        <div className="space-y-6">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="font-display text-lg font-semibold">Shipping address</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input label="Full name" value={address.fullName} onChange={(e) => set('fullName', e.target.value)} required />
              <Input label="Phone" value={address.phone} onChange={(e) => set('phone', e.target.value)} required />
              <Input className="sm:col-span-2" label="Address line 1" value={address.line1} onChange={(e) => set('line1', e.target.value)} required />
              <Input className="sm:col-span-2" label="Address line 2" value={address.line2 || ''} onChange={(e) => set('line2', e.target.value)} />
              <Input label="City" value={address.city} onChange={(e) => set('city', e.target.value)} required />
              <Input label="State" value={address.state || ''} onChange={(e) => set('state', e.target.value)} />
              <Input label="Postal code" value={address.postalCode} onChange={(e) => set('postalCode', e.target.value)} required />
              <Input label="Country" value={address.country} onChange={(e) => set('country', e.target.value)} required />
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="font-display text-lg font-semibold">Coupon</h2>
            <div className="mt-3 flex gap-2">
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="CODE"
              />
              <Button type="button" variant="outline" loading={validating} onClick={validateCoupon}>
                Apply
              </Button>
            </div>
            <Textarea
              className="mt-4"
              label="Order note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional delivery instructions"
            />
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-soft">
          <h2 className="font-display text-lg font-semibold">Order summary</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3">
                <span className="text-[var(--fg-muted)]">
                  {i.name} × {i.qty}
                </span>
                <span>{formatCurrency(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Discount</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Shipping</span>
              <span>{shipping === 0 ? 'Free' : formatCurrency(shipping)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Tax</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between font-display text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
          <Button type="submit" className="mt-6 w-full" loading={placeOrder.isPending}>
            Place COD order
          </Button>
          <Link to="/cart" className="mt-3 block text-center text-sm text-[var(--brand)]">
            Back to cart
          </Link>
        </aside>
      </form>
    </Container>
  )
}
