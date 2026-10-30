import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { SafeImage } from '@/components/ui/SafeImage'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { ordersApi } from '@/api/ordersApi'
import { couponsApi } from '@/api/couponsApi'
import { settingsApi } from '@/api/settingsApi'
import { wholesaleApi } from '@/api/wholesaleApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { LegalConsent } from '@/components/legal/LegalConsent'
import { useCartStore } from '@/store/cartStore'
import { useCartLiveProducts } from '@/hooks/useCartLiveProducts'
import { useAuthStore } from '@/store/authStore'
import { useLocaleStore } from '@/store/localeStore'
import { toast } from '@/store/toastStore'
import { saveGuestReceipt } from '@/lib/guestReceipt'
import { linkPushToOrder } from '@/lib/push'
import { formatCurrency } from '@/lib/format'
import { resolveShippingFee } from '@/lib/shipping'
import { orderDeposit } from '@/lib/deposit'
import { wholesaleUnitPrice } from '@/lib/wholesale'
import { trackBeginCheckout, trackPurchase } from '@/lib/analytics'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'
import type { Address, Product } from '@/types'
import { ConditionBadge } from '@/components/product/ConditionBadge'
import { isPreOwned } from '@/lib/condition'
import { HelpLink } from '@/components/help/HelpLink'

