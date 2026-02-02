// profile service for user personalization data

import AsyncStorage from '@react-native-async-storage/async-storage'
import { UserProfile } from '../types'
import {
  registerUser,
  syncProfile,
  grantBackendLifetimeAccess,
  getCurrentUserId,
  setCurrentUserId,
  updateDeviceToken
} from './api'
import { setFirebaseUserId, getFirebaseUserId, createOrUpdateUser, checkFirebaseLifetimeAccess, grantFirebaseLifetimeAccess } from './firebase'
import { registerForPushNotifications } from './notifications'

const PROFILE_STORAGE_KEY = 'luna_user_profile'
const WALLET_ADDRESS_STORAGE_KEY = 'luna_wallet_address'

let currentProfile: UserProfile | null = null

// get device timezone for good morning/night messages
export const getDeviceTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

// create empty profile template
export const createEmptyProfile = (): UserProfile => ({
  userName: '',
  userAge: 0,
  userIntent: '',
  userInterests: [],
  flirtLevel: 3,
  relationshipStatus: undefined,
  preferredTime: undefined,
  boundaries: undefined,
  timezone: getDeviceTimezone(),
  twitterShareUrl: undefined,
  hasCompletedOnboarding: false,
  hasLifetimeAccess: false,
  createdAt: Date.now()
})

// load profile from storage and restore wallet address as user id
export const loadUserProfile = async (): Promise<UserProfile | null> => {
  try {
    // restore wallet address if exists
    const savedWalletAddress = await AsyncStorage.getItem(WALLET_ADDRESS_STORAGE_KEY)
    if (savedWalletAddress) {
      setCurrentUserId(savedWalletAddress)
      setFirebaseUserId(savedWalletAddress)
      console.log('restored wallet address:', savedWalletAddress)
    }

    const saved = await AsyncStorage.getItem(PROFILE_STORAGE_KEY)
    if (saved) {
      currentProfile = JSON.parse(saved)
      console.log('loaded user profile:', currentProfile?.userName)
      return currentProfile
    }
    return null
  } catch (error) {
    console.error('failed to load user profile:', error)
    return null
  }
}

// initialize backend with wallet address (call after payment or wallet connect)
export const initializeBackend = async (
  walletAddress: string
): Promise<void> => {
  try {
    // get push token first (if available)
    const pushToken = await registerForPushNotifications()

    // check if already initialized with same wallet
    const existingWallet = getCurrentUserId()
    if (existingWallet === walletAddress) {
      console.log('backend already initialized with wallet:', walletAddress)
      if (pushToken) {
        updateDeviceToken(pushToken).catch(err => {
          console.warn('failed to update device token:', err)
        })
      }
      return
    }

    // save wallet address as user id
    await AsyncStorage.setItem(WALLET_ADDRESS_STORAGE_KEY, walletAddress)
    setCurrentUserId(walletAddress)
    setFirebaseUserId(walletAddress)
    console.log('initialized with wallet address:', walletAddress)

    // try to register with backend
    try {
      await registerUser(pushToken ?? undefined, currentProfile ?? undefined, walletAddress)
      console.log('backend registered for wallet:', walletAddress)
    } catch (backendError) {
      console.warn('backend registration failed:', backendError)
    }

    // create/update user document in firestore using wallet address as document id
    await createOrUpdateUser(walletAddress, {
      walletAddress,
      timezone: getDeviceTimezone(),
      profile: currentProfile ?? undefined,
      hasLifetimeAccess: currentProfile?.hasLifetimeAccess ?? false
    })
    console.log('created/updated user in firestore:', walletAddress)

    // update device token if available
    if (pushToken) {
      updateDeviceToken(pushToken).catch(err => {
        console.warn('failed to update device token:', err)
      })
    }
  } catch (error) {
    console.error('failed to initialize backend:', error)
    throw error
  }
}

// save profile to storage
export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  try {
    currentProfile = profile
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
    console.log('saved user profile:', profile.userName)
  } catch (error) {
    console.error('failed to save user profile:', error)
  }
}

// get current profile (in-memory)
export const getUserProfile = (): UserProfile | null => {
  return currentProfile
}

// update specific fields in profile
export const updateUserProfile = async (updates: Partial<UserProfile>): Promise<void> => {
  if (!currentProfile) {
    currentProfile = createEmptyProfile()
  }
  currentProfile = { ...currentProfile, ...updates }
  await saveUserProfile(currentProfile)

  // sync to backend (fire and forget, don't block on this)
  syncProfile(updates).catch(err => {
    console.warn('failed to sync profile to backend:', err)
  })
}

// mark user as having lifetime access
export const grantLifetimeAccess = async (): Promise<void> => {
  await updateUserProfile({ hasLifetimeAccess: true })

  // sync lifetime access to firestore
  grantFirebaseLifetimeAccess().catch(err => {
    console.warn('failed to grant firebase lifetime access:', err)
  })

  // sync lifetime access to backend (if exists)
  grantBackendLifetimeAccess().catch(err => {
    console.warn('failed to grant backend lifetime access:', err)
  })
}

// restore subscription from firestore using wallet address
export const restoreSubscriptionFromFirestore = async (walletAddress: string): Promise<boolean> => {
  if (!walletAddress) {
    console.warn('cannot restore subscription: no wallet address')
    return false
  }

  try {
    const hasAccess = await checkFirebaseLifetimeAccess(walletAddress)
    if (hasAccess) {
      // initialize backend with wallet address
      await AsyncStorage.setItem(WALLET_ADDRESS_STORAGE_KEY, walletAddress)
      setCurrentUserId(walletAddress)
      setFirebaseUserId(walletAddress)

      // update local profile
      await updateUserProfile({ hasLifetimeAccess: true })
      console.log('subscription restored from firestore for wallet:', walletAddress)
      return true
    }
    console.log('no subscription found for wallet:', walletAddress)
    return false
  } catch (error) {
    console.error('failed to restore subscription:', error)
    return false
  }
}

// mark onboarding as complete
export const completeOnboarding = async (): Promise<void> => {
  await updateUserProfile({ hasCompletedOnboarding: true })
}

// check if user has lifetime access
export const hasLifetimeAccess = (): boolean => {
  return currentProfile?.hasLifetimeAccess ?? false
}

// check if onboarding is complete
export const hasCompletedOnboarding = (): boolean => {
  return currentProfile?.hasCompletedOnboarding ?? false
}

// clear profile (for testing or reset)
export const clearUserProfile = async (): Promise<void> => {
  try {
    currentProfile = null
    await AsyncStorage.removeItem(PROFILE_STORAGE_KEY)
    console.log('cleared user profile')
  } catch (error) {
    console.error('failed to clear user profile:', error)
  }
}
