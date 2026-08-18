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
import type { Address } from '@/types'

const emptyAddress: Omit<Address, '_id'> = {
  label: 'Home',
  fullName: '',
  line1: '',
  city: '',
  phone: '',
  country: 'MA',
  postalCode: '00000',
  isDefault: true,
}

export function AccountSettings() {
  usePageTitle('Settings — Brynoxa')
  const qc = useQueryClient()
  const setAuth = useAuthStore((s) => s.setAuth)
  const accessToken = useAuthStore((s) => s.accessToken)
  const toast = useToastStore((s) => s.push)

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
      toast('Profile updated', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const addAddress = useMutation({
    mutationFn: () => authApi.addAddress(address),
    onSuccess: (res) => {
      if (accessToken) setAuth(res.data.data, accessToken)
      qc.invalidateQueries({ queryKey: ['me'] })
      setAddress(emptyAddress)
      toast('Address added', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const removeAddress = useMutation({
    mutationFn: (id: string) => authApi.deleteAddress(id),
    onSuccess: (res) => {
      if (accessToken) setAuth(res.data.data, accessToken)
      qc.invalidateQueries({ queryKey: ['me'] })
      toast('Address removed', 'success')
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

  return (
    <>
      <PageHero
        kicker="Account"
        title="Settings"
        description="Profile and Morocco delivery addresses for cash on delivery."
      >
        <Link to="/account" className="text-sm font-medium text-[var(--brand-text)] hover:underline">
          Back to account
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
        <h2 className="font-display text-lg font-semibold">Profile</h2>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Email" value={me.data?.email || ''} disabled />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Button type="submit" className="rounded-full" loading={saveProfile.isPending}>
          Save profile
        </Button>
      </form>

      <div className="mt-8 max-w-2xl">
        <h2 className="font-display text-lg font-semibold">Addresses</h2>
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
                    <span className="text-[var(--brand-text)]">(default)</span>
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
                  Remove
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
          <h3 className="font-display font-semibold sm:col-span-2">Add address</h3>
          {(
            [
              ['label', 'Label'],
              ['fullName', 'Full name'],
              ['line1', 'Address'],
              ['city', 'City'],
              ['phone', 'Phone'],
            ] as const
          ).map(([key, label]) => (
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
              Add address
            </Button>
          </div>
        </form>
      </div>
      </Container>
    </>
  )
}
