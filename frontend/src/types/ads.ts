import type { AdKind, AdPlatform } from '@/lib/adTracking'

/** 0 = since the start */
export type AdRange = 0 | 7 | 14 | 30 | 90 | 180 | 365

export type AdResults = {
  spent: number
  orders: number
  revenue: number
  /** null = no order yet */
  costPerOrder: number | null
  /** revenue for each 1 DH spent; null = nothing spent */
  roas: number | null
}

export type AdCampaign = {
  _id: string
  name: string
  code: string
  platform: AdPlatform
  kind: AdKind
  landingPath: string
  trackingQuery: string
  startDate: string
  endDate: string
  budget: number | null
  notes: string
  isActive: boolean
  createdAt: string
}

export type AdCampaignRow = AdCampaign & AdResults & { delivered: number; budgetLeft: number | null }

export type AdsOverview = {
  days: AdRange
  totals: AdResults & { campaigns: number; active: number }
  otherSpent: number
  otherLinks: AdResults
  platforms: (AdResults & { platform: AdPlatform; campaigns: number })[]
  campaigns: AdCampaignRow[]
}

export type AdCampaignDetail = {
  campaign: AdCampaign
  spends: { _id: string; amount: number; day: string; note: string }[]
  orders: { _id: string; orderNumber: string; total: number; status: string; counted: boolean; createdAt: string }[]
}

export type AdCampaignPayload = {
  name: string
  platform: AdPlatform
  kind: AdKind
  landingPath?: string
  startDate?: string
  endDate?: string
  budget?: number
  notes?: string
  isActive?: boolean
}
