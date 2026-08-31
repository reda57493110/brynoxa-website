import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SiteIcon } from './SiteIcon'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { useT } from '@/hooks/useT'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  side?: 'left' | 'right'
  className?: string
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'right',
  className,
}: DrawerProps) {
  const t = useT()
  const panelRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      )
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
      if (e.key !== 'Tab' || !panel) return
      const elements = focusable()
      if (!elements.length) {
        e.preventDefault()
        panel.focus()
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
      const close = panel?.querySelector<HTMLElement>('[data-dialog-close]')
      ;(close || focusable()[0] || panel)?.focus()
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
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label={t('ui.closeDrawer')}
        className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
        tabIndex={-1}
        className={cn(
          'absolute top-0 flex h-full w-full max-w-sm flex-col border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft-lg',
          side === 'right' ? 'end-0 border-s' : 'start-0 border-e',
          className
        )}
      >
        {title ? (
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4">
            <h3 id="drawer-title" className="font-display text-lg font-semibold">{title}</h3>
            <Button data-dialog-close variant="ghost" size="sm" onClick={onClose} aria-label={t('ui.close')}>
              <SiteIcon name="close" size={16} />
            </Button>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">{children}</div>
      </aside>
    </div>,
    document.body
  )
}
