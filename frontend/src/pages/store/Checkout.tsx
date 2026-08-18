import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ordersApi } from '@/api/ordersApi'
import { couponsApi } from '@/api/couponsApi'
import { settingsApi } from '@/api/settingsApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { formatCurrency } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { Address } from '@/types'

const emptyAddress: Address = {
  label: 'Home',
  fullName: '',
  line1: '',
  city: '',
  phone: '',
  country: 'MA',
  postalCode: '00000',
}

export function Checkout() {
  usePageTitle('Checkout — Brynoxa')
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
    city: defaultAddr?.city || '',
    phone: defaultAddr?.phone || user?.phone || '',
    label: defaultAddr?.label || 'Home',
    country: 'MA',
    postalCode: '00000',
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
    const flat = settings.data?.shippingFlatRate ?? 150
    const freeMin = settings.data?.freeShippingMin ?? 2000
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
          city: address.city,
          postalCode: '00000',
          country: 'MA',
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
      <>
        <PageHero kicker="Checkout" title="Checkout" description="Your cart is empty." />
        <Container className="py-10">
          <EmptyState
            title="Nothing to checkout"
            description="Add a product first, then come back to pay on delivery."
            actionLabel="Go to shop"
            onAction={() => navigate('/shop')}
          />
        </Container>
      </>
    )
  }

  const set = (key: keyof Address, value: string) =>
    setAddress((prev) => ({ ...prev, [key]: value }))

  return (
    <>
      <PageHero
        kicker="Cash on delivery"
        title="Checkout"
        description="Name, phone, address, city — inspect the box, then pay the courier."
      />
      <Container className="py-8 sm:py-10">
        <form
          className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]"
          onSubmit={(e) => {
            e.preventDefault()
            placeOrder.mutate()
          }}
        >
          <div className="space-y-6">
            <section className={`${surfaceCard} p-6`}>
              <h2 className="font-display text-lg font-semibold">Shipping in Morocco</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">We only deliver inside the country.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Input
                  label="Full name"
                  value={address.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  required
                />
                <Input
                  label="Phone"
                  value={address.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  required
                />
                <Input
                  className="sm:col-span-2"
                  label="Address"
                  value={address.line1}
                  onChange={(e) => set('line1', e.target.value)}
                  required
                />
                <Input
                  className="sm:col-span-2"
                  label="City"
                  value={address.city}
                  onChange={(e) => set('city', e.target.value)}
                  required
                />
              </div>
            </section>

            <section className={`${surfaceCard} p-6`}>
              <h2 className="font-display text-lg font-semibold">Coupon & note</h2>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  aria-label="Coupon code"
                />
                <Button
                  type="button"
                  variant="outline"
                  loading={validating}
                  onClick={validateCoupon}
                  className="rounded-full sm:shrink-0"
                >
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

          <aside className={`${surfaceCard} h-fit p-6 lg:sticky lg:top-[calc(var(--nav-height)+0.75rem)]`}>
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
              {discount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-[var(--fg-muted)]">Discount</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Shipping</span>
                <span>{shipping === 0 ? 'Free' : formatCurrency(shipping)}</span>
              </div>
              {taxRate > 0 ? (
                <div className="flex justify-between">
                  <span className="text-[var(--fg-muted)]">Tax</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-display text-base font-semibold">
                <span>Total (COD)</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-xs text-[var(--fg-muted)]">
              <li className="flex items-center gap-2">
                <SiteIcon name="package-check" size={14} className="text-[var(--brand)]" />
                Pay on arrival
              </li>
              <li className="flex items-center gap-2">
                <SiteIcon name="truck" size={14} className="text-[var(--brand)]" />
                Packed after confirmation
              </li>
              <li className="flex items-center gap-2">
                <SiteIcon name="shield" size={14} className="text-[var(--brand)]" />
                6-month warranty
              </li>
            </ul>
            <Button type="submit" className="mt-6 w-full rounded-full" loading={placeOrder.isPending}>
              Place COD order
            </Button>
            <Link to="/cart" className="mt-3 block text-center text-sm font-medium text-[var(--brand-text)]">
              Back to cart
            </Link>
          </aside>
        </form>
      </Container>
    </>
  )
}
