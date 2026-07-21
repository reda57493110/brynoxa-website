import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { ordersApi } from '@/api/ordersApi'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/format'

export function OrderConfirmation() {
  const { orderNumber = '' } = useParams()
  const order = useQuery({
    queryKey: ['order', orderNumber],
    queryFn: async () => (await ordersApi.getByNumber(orderNumber)).data.data,
    enabled: Boolean(orderNumber),
  })

  if (order.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <Container className="py-16 text-center">
      <CheckCircle2 className="mx-auto h-14 w-14 text-[var(--success)]" />
      <h1 className="mt-4 font-display text-3xl font-semibold">Order confirmed</h1>
      <p className="mx-auto mt-2 max-w-md text-[var(--fg-muted)]">
        Thank you. Pay cash on delivery when your package arrives.
        {order.data && (
          <>
            {' '}
            Order <strong>#{order.data.orderNumber}</strong> ·{' '}
            {formatCurrency(order.data.pricing.total)}
          </>
        )}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to={`/account/orders/${orderNumber}`}>
          <Button>Track order</Button>
        </Link>
        <Link to="/shop">
          <Button variant="outline">Continue shopping</Button>
        </Link>
      </div>
    </Container>
  )
}
