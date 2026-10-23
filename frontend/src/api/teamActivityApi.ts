import api from './client'
import type { ApiResponse } from '@/types'

/** One staff member's figures for the chosen period (Admin → Roles). */
export interface TeamMemberActivity {
  _id: string
  name: string
  email: string
  role: string
  isActive: boolean
  lastActive: string | null
  signIns: number
  /** Changes outside orders: products, stock, coupons, settings… */
  changes: number
  orderSteps: number
  confirmed: number
  shipped: number
  delivered: number
  cancelled: number
  calls: number
  ordersAdded: number
}

export interface StaffActivityDetail {
  days: number
  member: { _id: string; name: string; email: string; role: string; isActive: boolean; since: string }
  summary: TeamMemberActivity & { activeDays: number }
  /** Orders they confirmed or added in the period, by where they are now */
  handled: { total: number; done: number; open: number; returned: number; cancelled: number; finishedRate: number | null }
  unfinished: { _id: string; orderNumber: string; status: string; statusLabel: string; customer: string; total: number; since: string; stuck: boolean }[]
  feed: { at: string; action: string; kind: string; link?: string; detail?: string }[]
}

export const ACTIVITY_PERIODS = [7, 30, 90, 365] as const

export const teamActivityApi = {
  team: (days: number) => api.get<ApiResponse<{ days: number; staff: TeamMemberActivity[] }>>('/admin/team-activity', { params: { days } }),
  member: (id: string, days: number) => api.get<ApiResponse<StaffActivityDetail>>(`/admin/team-activity/${id}`, { params: { days } }),
}

/** "5 min ago", "3 h ago", "2 days ago", or the date. */
export function timeAgo(value: string | null | undefined) {
  if (!value) return 'Never'
  const ms = Date.now() - new Date(value).getTime()
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`
  return new Date(value).toLocaleDateString('fr-MA')
}
