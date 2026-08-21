import { useState, type FormEvent } from 'react'
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
import { saveGuestReceipt } from '@/lib/guestReceipt'
import { formatCurrency } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'
import type { Address } from '@/types'

export function Checkout() {
  const t = useT()
  usePageTitle(t('checkout.title'))
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const clear = useCartStore((s) => s.clear)
  const subtotal = useCartStore((s) => s.subtotal())
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const isAuth = Boolean(user)

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
  const [email, setEmail] = useState(user?.email || '')
  const [createAccount, setCreateAccount] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [discount, setDiscount] = useState(0)
  const [note, setNote] = useState('')
  const [validating, setValidating] = useState(false)
  const [formError, setFormError] = useState('')

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
  })

  const taxRate = settings.data?.taxRate ?? 0
  const taxable = Math.max(0, subtotal - discount)
  const tax = (taxable * taxRate) / 100
  const total = taxable + tax

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
        email: isAuth ? undefined : email.trim(),
        password: !isAuth && createAccount ? password : undefined,
      }),
    onSuccess: (res) => {
      const payload = res.data.data
      const order = payload.order
      if (payload.user && payload.accessToken) {
        setAuth(payload.user, payload.accessToken)
      } else if (!isAuth) {
        saveGuestReceipt(order.orderNumber, email.trim(), order)
      }
      clear()
      toast.success(t('checkout.orderPlaced'))
      navigate(`/order-confirmation/${order.orderNumber}`)
    },
    onError: (e) => {
      setFormError(getErrorMessage(e))
      toast.error(getErrorMessage(e))
    },
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
        <PageHero
          kicker={t('checkout.kicker')}
          title={t('checkout.heading')}
          description={t('checkout.emptyHero')}
        />
        <Container className="py-5 sm:py-10">
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

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!isAuth) {
      if (!email.trim() || !email.includes('@')) {
        setFormError(t('checkout.emailRequired'))
        return
      }
      if (createAccount) {
        if (password.length < 6) {
          setFormError(t('checkout.passwordMin'))
          return
        }
        if (password !== confirmPassword) {
          setFormError(t('checkout.passwordMismatch'))
          return
        }
      }
    }

    placeOrder.mutate()
  }

  return (
    <>
      <PageHero
        kicker={t('checkout.heroKicker')}
        title={t('checkout.heading')}
        description={t('checkout.heroBody')}
      >
        <Link
          to="/cart"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--brand-text)] transition hover:border-[var(--brand)]"
        >
          {t('checkout.backToCart')}
        </Link>
      </PageHero>

      <Container className="pb-28 pt-5 sm:py-10 lg:pb-10">
        <form
          id="checkout-form"
          className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8"
          onSubmit={onSubmit}
        >
          <div className="space-y-4 sm:space-y-6">
            {!isAuth ? (
              <section className={cn(surfaceCard, 'p-4 sm:p-6')}>
                <h2 className="font-display text-base font-semibold sm:text-lg">
                  {t('checkout.yourInfo')}
                </h2>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('checkout.guestBody')}</p>
                <p className="mt-3 text-sm text-[var(--fg-muted)]">
                  {t('checkout.haveAccount')}{' '}
                  <Link
                    to="/login"
                    state={{ from: '/checkout' }}
                    className="font-medium text-[var(--brand-text)] underline-offset-2 hover:underline"
                  >
                    {t('checkout.signIn')}
                  </Link>
                </p>
                <div className="mt-4 grid gap-3 sm:mt-5">
                  <Input
                    label={t('ui.email')}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-[var(--brand)]"
                      checked={createAccount}
                      onChange={(e) => setCreateAccount(e.target.checked)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-[var(--fg)]">
                        {t('checkout.createAccount')}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
                        {t('checkout.createAccountHint')}
                      </span>
                    </span>
                  </label>
                  {createAccount ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label={t('ui.password')}
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <Input
                        label={t('checkout.confirmPassword')}
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className={cn(surfaceCard, 'p-4 sm:p-6')}>
              <h2 className="font-display text-base font-semibold sm:text-lg">
                {t('checkout.shippingTitle')}
              </h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('checkout.shippingBody')}</p>
              <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2">
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

            <section className={cn(surfaceCard, 'p-4 sm:p-6')}>
              <h2 className="font-display text-base font-semibold sm:text-lg">
                {t('checkout.couponTitle')}
              </h2>
              <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row">
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
                  className="h-11 w-full rounded-full sm:w-auto sm:shrink-0"
                >
                  {t('checkout.apply')}
                </Button>
              </div>
              <Textarea
                className="mt-3 sm:mt-4"
                label={t('checkout.orderNote')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('checkout.notePlaceholder')}
                rows={3}
              />
            </section>

            {formError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {formError}
              </p>
            ) : null}
          </div>

          <aside
            className={cn(
              surfaceCard,
              'hidden h-fit p-5 sm:block sm:p-6 lg:sticky lg:top-[calc(var(--nav-height)+0.75rem)]'
            )}
          >
            <h2 className="font-display text-lg font-semibold">{t('checkout.orderSummary')}</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {items.map((i) => (
                <li key={i.productId} className="flex justify-between gap-3">
                  <span className="line-clamp-1 text-[var(--fg-muted)]">
                    {i.name} × {i.qty}
                  </span>
                  <span className="shrink-0">{formatCurrency(i.price * i.qty)}</span>
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
                <SiteIcon name="package-check" size={14} className="text-[var(--brand-text)]" />
                {t('checkout.payOnArrival')}
              </li>
              <li className="flex items-center gap-2">
                <SiteIcon name="shield" size={14} className="text-[var(--brand-text)]" />
                {t('checkout.warranty6')}
              </li>
            </ul>
            <Button type="submit" className="mt-6 w-full rounded-full" loading={placeOrder.isPending}>
              {t('checkout.placeOrder')}
            </Button>
            <Link
              to="/cart"
              className="mt-3 block text-center text-sm font-medium text-[var(--brand-text)]"
            >
              {t('checkout.backToCart')}
            </Link>
          </aside>
        </form>

        <div className={cn(surfaceCard, 'mt-5 p-4 sm:hidden')}>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--fg-muted)]">{t('cart.subtotal')}</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 ? (
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-[var(--fg-muted)]">{t('checkout.discount')}</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
          ) : null}
          <div className="mt-3 flex justify-between border-t border-[var(--border)] pt-3 font-display text-base font-semibold">
            <span>{t('checkout.totalCod')}</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--fg-muted)]">
            <li className="inline-flex items-center gap-1">
              <SiteIcon name="package-check" size={12} className="text-[var(--brand-text)]" />
              {t('checkout.payOnArrival')}
            </li>
            <li className="inline-flex items-center gap-1">
              <SiteIcon name="shield" size={12} className="text-[var(--brand-text)]" />
              {t('checkout.warranty6')}
            </li>
          </ul>
        </div>
      </Container>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 px-4 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-[var(--fg-muted)]">{t('checkout.totalCod')}</p>
            <p className="font-display text-base font-semibold">{formatCurrency(total)}</p>
          </div>
          <Button
            type="submit"
            form="checkout-form"
            className="h-11 flex-1 rounded-full text-sm"
            loading={placeOrder.isPending}
          >
            {t('checkout.placeOrder')}
          </Button>
        </div>
      </div>
    </>
  )
}
