import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/authApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'
import type { Address } from '@/types'

export function AccountSettings() {
  const t = useT()
  usePageTitle(t('account.settingsTitle'))
  const qc = useQueryClient()
  const setAuth = useAuthStore((s) => s.setAuth)
  const accessToken = useAuthStore((s) => s.accessToken)
  const toast = useToastStore((s) => s.push)

  const emptyAddress: Omit<Address, '_id'> = {
    label: t('account.homeLabel'),
    fullName: '',
    line1: '',
    city: '',
    phone: '',
    country: 'MA',
    postalCode: '00000',
    isDefault: true,
  }

  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await authApi.me()).data.data,
  })

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState(emptyAddress)

  useEffect(() => {
    if (me.data) {
      setName(me.data.name)
      setPhone(me.data.phone || '')
    }
  }, [me.data])

  const saveProfile = useMutation({
    mutationFn: () => authApi.updateProfile({ name, phone }),
    onSuccess: (res) => {
      if (accessToken) setAuth(res.data.data, accessToken)
      qc.invalidateQueries({ queryKey: ['me'] })
      toast(t('account.profileUpdated'), 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const addAddress = useMutation({
    mutationFn: () => authApi.addAddress(address),
    onSuccess: (res) => {
      if (accessToken) setAuth(res.data.data, accessToken)
      qc.invalidateQueries({ queryKey: ['me'] })
      setAddress(emptyAddress)
      toast(t('account.addressAdded'), 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const removeAddress = useMutation({
    mutationFn: (id: string) => authApi.deleteAddress(id),
    onSuccess: (res) => {
      if (accessToken) setAuth(res.data.data, accessToken)
      qc.invalidateQueries({ queryKey: ['me'] })
      toast(t('account.addressRemoved'), 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  if (me.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  const addressFields = [
    ['label', t('account.label')],
    ['fullName', t('checkout.fullName')],
    ['line1', t('checkout.address')],
    ['city', t('checkout.city')],
    ['phone', t('ui.phone')],
  ] as const

  return (
    <>
      <PageHero
        kicker={t('account.kicker')}
        title={t('account.settingsHeading')}
        description={t('account.settingsBody')}
      >
        <Link to="/account" className="text-sm font-medium text-[var(--brand-text)] hover:underline">
          {t('orders.backToAccount')}
        </Link>
      </PageHero>
      <Container className="py-8 sm:py-10">
      <form
        className={`${surfaceCard} max-w-lg space-y-4 p-6`}
        onSubmit={(e) => {
          e.preventDefault()
          saveProfile.mutate()
        }}
      >
        <h2 className="font-display text-lg font-semibold">{t('account.profile')}</h2>
        <Input label={t('ui.name')} value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label={t('ui.email')} value={me.data?.email || ''} disabled />
        <Input label={t('ui.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Button type="submit" className="rounded-full" loading={saveProfile.isPending}>
          {t('account.saveProfile')}
        </Button>
      </form>

      <div className="mt-8 max-w-2xl">
        <h2 className="font-display text-lg font-semibold">{t('account.addresses')}</h2>
        <div className="mt-3 space-y-3">
          {me.data?.addresses?.map((a) => (
            <div
              key={a._id}
              className={`${surfaceCard} flex items-start justify-between gap-4 p-4 text-sm`}
            >
              <div>
                <p className="font-medium">
                  {a.label}{' '}
                  {a.isDefault ? (
                    <span className="text-[var(--brand-text)]">({t('account.default')})</span>
                  ) : null}
                </p>
                <p className="text-[var(--fg-muted)]">
                  {a.fullName} · {a.line1}, {a.city}
                </p>
              </div>
              {a._id ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => removeAddress.mutate(a._id!)}
                  loading={removeAddress.isPending}
                >
                  {t('ui.remove')}
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <form
          className={`${surfaceCard} mt-6 grid gap-3 p-6 sm:grid-cols-2`}
          onSubmit={(e) => {
            e.preventDefault()
            addAddress.mutate()
          }}
        >
          <h3 className="font-display font-semibold sm:col-span-2">{t('account.addAddress')}</h3>
          {addressFields.map(([key, label]) => (
            <Input
              key={key}
              label={label}
              value={address[key] || ''}
              onChange={(e) => setAddress((prev) => ({ ...prev, [key]: e.target.value }))}
              required
            />
          ))}
          <div className="sm:col-span-2">
            <Button type="submit" className="rounded-full" loading={addAddress.isPending}>
              {t('account.addAddress')}
            </Button>
          </div>
        </form>
      </div>
      </Container>
    </>
  )
}
