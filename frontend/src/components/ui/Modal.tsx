import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SiteIcon } from './SiteIcon'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { useT } from '@/hooks/useT'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
  presentation?: 'dialog' | 'sheet'
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  size = 'md',
  presentation = 'dialog',
}: ModalProps) {
  const t = useT()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      )
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
      if (e.key !== 'Tab' || !dialog) return
      const elements = focusable()
      if (!elements.length) {
        e.preventDefault()
        dialog.focus()
        return
      }
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    const frame = requestAnimationFrame(() => {
      const close = dialog?.querySelector<HTMLElement>('[data-dialog-close]')
      ;(close || focusable()[0] || dialog)?.focus()
    })
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previouslyFocused?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[80] flex justify-center',
        presentation === 'sheet'
          ? 'items-end p-0 sm:items-center sm:p-4'
          : 'items-center p-3 sm:p-4'
      )}
    >
      <button
        type="button"
        aria-label={t('ui.closeModal')}
        className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex w-full flex-col border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft-lg',
          presentation === 'sheet'
            ? 'max-h-[min(88dvh,36rem)] rounded-t-[1.25rem] rounded-b-none sm:max-h-[min(85vh,40rem)] sm:rounded-2xl'
            : 'max-h-[min(90dvh,40rem)] rounded-2xl',
          sizes[size],
          className
        )}
      >
        {presentation === 'sheet' ? (
          <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-[var(--border)]" />
          </div>
        ) : null}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-2.5 sm:px-5 sm:py-3.5">
          <h3 id="modal-title" className="font-display text-base font-semibold sm:text-lg">{title}</h3>
          <Button data-dialog-close variant="ghost" size="sm" onClick={onClose} aria-label={t('ui.close')}>
            <SiteIcon name="close" size={16} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}
