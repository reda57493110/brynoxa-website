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
import { useT } from '@/hooks/useT'
import type { Address } from '@/types'

export function Checkout() {
  const t = useT()
  usePageTitle(t('checkout.title'))
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const clear = useCartStore((s) => s.clear)
  const subtotal = useCartStore((s) => s.subtotal())
  const user = useAuthStore((s) => s.user)

  const emptyAddress: Address = {
    label: t('account.homeLabel'),
    fullName: '',
    line1: '',
    city: '',
    phone: '',
    country: 'MA',
    postalCode: '00000',
  }

  const defaultAddr = user?.addresses?.find((a) => a.isDefault) || user?.addresses?.[0]
  const [address, setAddress] = useState<Address>({
    ...emptyAddress,
    fullName: defaultAddr?.fullName || user?.name || '',
    line1: defaultAddr?.line1 || '',
    city: defaultAddr?.city || '',
    phone: defaultAddr?.phone || user?.phone || '',
    label: defaultAddr?.label || t('account.homeLabel'),
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
      toast.success(t('checkout.orderPlaced'))
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
      toast.success(res.data.message || t('checkout.couponApplied'))
    } catch (e) {
      setDiscount(0)
      toast.error(getErrorMessage(e, t('checkout.invalidCoupon')))
    } finally {
      setValidating(false)
    }
  }

  if (!items.length) {
    return (
      <>
        <PageHero kicker={t('checkout.kicker')} title={t('checkout.heading')} description={t('checkout.emptyHero')} />
        <Container className="py-10">
          <EmptyState
            title={t('checkout.emptyTitle')}
            description={t('checkout.emptyBody')}
            actionLabel={t('checkout.goShop')}
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
        kicker={t('checkout.heroKicker')}
        title={t('checkout.heading')}
        description={t('checkout.heroBody')}
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
              <h2 className="font-display text-lg font-semibold">{t('checkout.shippingTitle')}</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('checkout.shippingBody')}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Input
                  label={t('checkout.fullName')}
                  value={address.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  required
                />
                <Input
                  label={t('ui.phone')}
                  value={address.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  required
                />
                <Input
                  className="sm:col-span-2"
                  label={t('checkout.address')}
                  value={address.line1}
                  onChange={(e) => set('line1', e.target.value)}
                  required
                />
                <Input
                  className="sm:col-span-2"
                  label={t('checkout.city')}
                  value={address.city}
                  onChange={(e) => set('city', e.target.value)}
                  required
                />
              </div>
            </section>

            <section className={`${surfaceCard} p-6`}>
              <h2 className="font-display text-lg font-semibold">{t('checkout.couponTitle')}</h2>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  aria-label={t('checkout.couponCode')}
                />
                <Button
                  type="button"
                  variant="outline"
                  loading={validating}
                  onClick={validateCoupon}
                  className="rounded-full sm:shrink-0"
                >
                  {t('checkout.apply')}
                </Button>
              </div>
              <Textarea
                className="mt-4"
                label={t('checkout.orderNote')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('checkout.notePlaceholder')}
              />
            </section>
          </div>

          <aside className={`${surfaceCard} h-fit p-6 lg:sticky lg:top-[calc(var(--nav-height)+0.75rem)]`}>
            <h2 className="font-display text-lg font-semibold">{t('checkout.orderSummary')}</h2>
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
                <span className="text-[var(--fg-muted)]">{t('cart.subtotal')}</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-[var(--fg-muted)]">{t('checkout.discount')}</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">{t('checkout.shipping')}</span>
                <span>{shipping === 0 ? t('checkout.free') : formatCurrency(shipping)}</span>
              </div>
              {taxRate > 0 ? (
                <div className="flex justify-between">
                  <span className="text-[var(--fg-muted)]">{t('checkout.tax')}</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-display text-base font-semibold">
                <span>{t('checkout.totalCod')}</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-xs text-[var(--fg-muted)]">
              <li className="flex items-center gap-2">
                <SiteIcon name="package-check" size={14} className="text-[var(--brand)]" />
                {t('checkout.payOnArrival')}
              </li>
              <li className="flex items-center gap-2">
                <SiteIcon name="truck" size={14} className="text-[var(--brand)]" />
                {t('checkout.packedAfter')}
              </li>
              <li className="flex items-center gap-2">
                <SiteIcon name="shield" size={14} className="text-[var(--brand)]" />
                {t('checkout.warranty6')}
              </li>
            </ul>
            <Button type="submit" className="mt-6 w-full rounded-full" loading={placeOrder.isPending}>
              {t('checkout.placeOrder')}
            </Button>
            <Link to="/cart" className="mt-3 block text-center text-sm font-medium text-[var(--brand-text)]">
              {t('checkout.backToCart')}
            </Link>
          </aside>
        </form>
      </Container>
    </>
  )
}
