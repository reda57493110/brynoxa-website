import { Badge } from '@/components/ui/Badge'
import { useT } from '@/hooks/useT'

export function StockBadge({ stock, threshold = 5 }: { stock: number; threshold?: number }) {
  const t = useT()
  if (stock <= 0) return <Badge variant="danger">{t('stock.outOfStock')}</Badge>
  if (stock <= threshold) return <Badge variant="warning">{t('stock.onlyLeft', { count: stock })}</Badge>
  return <Badge variant="success">{t('stock.inStock')}</Badge>
}
