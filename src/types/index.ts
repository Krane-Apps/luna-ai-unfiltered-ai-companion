// type definitions for luna ai app

export interface Message {
  id: string
  text: string
  isBot: boolean
  audioUrl?: string
  timestamp: number
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  imageUri?: string // local uri for display
  imageBase64?: string // base64 encoded image for ai analysis
}

export interface SessionState {
  isActive: boolean
  expiresAt: number | null
  transactionSignature: string | null
}

export interface PaymentConfig {
  lifetimePriceSOL: number // lifetime access (only pricing tier)
  treasuryWallet: string
}

export interface UserProfile {
  userName: string
  userAge: number
  userIntent: string
  userInterests: string[]
  flirtLevel: number // 1-5
  relationshipStatus?: string
  preferredTime?: string
  boundaries?: string
  timezone: string // e.g., "America/New_York" for good morning/night messages
  twitterShareUrl?: string // if user shared on twitter for free lifetime
  hasCompletedOnboarding: boolean
  hasLifetimeAccess: boolean
  createdAt: number
}

export type AvatarMood = 'neutral' | 'happy' | 'thinking' | 'flirty' | 'speaking'

// avatar states matching the mp4 assets
export type AvatarState = 'speaking' | 'thinking' | 'listening'

// backend api types
export interface BackendUser {
  id: string
  device_token: string | null
  timezone: string
  profile: UserProfile | null
  wallet_address: string | null
  has_lifetime_access: boolean
  twitter_share_url: string | null
  created_at: string
  last_active: string
}

export interface BackendMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface RegisterUserRequest {
  timezone: string
  deviceToken?: string
  profile?: Partial<UserProfile>
  walletAddress?: string
}

export interface SyncMessagesResponse {
  messages: BackendMessage[]
  hasMore: boolean
}
