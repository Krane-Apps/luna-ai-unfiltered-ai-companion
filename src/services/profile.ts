// profile service for user personalization data

import AsyncStorage from '@react-native-async-storage/async-storage'
import { UserProfile } from '../types'

const PROFILE_STORAGE_KEY = 'luna_user_profile'

let currentProfile: UserProfile | null = null

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
  hasCompletedOnboarding: false,
  hasLifetimeAccess: false,
  createdAt: Date.now()
})

// load profile from storage
export const loadUserProfile = async (): Promise<UserProfile | null> => {
  try {
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
}

// mark user as having lifetime access
export const grantLifetimeAccess = async (): Promise<void> => {
  await updateUserProfile({ hasLifetimeAccess: true })
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
