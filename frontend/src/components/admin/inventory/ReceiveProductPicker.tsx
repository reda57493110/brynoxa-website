import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import type { Product } from '@/types'

/** Search box that lists matching products and returns the picked one. */
export function ReceiveProductPicker({
  onPick,
  error,
  label = 'Product',
}: {
  onPick: (p: Product) => void
  error?: string
  label?: string
}) {
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setQ(text.trim()), 300)
    return () => window.clearTimeout(t)
  }, [text])

  const results = useQuery({
    queryKey: ['admin-inventory', 'product-picker', q],
    queryFn: async () => (await adminApi.products.list({ q, limit: 8 })).data.data,
    enabled: q.length >= 2,
    staleTime: 30_000,
  })

  return (
    <div className="relative min-w-0">
      <Input
        label={label}
        type="search"
        placeholder="Search name or SKU"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        error={error}
        autoComplete="off"
      />
      {open && q.length >= 2 ? (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-lg">
          {results.isFetching && !results.data ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : results.data?.length ? (
            <ul>
              {results.data.map((p) => (
                <li key={p._id}>
                  <button
                    type="button"
                    className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-muted)]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onPick(p)
                      setText('')
                      setQ('')
                      setOpen(false)
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-[var(--fg-muted)]">
                        {p.sku} · {p.stock} in stock
                      </span>
                    </span>
                    {p.condition && p.condition !== 'new' ? <Badge variant="warning">{p.condition}</Badge> : null}
                    {p.serialTracking ? <Badge variant="brand">Serials</Badge> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-[var(--fg-muted)]">No products found.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
