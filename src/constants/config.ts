// configuration constants for luna ai

import {
  HF_TOKEN as ENV_HF_TOKEN,
  TREASURY_WALLET as ENV_TREASURY_WALLET,
  BACKEND_URL as ENV_BACKEND_URL,
  OPENAI_API_KEY as ENV_OPENAI_API_KEY,
} from '@env'
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
export const OPENAI_API_KEY = ENV_OPENAI_API_KEY || ''

// dev mode - shows bypass button and uses minimal payment amounts for testing
// set to true for testing, false for production release
export const DEV_MODE = true // <-- change to false before publishing to store

// payment configuration - lifetime access only
// limited-time 50% off: original 0.5 SOL -> 0.25 SOL
export const ORIGINAL_LIFETIME_PRICE_SOL = DEV_MODE ? 0.006 : 0.5  // original price before discount
export const PAYMENT_CONFIG: PaymentConfig = {
  lifetimePriceSOL: DEV_MODE ? 0.003 : 0.25,
  treasuryWallet: getTreasuryWallet()
}

// solana network
export const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com'
export const SOLANA_CLUSTER = 'mainnet-beta'

// backend api url
// set in .env file, defaults to localhost for development
export const BACKEND_URL = ENV_BACKEND_URL || 'http://localhost:3000'

// telegram support link
export const TELEGRAM_SUPPORT_URL = 'https://t.me/lunaaiseeker'