export function Checkout() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  usePageTitle(t('checkout.title'), { noIndex: true })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const items = useCartStore((s) => s.items)
  const clear = useCartStore((s) => s.clear)
  const cartSubtotal = useCartStore((s) => s.subtotal())
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const isAuth = Boolean(user)
  const beganCheckout = useRef(false)

  useEffect(() => {
    if (!items.length || beganCheckout.current) return
    beganCheckout.current = true
    trackBeginCheckout(
      items.map((i) => ({
        item_id: i.productId,
        item_name: i.name,
        item_sku: i.sku,
        price: i.price,
        quantity: i.qty,
      })),
      cartSubtotal
    )
  }, [items, cartSubtotal])

  const emptyAddress: Address = {
    label: t('account.homeLabel'),
    fullName: '',
    line1: '',
    city: '',
    phone: '',
    country: 'MA',
    postalCode: '00000',
  }
  const emptyAddressRef = useRef(emptyAddress)
  emptyAddressRef.current = emptyAddress

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
  const [selectedAddressId, setSelectedAddressId] = useState(defaultAddr?._id || '')
  const [email, setEmail] = useState(user?.email || '')
  const [createAccount, setCreateAccount] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [discount, setDiscount] = useState(0)
  const [note, setNote] = useState('')
  const [validating, setValidating] = useState(false)
  const [stockChecking, setStockChecking] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!user) return
    setEmail(user.email)
    const nextDefault = user.addresses.find((a) => a.isDefault) || user.addresses[0]
    if (nextDefault) {
      setSelectedAddressId(nextDefault._id || '')
      setAddress({
        ...emptyAddressRef.current,
        ...nextDefault,
        country: nextDefault.country || 'MA',
        postalCode: nextDefault.postalCode || '00000',
      })
    }
    // Only when someone else signs in: a background session refresh must not replace what was typed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id])

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
  })

  // Today's product data: prices (the cart is brought up to date), stock check on submit, and
  // deposit rules shown before ordering
  const currentProducts = useCartLiveProducts()

  // Approved wholesale customers are charged their tier price by the server; mirror it here.
  // If the request fails we show retail totals (the server stays authoritative).
  const wholesalePricing = useQuery({
    queryKey: ['wholesale-pricing', user?._id],
    queryFn: async () => (await wholesaleApi.pricing()).data.data,
    enabled: isAuth,
    retry: false,
  })
  const wholesaleTerms =
    isAuth && !wholesalePricing.isError ? (wholesalePricing.data?.terms ?? null) : null
  const chargedLines = (products: Product[]) =>
    items.map((item) => {
      const product = products.find((p) => p._id === item.productId)
      const list = product?.price ?? item.price
      const charged = wholesaleTerms
        ? wholesaleUnitPrice(list, wholesaleTerms.discountPercent)
        : list
      return { item, product, list, charged }
    })
  // Totals from today's prices (the server charges these), for retail and wholesale customers
  const sumOf = (lines: ReturnType<typeof chargedLines>, pick: (line: ReturnType<typeof chargedLines>[number]) => number) =>
    Math.round(lines.reduce((acc, line) => acc + pick(line) * line.item.qty, 0) * 100) / 100
  const lines = chargedLines(currentProducts.data ?? [])
  const listSubtotal = sumOf(lines, (l) => l.list)
  const wholesaleDiscount = wholesaleTerms ? sumOf(lines, (l) => l.list - l.charged) : 0
  const subtotal = sumOf(lines, (l) => l.charged)

  const taxRate = settings.data?.taxRate ?? 0
  const taxable = Math.max(0, subtotal - discount)
  // Same as the server: free shipping is checked after the coupon
  const shipping = resolveShippingFee(settings.data, address.city, taxable)
  // Rounded to the centime, exactly as the server charges (backend order.service.ts priceOrder)
  const tax = Math.round(((taxable * taxRate) / 100) * 100) / 100
  const total = Math.round((taxable + shipping + tax) * 100) / 100
  const cityRateOptions = settings.data?.shippingByCity ?? []
  const freeShippingMin = settings.data?.freeShippingMin ?? 0
  const qualifiesFreeShipping = freeShippingMin > 0 && taxable >= freeShippingMin

  const depositFor = (products: Product[]) =>
    orderDeposit(
      chargedLines(products).map(({ item, product, charged }) => ({
        rule: product?.deposit,
        price: charged,
        qty: item.qty,
      })),
      total
    )
  const wholesaleRow =
    wholesaleTerms && wholesaleDiscount > 0 ? (
      <div className="flex justify-between gap-3">
        <span className="text-[var(--fg-muted)]">
          {t('wholesale.checkoutRow', {
            tier: wholesaleTerms.tierName,
            percent: wholesaleTerms.discountPercent,
          })}
        </span>
        <span className="shrink-0 text-[var(--success)]">-{formatCurrency(wholesaleDiscount)}</span>
      </div>
    ) : null
  const wholesaleBadge = wholesaleTerms ? (
    <p className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand)]/40 bg-[var(--brand)]/[0.06] px-2.5 py-1 text-xs font-medium text-[var(--brand-text)]">
      <SiteIcon name="package-check" size={12} />
      {t('wholesale.checkoutBadge')}
    </p>
  ) : null
  const deposit = depositFor(currentProducts.data ?? [])
  const depositRows =
    deposit > 0 ? (
      <>
        <div className="flex justify-between gap-3 text-[var(--fg)]">
          <span>{t('deposit.payNow')}</span>
          <span className="font-semibold">{formatCurrency(deposit)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[var(--fg-muted)]">{t('deposit.payOnDelivery')}</span>
          <span>{formatCurrency(Math.max(0, total - deposit))}</span>
        </div>
        <p className="rounded-xl border border-[var(--brand)]/40 bg-[var(--brand)]/[0.06] px-3 py-2 text-xs leading-relaxed text-[var(--fg)]">
          {t('deposit.checkoutNote')}
        </p>
      </>
    ) : null

  const placeOrder = useMutation({
    mutationFn: () =>
      ordersApi.create({
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        shippingAddress: {
          label: address.label,
          fullName: address.fullName,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode || '00000',
          country: address.country || 'MA',
          phone: address.phone,
        },
        couponCode: appliedCoupon || undefined,
        customerNote: note || undefined,
        email: isAuth ? undefined : email.trim(),
        password: !isAuth && createAccount ? password : undefined,
      }),
    onSuccess: (res) => {
      const payload = res.data.data
      const order = payload.order
      trackPurchase({
        transactionId: order.orderNumber,
        value: order.pricing?.total ?? subtotal,
        coupon: appliedCoupon || undefined,
        items: items.map((i) => ({
          item_id: i.productId,
          item_name: i.name,
          item_sku: i.sku,
          price: i.price,
          quantity: i.qty,
        })),
      })
      if (payload.user && payload.accessToken) {
        setAuth(payload.user, payload.accessToken)
      } else if (!isAuth && payload.receiptToken) {
        saveGuestReceipt(order.orderNumber, payload.receiptToken, order)
      }
      void linkPushToOrder(
        locale,
        payload.receiptToken
          ? { orderNumber: order.orderNumber, token: payload.receiptToken }
          : undefined
      ).catch(() => undefined)
      clear()
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success(t('checkout.orderPlaced'))
      navigate(`/order-confirmation/${order.orderNumber}`)
    },
    onError: (e) => {
      setFormError(getErrorMessage(e))
      toast.error(getErrorMessage(e))
    },
  })

  const validateCoupon = async (code = couponCode, quiet = false) => {
    if (!code.trim()) {
      setDiscount(0)
      setAppliedCoupon('')
      return
    }
    setValidating(true)
    couponCheckedFor.current = subtotal
    try {
      const res = await couponsApi.validate(
        code.trim(),
        subtotal,
        items.map((i) => ({ productId: i.productId, qty: i.qty }))
      )
      setDiscount(res.data.data.discount || 0)
      setAppliedCoupon(code.trim().toUpperCase())
      if (!quiet) toast.success(t('checkout.couponApplied'))
    } catch (e) {
      setDiscount(0)
      setAppliedCoupon('')
      toast.error(getErrorMessage(e, t('checkout.invalidCoupon')))
    } finally {
      setValidating(false)
    }
  }

  // The discount was worked out for one subtotal: when the cart or its prices change, check the
  // applied coupon again (quietly) so the summary always matches what the server will charge
  const couponCheckedFor = useRef<number | null>(null)
  useEffect(() => {
    if (!appliedCoupon || validating || couponCheckedFor.current === subtotal) return
    void validateCoupon(appliedCoupon, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, appliedCoupon])

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

  const onSubmit = async (e: FormEvent) => {
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

    setStockChecking(true)
    try {
      const fresh = await currentProducts.refetch({ throwOnError: true })
      const latest = fresh.data ?? []

      const stockIssue = items.find((item) => {
        const current = latest.find((product) => product._id === item.productId)
        return !current || current.stock < item.qty
      })
      if (stockIssue) {
        setFormError(t('checkout.stockChanged', { name: stockIssue.name }))
        return
      }
      // Never place an order at other prices than the ones on screen
      if (sumOf(chargedLines(latest), (l) => l.charged) !== subtotal) {
        useCartStore.getState().syncLive(latest)
        setFormError(t('checkout.pricesChanged'))
        return
      }
      // Never place an order with a different deposit than the one on screen
      if (depositFor(latest) !== deposit) {
        setFormError(t('deposit.changed'))
        return
      }

      placeOrder.mutate()
    } catch (e) {
      setFormError(getErrorMessage(e, t('checkout.stockCheckFailed')))
    } finally {
      setStockChecking(false)
    }
  }

  const itemCount = items.reduce((n, i) => n + i.qty, 0)
  const busy = placeOrder.isPending || stockChecking || settings.isLoading || currentProducts.isLoading
  const step = (n: number) => (isAuth ? n - 1 : n)

  const summaryItems = (
    <ul className="space-y-3">
      {items.map((i) => {
        const condition =
          currentProducts.data?.find((p) => p._id === i.productId)?.condition ?? i.condition
        const fit = imageFit(i.image)
        return (
          <li key={i.productId} className="flex items-center gap-3">
            <span className="relative shrink-0">
              <span
                className={cn(
                  'block h-14 w-14 overflow-hidden rounded-xl border border-[var(--border)]',
                  fit === 'contain' ? 'bg-white' : 'bg-[var(--bg-muted)]'
                )}
              >
                {i.image ? (
                  <SafeImage
                    src={sizedImageUrl(i.image, 160)}
                    alt=""
                    referrerPolicy="no-referrer"
                    className={cn(
                      'h-full w-full',
                      fit === 'contain' ? 'object-contain p-1 mix-blend-multiply' : 'object-cover'
                    )}
                  />
                ) : null}
              </span>
              <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold tabular-nums text-[var(--brand-fg)]">
                {i.qty}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <Link
                to={`/product/${i.slug}`}
                className="line-clamp-2 text-sm font-medium leading-snug hover:text-[var(--brand-text)]"
              >
                {i.name}
              </Link>
              {isPreOwned(condition) ? (
                <ConditionBadge condition={condition} size="sm" className="mt-1" />
              ) : null}
            </span>
            <span className="shrink-0 text-sm font-medium tabular-nums">
              {formatCurrency(
                (lines.find((l) => l.item.productId === i.productId)?.list ?? i.price) *
                  i.qty
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )

  const totalsRows = (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-[var(--fg-muted)]">{t('cart.subtotal')}</span>
        <span className="tabular-nums">{formatCurrency(listSubtotal)}</span>
      </div>
      {wholesaleRow}
      {discount > 0 ? (
        <div className="flex justify-between">
          <span className="text-[var(--fg-muted)]">
            {t('checkout.discount')}
            {appliedCoupon ? ` · ${appliedCoupon}` : ''}
          </span>
          <span className="tabular-nums text-[var(--success)]">-{formatCurrency(discount)}</span>
        </div>
      ) : null}
      <div className="flex justify-between">
        <span className="text-[var(--fg-muted)]">{t('checkout.shipping')}</span>
        <span className={cn('tabular-nums', shipping === 0 && 'font-medium text-[var(--success)]')}>
          {shipping > 0 ? formatCurrency(shipping) : t('checkout.free')}
        </span>
      </div>
      {taxRate > 0 ? (
        <div className="flex justify-between">
          <span className="text-[var(--fg-muted)]">{t('checkout.tax')}</span>
          <span className="tabular-nums">{formatCurrency(tax)}</span>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between border-t border-[var(--border)] pt-3">
        <span className="font-display text-base font-semibold">{t('checkout.totalCod')}</span>
        <span className="font-display text-xl font-semibold tabular-nums">{formatCurrency(total)}</span>
      </div>
      {depositRows}
    </div>
  )

  const trust = (
    <ul className="grid grid-cols-2 gap-2 text-[11px] text-[var(--fg-muted)] sm:text-xs">
      <li className="flex items-center gap-1.5 rounded-xl bg-[var(--bg-muted)] px-2.5 py-2">
        <SiteIcon name="banknote" size={14} className="shrink-0 text-[var(--brand-text)]" />
        {t('checkout.payOnArrival')}
      </li>
      <li className="flex items-center gap-1.5 rounded-xl bg-[var(--bg-muted)] px-2.5 py-2">
        <SiteIcon name="shield" size={14} className="shrink-0 text-[var(--brand-text)]" />
        {t('checkout.warranty6')}
      </li>
    </ul>
  )

  return (
    <>
      <Container className="pb-32 pt-4 sm:pb-12 sm:pt-8">
        {/* Compact header: back to cart, title, progress */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <Link
              to="/cart"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-text)] hover:underline sm:text-sm"
            >
              <SiteIcon name="arrow-left" size={13} className="rtl:rotate-180" />
              {t('checkout.backToCart')}
            </Link>
            <h1 className="mt-1 font-display text-2xl font-semibold sm:text-4xl">{t('checkout.heading')}</h1>
            <p className="mt-1 hidden text-sm text-[var(--fg-muted)] sm:block">{t('checkout.heroBody')}</p>
          </div>
          <ol className="flex items-center gap-2 text-[11px] font-medium sm:text-xs" aria-label={t('checkout.heading')}>
            {[
              { label: t('checkout.stepCart'), state: 'done' },
              { label: t('checkout.stepDetails'), state: 'current' },
              { label: t('checkout.stepDone'), state: 'next' },
            ].map((s, index) => (
              <li key={s.label} className="flex items-center gap-2" aria-current={s.state === 'current' ? 'step' : undefined}>
                {index > 0 ? (
                  <span className={cn('h-px w-5 sm:w-8', s.state === 'next' ? 'bg-[var(--border)]' : 'bg-[var(--brand)]')} />
                ) : null}
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                    s.state === 'done' && 'bg-[var(--brand)] text-[var(--brand-fg)]',
                    s.state === 'current' && 'border-2 border-[var(--brand)] text-[var(--brand-text)]',
                    s.state === 'next' && 'border border-[var(--border)] text-[var(--fg-muted)]'
                  )}
                >
                  {s.state === 'done' ? <SiteIcon name="check" size={12} /> : index + 1}
                </span>
                <span className={s.state === 'next' ? 'text-[var(--fg-muted)]' : ''}>{s.label}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Phones: the products, folded under a one-line summary */}
        <details className={cn(surfaceCard, 'group mt-4 overflow-hidden lg:hidden')}>
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="flex -space-x-2 rtl:space-x-reverse">
              {items.slice(0, 3).map((i) => (
                <span
                  key={i.productId}
                  className={cn(
                    'h-8 w-8 overflow-hidden rounded-lg border-2 border-[var(--bg-elevated)]',
                    imageFit(i.image) === 'contain' ? 'bg-white' : 'bg-[var(--bg-muted)]'
                  )}
                >
                  {i.image ? (
                    <SafeImage src={sizedImageUrl(i.image, 80)} alt="" loading="eager" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : null}
                </span>
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{t('checkout.orderSummary')}</span>
              <span className="block text-xs text-[var(--fg-muted)]">{t('cart.itemsInCart', { count: itemCount })}</span>
            </span>
            <span className="shrink-0 font-display text-base font-semibold tabular-nums">{formatCurrency(total)}</span>
            <SiteIcon name="chevron-down" size={16} className="shrink-0 text-[var(--fg-muted)] transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-[var(--border)] px-4 py-4">{summaryItems}</div>
        </details>

        <form
          id="checkout-form"
          className="mt-4 grid gap-4 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8"
          onSubmit={onSubmit}
        >
          <div className="space-y-4 sm:space-y-5">
            {!isAuth ? (
              <section className={cn(surfaceCard, 'p-4 sm:p-6')}>
                <SectionTitle n={1} icon="user" title={t('checkout.yourInfo')} />
                <p className="mt-2 text-sm text-[var(--fg-muted)]">
                  {t('checkout.haveAccount')}{' '}
                  <Link
                    to="/login"
                    state={{ from: '/checkout' }}
                    className="font-medium text-[var(--brand-text)] underline-offset-2 hover:underline"
                  >
                    {t('checkout.signIn')}
                  </Link>
                </p>
                <div className="mt-4 grid gap-3">
                  <Input
                    label={t('ui.email')}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3 transition has-[:checked]:border-[var(--brand)]">
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
                        minLength={6}
                      />
                      <Input
                        label={t('checkout.confirmPassword')}
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className={cn(surfaceCard, 'p-4 sm:p-6')}>
              <SectionTitle n={step(2)} icon="truck" title={t('checkout.shippingTitle')} />
              <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('checkout.shippingBody')}</p>
              {isAuth && user?.addresses?.length ? (
                <label className="mt-4 flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">{t('account.addresses')}</span>
                  <select
                    value={selectedAddressId}
                    onChange={(e) => {
                      const id = e.target.value
                      setSelectedAddressId(id)
                      const selected = user.addresses.find((item) => item._id === id)
                      setAddress(
                        selected
                          ? {
                              ...emptyAddress,
                              ...selected,
                              country: selected.country || 'MA',
                              postalCode: selected.postalCode || '00000',
                            }
                          : emptyAddress
                      )
                    }}
                    className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3.5 text-[var(--fg)] outline-none ring-brand"
                  >
                    <option value="">{t('account.addAddress')}</option>
                    {user.addresses.map((saved) => (
                      <option key={saved._id} value={saved._id}>
                        {saved.label} — {saved.line1}, {saved.city}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input
                  label={t('checkout.fullName')}
                  autoComplete="name"
                  value={address.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  required
                />
                <Input
                  label={t('ui.phone')}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  value={address.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  required
                />
                <div className="sm:col-span-2">
                  <Input
                    label={t('checkout.address')}
                    autoComplete="street-address"
                    value={address.line1}
                    onChange={(e) => set('line1', e.target.value)}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    label={t('checkout.city')}
                    autoComplete="address-level2"
                    value={address.city}
                    onChange={(e) => set('city', e.target.value)}
                    list={cityRateOptions.length ? 'checkout-city-rates' : undefined}
                    required
                  />
                </div>
                {cityRateOptions.length ? (
                  <datalist id="checkout-city-rates">
                    {cityRateOptions.map((row) => (
                      <option key={row.city} value={row.city} />
                    ))}
                  </datalist>
                ) : null}
                {address.city.trim() ? (
                  <p className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)] sm:col-span-2">
                    <SiteIcon name="truck" size={13} className="text-[var(--brand-text)]" />
                    {qualifiesFreeShipping || shipping === 0
                      ? t('cart.freeShippingUnlocked')
                      : t('checkout.shippingForCity', { amount: formatCurrency(shipping) })}
                  </p>
                ) : null}
              </div>
            </section>

            <section className={cn(surfaceCard, 'p-4 sm:p-6')}>
              <SectionTitle n={step(3)} icon="banknote" title={t('checkout.paymentTitle')} />
              <div className="mt-4 flex items-start gap-3 rounded-xl border-2 border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_6%,transparent)] p-3 sm:p-4">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brand-fg)]">
                  <SiteIcon name="check" size={12} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{t('checkout.heroKicker')}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--fg-muted)] sm:text-sm">
                    {t('checkout.paymentBody')}
                  </span>
                </span>
                <SiteIcon name="banknote" size={22} className="ms-auto shrink-0 text-[var(--brand-text)]" />
              </div>
              <HelpLink guide="pay" label={t('help.ctxPay')} className="mt-3" />
            </section>

            <section className={cn(surfaceCard, 'p-4 sm:p-6')}>
              <SectionTitle n={step(4)} icon="ticket" title={t('checkout.couponTitle')} optional={t('checkout.optional')} />
              <div className="mt-4 flex gap-2">
                <Input
                  value={couponCode}
                  onChange={(e) => {
                    const next = e.target.value.toUpperCase()
                    setCouponCode(next)
                    // A different code than the applied one: no discount until it is applied
                    if (appliedCoupon && next.trim() !== appliedCoupon) {
                      setAppliedCoupon('')
                      setDiscount(0)
                    }
                  }}
                  placeholder={t('checkout.couponCode')}
                  aria-label={t('checkout.couponCode')}
                  className="uppercase placeholder:normal-case"
                />
                <Button
                  type="button"
                  variant="outline"
                  loading={validating}
                  onClick={() => void validateCoupon()}
                  className="h-11 shrink-0 rounded-xl px-4"
                >
                  {t('checkout.apply')}
                </Button>
              </div>
              {appliedCoupon && discount > 0 ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--success)]">
                  <SiteIcon name="check" size={12} />
                  {t('checkout.couponApplied')}: {appliedCoupon} (-{formatCurrency(discount)})
                </p>
              ) : null}
              <div className="mt-4">
                <Textarea
                  label={t('checkout.orderNote')}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('checkout.notePlaceholder')}
                  rows={2}
                />
              </div>
            </section>

            {formError ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              >
                <SiteIcon name="alert" size={16} className="mt-0.5 shrink-0" />
                {formError}
              </p>
            ) : null}

            {/* Phones: totals before the sticky Place order bar */}
            <div className={cn(surfaceCard, 'space-y-4 p-4 lg:hidden')}>
              {wholesaleBadge}
              {totalsRows}
              {trust}
              <LegalConsent action="order" className="text-center" />
            </div>
          </div>

          <aside
            className={cn(
              surfaceCard,
              'hidden h-fit p-6 lg:sticky lg:top-[calc(var(--nav-height)+0.75rem)] lg:block'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">{t('checkout.orderSummary')}</h2>
              <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
                {t('cart.itemsInCart', { count: itemCount })}
              </span>
            </div>
            {wholesaleBadge ? <div className="mt-2">{wholesaleBadge}</div> : null}
            <div className="mt-5 max-h-[18rem] overflow-y-auto pe-1 pt-1.5 [scrollbar-width:thin]">{summaryItems}</div>
            <div className="mt-5 border-t border-[var(--border)] pt-4">{totalsRows}</div>
            <Button type="submit" className="mt-5 h-12 w-full rounded-full text-base" loading={busy} disabled={settings.isLoading || currentProducts.isLoading}>
              {t('checkout.placeOrder')}
              <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
            </Button>
            <div className="mt-4">{trust}</div>
            <LegalConsent action="order" className="mt-3 text-center" />
          </aside>
        </form>
      </Container>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.12)] lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-[var(--fg-muted)]">{t('checkout.totalCod')}</p>
            <p className="font-display text-lg font-semibold tabular-nums">{formatCurrency(total)}</p>
            {deposit > 0 ? (
              <p className="text-[11px] text-[var(--fg-muted)]">
                {t('deposit.payNow')}: {formatCurrency(deposit)}
              </p>
            ) : null}
          </div>
          <Button
            type="submit"
            form="checkout-form"
            className="h-12 flex-1 rounded-full text-sm sm:text-base"
            loading={busy}
            disabled={settings.isLoading || currentProducts.isLoading}
          >
            {t('checkout.placeOrder')}
          </Button>
        </div>
      </div>
    </>
  )
}

function SectionTitle({ n, icon, title, optional }: { n: number; icon: SiteIconName; title: string; optional?: string }) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-base font-semibold sm:text-lg">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-xs font-bold text-[var(--brand-text)]">
        {n}
      </span>
      {title}
      {optional ? <span className="text-xs font-normal text-[var(--fg-muted)]">{optional}</span> : null}
      <SiteIcon name={icon} size={16} className="ms-auto text-[var(--fg-muted)]" />
    </h2>
  )
}
