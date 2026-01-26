// configuration constants for luna ai

import { HF_TOKEN as ENV_HF_TOKEN, TREASURY_WALLET as ENV_TREASURY_WALLET } from '@env'
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

// payment configuration
export const PAYMENT_CONFIG: PaymentConfig = {
  sessionPriceSOL: 0.01, // cost per session
  sessionDurationMinutes: 30, // session length after payment
  lifetimePriceSOL: 0.5, // one-time lifetime access
  treasuryWallet: getTreasuryWallet()
}

// solana network
export const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com'
export const SOLANA_CLUSTER = 'mainnet-beta'

// grace period when transaction fails (in minutes)
export const GRACE_PERIOD_MINUTES = 15

// dev mode - shows bypass button on payment screen
// set to true for testing, false for production release
// this works in both debug AND release builds
export const DEV_MODE = false // <-- change to false before publishing to store
