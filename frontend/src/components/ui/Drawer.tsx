import { useEffect, type ReactNode } from 'react'
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
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

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
        className={cn(
          'absolute top-0 flex h-full w-full max-w-sm flex-col border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft-lg',
          side === 'right' ? 'end-0 border-s' : 'start-0 border-e',
          className
        )}
      >
        {title ? (
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4">
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('ui.close')}>
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
