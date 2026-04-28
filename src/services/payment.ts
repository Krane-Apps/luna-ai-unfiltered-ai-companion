// solana payment service using mobile wallet adapter

import 'react-native-get-random-values'
import { Buffer } from 'buffer'
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js'
import {
  transact,
  Web3MobileWallet
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { PAYMENT_CONFIG, SOLANA_RPC_URL, SOLANA_CLUSTER } from '../constants/config'
import { SessionState } from '../types'
import { isNetworkError, showNetworkError } from './api'

const SESSION_STORAGE_KEY = 'luna_session'

// decode base64 address to PublicKey (phantom returns base64 encoded addresses)
const decodeAddress = (address: string): PublicKey => {
  // check if address is base64 encoded (contains = or + or /)
  if (address.includes('=') || address.includes('+') || address.includes('/')) {
    // base64 encoded - decode to bytes then create PublicKey
    const bytes = Uint8Array.from(atob(address), c => c.charCodeAt(0))
    return new PublicKey(bytes)
  }
  // assume it's already base58
  return new PublicKey(address)
}

const APP_IDENTITY = {
  name: 'Luna AI',
  uri: 'https://luna-ai.app',
  icon: 'favicon.ico'
}

// session state - will be loaded from storage on init
let currentSession: SessionState = {
  isActive: false,
  expiresAt: null,
  transactionSignature: null
}

let isSessionLoaded = false

export const getConnection = (): Connection => {
  return new Connection(SOLANA_RPC_URL, 'confirmed')
}

// lifetime payment - same flow but different amount
export const initiateLifetimePayment = async (): Promise<{ success: boolean; signature?: string; walletAddress?: string; error?: string }> => {
  console.log('=== LIFETIME PAYMENT INITIATED ===')
  console.log('Lifetime Price in SOL:', PAYMENT_CONFIG.lifetimePriceSOL)
  console.log('Lifetime Price in Lamports:', Math.floor(PAYMENT_CONFIG.lifetimePriceSOL * LAMPORTS_PER_SOL))

  let walletAddress: string | undefined

  try {
    const result = await transact(async (wallet: Web3MobileWallet) => {
      const authResult = await wallet.authorize({
        cluster: SOLANA_CLUSTER,
        identity: APP_IDENTITY
      })

      if (!authResult.accounts || authResult.accounts.length === 0) {
        throw new Error('No accounts returned from wallet authorization')
      }

      const userAddress = authResult.accounts[0].address
      const publicKey = decodeAddress(userAddress)
      console.log('User PublicKey:', publicKey.toBase58())

      // store wallet address for return
      walletAddress = publicKey.toBase58()

      const connection = getConnection()
      const balance = await connection.getBalance(publicKey)
      console.log('User balance (SOL):', balance / LAMPORTS_PER_SOL)

      const lamports = Math.floor(PAYMENT_CONFIG.lifetimePriceSOL * LAMPORTS_PER_SOL)

      if (balance < lamports) {
        throw new Error(`Insufficient balance. Have ${balance / LAMPORTS_PER_SOL} SOL, need ${PAYMENT_CONFIG.lifetimePriceSOL} SOL`)
      }

      const treasuryPubkey = new PublicKey(PAYMENT_CONFIG.treasuryWallet)
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasuryPubkey,
          lamports
        })
      )

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      const signedTxs = await wallet.signTransactions({
        transactions: [transaction]
      })

      if (!signedTxs || signedTxs.length === 0) {
        throw new Error('No signed transaction returned from wallet')
      }

      return { signedTransaction: signedTxs[0], blockhash, lastValidBlockHeight }
    })

    // send transaction with retry
    await new Promise(resolve => setTimeout(resolve, 1000))

    const connection = getConnection()
    const rawTransaction = result.signedTransaction.serialize()

    let signature: string | null = null
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        signature = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: true,
          maxRetries: 2
        })
        console.log('Lifetime transaction sent:', signature)
        break
      } catch (err: unknown) {
        lastError = err as Error
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    if (!signature) {
      throw lastError || new Error('Failed to send transaction after 3 attempts')
    }

    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash: result.blockhash,
        lastValidBlockHeight: result.lastValidBlockHeight
      },
      'confirmed'
    )

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`)
    }

    console.log('Lifetime payment confirmed!')
    // note: caller should grant lifetime access via profile service
    return { success: true, signature, walletAddress }
  } catch (error: unknown) {
    console.log('=== LIFETIME PAYMENT ERROR ===', error)
    if (isNetworkError(error)) {
      showNetworkError()
    }
    const errorMessage = error instanceof Error ? error.message : 'Payment failed'
    return { success: false, error: isNetworkError(error) ? 'No internet connection. Please check your connection and try again.' : errorMessage }
  }
}

// save session to async storage
const saveSessionToStorage = async (session: SessionState): Promise<void> => {
  try {
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch (error) {
    console.error('Failed to save session to storage:', error)
  }
}

// load session from async storage
export const loadSessionFromStorage = async (): Promise<void> => {
  if (isSessionLoaded) return

  try {
    const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) {
      const session = JSON.parse(stored) as SessionState
      // check if session is still valid
      if (session.isActive && session.expiresAt && Date.now() < session.expiresAt) {
        currentSession = session
        console.log('Session restored from storage, expires at:', new Date(session.expiresAt))
      } else {
        // clear expired session
        await AsyncStorage.removeItem(SESSION_STORAGE_KEY)
        console.log('Stored session expired, cleared')
      }
    }
  } catch (error) {
    console.error('Failed to load session from storage:', error)
  }

  isSessionLoaded = true
}

export const getSessionState = (): SessionState => {
  // check if session has expired
  if (currentSession.isActive && currentSession.expiresAt) {
    if (Date.now() > currentSession.expiresAt) {
      currentSession = {
        isActive: false,
        expiresAt: null,
        transactionSignature: null
      }
      // clear storage async (don't await)
      AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => {})
    }
  }
  return { ...currentSession }
}

export const getTimeRemaining = (): number => {
  const session = getSessionState()
  if (!session.isActive || !session.expiresAt) return 0
  return Math.max(0, session.expiresAt - Date.now())
}

export const formatTimeRemaining = (): string => {
  const ms = getTimeRemaining()
  if (ms <= 0) return '0:00'

  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export const endSession = async (): Promise<void> => {
  currentSession = {
    isActive: false,
    expiresAt: null,
    transactionSignature: null
  }

  try {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear session from storage:', error)
  }
}

// connect wallet without making payment (for restore subscription flow)
export const connectWallet = async (): Promise<{ success: boolean; walletAddress?: string; error?: string }> => {
  console.log('=== WALLET CONNECT ===')

  try {
    const walletAddress = await transact(async (wallet: Web3MobileWallet) => {
      const authResult = await wallet.authorize({
        cluster: SOLANA_CLUSTER,
        identity: APP_IDENTITY
      })

      if (!authResult.accounts || authResult.accounts.length === 0) {
        throw new Error('No accounts returned from wallet authorization')
      }

      const userAddress = authResult.accounts[0].address
      const publicKey = decodeAddress(userAddress)
      console.log('Connected wallet:', publicKey.toBase58())

      return publicKey.toBase58()
    })

    return { success: true, walletAddress }
  } catch (error: unknown) {
    console.log('=== WALLET CONNECT ERROR ===', error)
    if (isNetworkError(error)) {
      showNetworkError()
    }
    const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet'
    return { success: false, error: isNetworkError(error) ? 'No internet connection. Please check your connection and try again.' : errorMessage }
  }
}
