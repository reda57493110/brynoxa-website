import { Badge } from '@/components/ui/Badge'

export function StockBadge({ stock, threshold = 5 }: { stock: number; threshold?: number }) {
  if (stock <= 0) return <Badge variant="danger">Out of stock</Badge>
  if (stock <= threshold) return <Badge variant="warning">Only {stock} left</Badge>
  return <Badge variant="success">In stock</Badge>
}
