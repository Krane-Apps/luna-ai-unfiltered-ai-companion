// configuration constants for luna ai

import { HF_TOKEN as ENV_HF_TOKEN, TREASURY_WALLET as ENV_TREASURY_WALLET, BACKEND_URL as ENV_BACKEND_URL } from '@env'
import { PaymentConfig } from '../types'

// fallback treasury wallet
const DEFAULT_TREASURY_WALLET = '4S93Yqn6yU15NYJZfC1ihAVvdnsxoRMD7X3Z4Dx59soU'

// validate base58 characters
const isValidBase58 = (str: string | undefined): boolean => {
  if (!str || typeof str !== 'string') return false
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/
  return base58Regex.test(str.trim())
}

// get valid treasury wallet
const getTreasuryWallet = (): string => {
  const wallet = ENV_TREASURY_WALLET?.trim()
  if (wallet && isValidBase58(wallet)) {
    return wallet
  }
  console.warn('Invalid or missing TREASURY_WALLET, using default')
  return DEFAULT_TREASURY_WALLET
}

// api keys from environment variables
export const HF_TOKEN = ENV_HF_TOKEN || ''

// tts model
export const TTS_MODEL = 'hexgrad/Kokoro-82M'

// dev mode - shows bypass button and uses minimal payment amounts for testing
// set to true for testing, false for production release
export const DEV_MODE = false // <-- change to false before publishing to store

// payment configuration - 2-tier pricing (30 min + lifetime)
// lifetime is 50% off for limited time (original 1 SOL -> 0.5 SOL)
// uses minimal amounts in dev mode for testing
export const ORIGINAL_LIFETIME_PRICE_SOL = DEV_MODE ? 0.006 : 2.5  // original price before discount
export const PAYMENT_CONFIG: PaymentConfig = {
  singleChatPriceSOL: DEV_MODE ? 0.001 : 0.15,    // ~$15, 30 min session (0.001 in dev)
  lifetimePriceSOL: DEV_MODE ? 0.003 : 1.0,       // 60% OFF! was 2.5 SOL (0.003 in dev)
  sessionDurationMinutes: 30,   // for single chat
  treasuryWallet: getTreasuryWallet()
}

// solana network
export const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com'
export const SOLANA_CLUSTER = 'mainnet-beta'

// grace period when transaction fails (in minutes)
export const GRACE_PERIOD_MINUTES = 15

// backend api url
// set in .env file, defaults to localhost for development
export const BACKEND_URL = ENV_BACKEND_URL || 'http://localhost:3000'

// telegram support link
export const TELEGRAM_SUPPORT_URL = 'https://t.me/lunaaiseeker'
