import { Badge } from '@/components/ui/Badge'
import type { CustomerReturn } from '@/types'

export function ReturnStatusBadge({ status }: { status: CustomerReturn['status'] }) {
  return status === 'assessed' ? <Badge variant="success">Assessed</Badge> : <Badge variant="warning">Awaiting assessment</Badge>
}
