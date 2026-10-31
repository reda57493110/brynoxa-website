import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Button } from '@/components/ui/Button'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ReturnRefundDialog } from '@/components/admin/ReturnRefundDialog'
import { hasPermission } from '@/lib/permissions'
import { canReturnAndRefund } from '@/lib/returnRefund'
import { useAuthStore } from '@/store/authStore'
import type { Order } from '@/types'

/**
 * "Return & refund" on a delivered order, for staff who handle orders. Pass the order when the
 * page has it (order page), or its id (customer profile): it is loaded when the button is used.
 */
export function ReturnRefundButton({
  order,
  orderId,
  size = 'sm',
  className,
}: {
  order?: Order
  orderId?: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const role = useAuthStore((s) => s.user?.role)
  const [open, setOpen] = useState(false)
  const id = order?._id ?? orderId ?? ''
  const loaded = useQuery({
    queryKey: ['admin-order', id],
    queryFn: async () => (await adminApi.orders.get(id)).data.data,
    enabled: open && !order && Boolean(id),
  })
  const full = order ?? loaded.data
  if (!hasPermission(role, 'orders:write')) return null
  // On the order page the button only shows when it applies; elsewhere it is checked once loaded
  if (order && !canReturnAndRefund(order)) return null

  return (
    <>
      <Button type="button" size={size} variant="outline" className={className} loading={open && !full} onClick={() => setOpen(true)}>
        <SiteIcon name="refresh" size={14} /> Return &amp; refund
      </Button>
      {full ? (
        canReturnAndRefund(full) ? (
          <ReturnRefundDialog order={full} open={open} onClose={() => setOpen(false)} />
        ) : open ? (
          <NothingLeft onClose={() => setOpen(false)} />
        ) : null
      ) : null}
    </>
  )
}

/** Loaded from the customer profile, the order turned out to be fully returned / refunded already. */
function NothingLeft({ onClose }: { onClose: () => void }) {
  return (
    <div role="alertdialog" className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-sm shadow-soft-lg">
      Nothing left to return or refund on this order.
      <div className="mt-3 text-end">
        <Button size="sm" variant="ghost" onClick={onClose}>
          OK
        </Button>
      </div>
    </div>
  )
}
