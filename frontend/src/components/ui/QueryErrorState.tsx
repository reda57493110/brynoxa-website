import { EmptyState } from './EmptyState'
import { useT } from '@/hooks/useT'

export function QueryErrorState({
  title = 'Could not load this content',
  description = 'Check your connection and try again.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry: () => void
}) {
  const t = useT()
  return (
    <EmptyState
      icon="alert"
      title={title ?? 'Could not load this content'}
      description={description}
      actionLabel={t('common.retry')}
      onAction={onRetry}
    />
  )
}
