export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok'

/** One account on Admin → Social media: the last numbers typed by staff */
export type PlatformStats = {
  platform: SocialPlatform
  followers?: number
  posts?: number
  /** The day of those numbers */
  typedOn?: string
}

export type SocialSnapshotRow = { platform: SocialPlatform; day: string; followers: number; posts?: number; manual?: boolean }

export type SocialOverview = {
  platforms: PlatformStats[]
  /** Followers per day (last 90 days), for the chart */
  growth: SocialSnapshotRow[]
  /** Numbers typed by staff, newest first */
  typed: SocialSnapshotRow[]
}
