import { Button } from './Button'
import { Modal } from './Modal'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  onClose,
  onConfirm,
  loading = false,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="danger" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
