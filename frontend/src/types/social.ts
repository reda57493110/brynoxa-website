export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok'

export type SocialPost = {
  id: string
  text: string
  image?: string
  link?: string
  at: string
  likes: number
  comments: number
  shares?: number
  views?: number
}

export type PlatformStats = {
  platform: SocialPlatform
  connected: boolean
  name?: string
  username?: string
  picture?: string
  link?: string
  followers?: number
  following?: number
  posts?: number
  likes?: number
  reach28?: number
  recent: SocialPost[]
  error?: string
}

export type SocialOverview = {
  setup: {
    meta: { configured: boolean; configId: boolean; callbackUrl: string; graphVersion: string; scopes: string[] }
    tiktok: { configured: boolean; callbackUrl: string }
  }
  platforms: PlatformStats[]
  growth: { platform: SocialPlatform; day: string; followers: number }[]
}

export type SocialConversation = {
  id: string
  name: string
  customerId: string
  updatedAt: string
  unread: number
  last: string
  lastFromShop: boolean
}

export type SocialMessage = { id: string; text: string; at: string; fromShop: boolean; from: string }
