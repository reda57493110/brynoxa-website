import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { QuantityStepper } from '@/components/product/QuantityStepper'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/format'

export function Cart() {
  const items = useCartStore((s) => s.items)
  const updateQty = useCartStore((s) => s.updateQty)
  const removeItem = useCartStore((s) => s.removeItem)
  const subtotal = useCartStore((s) => s.subtotal())

  if (!items.length) {
    return (
      <Container className="py-16">
        <EmptyState
          title="Your cart is empty"
          description="Browse the shop and add something you love."
          actionLabel="Shop now"
          onAction={() => {
            window.location.href = '/shop'
          }}
        />
      </Container>
    )
  }

  return (
    <Container className="py-10">
      <h1 className="font-display text-3xl font-semibold">Cart</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:flex-row sm:items-center"
            >
              <Link to={`/product/${item.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-muted)]">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                ) : null}
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/product/${item.slug}`} className="font-semibold hover:text-[var(--brand)]">
                  {item.name}
                </Link>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">{formatCurrency(item.price)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <QuantityStepper
                    value={item.qty}
                    max={item.stock}
                    onChange={(qty) => updateQty(item.productId, qty)}
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeItem(item.productId)}>
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
              <p className="font-display font-semibold sm:text-right">
                {formatCurrency(item.price * item.qty)}
              </p>
            </div>
          ))}
        </div>

        <aside className="h-fit rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-soft">
          <h2 className="font-display text-lg font-semibold">Summary</h2>
          <div className="mt-4 flex justify-between text-sm">
            <span className="text-[var(--fg-muted)]">Subtotal</span>
            <span className="font-semibold">{formatCurrency(subtotal)}</span>
          </div>
          <p className="mt-2 text-xs text-[var(--fg-muted)]">Shipping & tax calculated at checkout.</p>
          <Link
            to="/checkout"
            className="mt-6 flex h-11 items-center justify-center rounded-xl bg-[var(--brand)] font-semibold text-[var(--brand-fg)]"
          >
            Checkout (COD)
          </Link>
          <Link to="/shop" className="mt-3 block text-center text-sm text-[var(--brand)]">
            Continue shopping
          </Link>
        </aside>
      </div>
    </Container>
  )
}
