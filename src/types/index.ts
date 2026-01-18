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
}

export interface SessionState {
  isActive: boolean
  expiresAt: number | null
  transactionSignature: string | null
}

export interface PaymentConfig {
  priceInSol: number
  sessionDurationMinutes: number
  treasuryWallet: string
}

export type AvatarMood = 'neutral' | 'happy' | 'thinking' | 'flirty' | 'speaking'

// avatar states matching the mp4 assets
export type AvatarState = 'speaking' | 'thinking' | 'listening'
