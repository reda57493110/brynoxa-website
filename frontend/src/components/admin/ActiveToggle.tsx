import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'

/**
 * Active / Inactive switch for a product. Only `isActive` is sent, so stock, price, images,
 * condition and every other detail stay exactly as they are.
 */
export function ActiveToggle({
  product,
  size = 'md',
}: {
  product: { _id: string; name: string; isActive: boolean }
  size?: 'sm' | 'md'
}) {
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const toggle = useMutation({
    mutationFn: () => adminApi.products.update(product._id, { isActive: !product.isActive }),
    onSuccess: () => {
      toast.success(product.isActive ? `${product.name} is now inactive` : `${product.name} is active again`)
      qc.invalidateQueries({ queryKey: ['admin-inventory'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['admin-product'] })
      setConfirm(false)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={product.isActive}
        aria-label={`${product.isActive ? 'Deactivate' : 'Activate'} ${product.name}`}
        disabled={toggle.isPending}
        onClick={(e) => {
          e.stopPropagation()
          // Deactivating hides it from the shop, so ask first; reactivating is immediate
          if (product.isActive) setConfirm(true)
          else toggle.mutate()
        }}
        className={cn(
          'inline-flex shrink-0 items-center gap-2 rounded-full border font-medium transition disabled:opacity-60',
          size === 'sm' ? 'h-7 px-2 text-xs' : 'h-9 px-3 text-sm',
          product.isActive
            ? 'border-[color-mix(in_srgb,var(--success)_40%,transparent)] text-[var(--success)] hover:bg-[color-mix(in_srgb,var(--success)_10%,transparent)]'
            : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--brand)] hover:text-[var(--brand-text)]'
        )}
      >
        <span
          className={cn(
            'relative inline-flex items-center rounded-full p-0.5 transition',
            size === 'sm' ? 'h-3.5 w-6' : 'h-4 w-7',
            product.isActive ? 'justify-end bg-[var(--success)]' : 'justify-start bg-[var(--border)]'
          )}
          aria-hidden
        >
          <span className={cn('rounded-full bg-white', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        </span>
        {product.isActive ? 'Active' : 'Inactive'}
      </button>
      <ConfirmDialog
        open={confirm}
        title={`Deactivate ${product.name}?`}
        description="It will be hidden from the shop. Stock, price, images and all other details are kept, and you can reactivate it any time."
        confirmLabel="Deactivate"
        loading={toggle.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() => toggle.mutate()}
      />
    </>
  )
}
