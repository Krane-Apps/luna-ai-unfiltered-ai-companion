// backend api service for user sync, messages, and notifications

import { Alert } from 'react-native'
import { BACKEND_URL } from '../constants/config'
import {
  BackendUser,
  BackendMessage,
  RegisterUserRequest,
  SyncMessagesResponse,
  UserProfile
} from '../types'

let currentUserId: string | null = null
let lastNetworkErrorTime = 0

// check if error is a network error
export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof TypeError && error.message === 'Network request failed') {
    return true
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return msg.includes('network') || msg.includes('internet') || msg.includes('offline') || msg.includes('timeout')
  }
  return false
}

// show network error toast (debounced to avoid spam)
export const showNetworkError = (): void => {
  const now = Date.now()
  // only show once every 5 seconds
  if (now - lastNetworkErrorTime > 5000) {
    lastNetworkErrorTime = now
    Alert.alert(
      'No Internet Connection',
      'Please check your internet connection and try again.',
      [{ text: 'OK' }]
    )
  }
}

// get timezone string
const getTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

// generic fetch wrapper with error handling
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${BACKEND_URL}${endpoint}`

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error ${response.status}: ${errorText}`)
    }

    return response.json()
  } catch (error) {
    if (isNetworkError(error)) {
      showNetworkError()
    }
    throw error
  }
}

// register user with backend
export const registerUser = async (
  deviceToken?: string,
  profile?: Partial<UserProfile>,
  walletAddress?: string
): Promise<BackendUser> => {
  const request: RegisterUserRequest = {
    timezone: getTimezone(),
    deviceToken,
    profile,
    walletAddress
  }

  const user = await apiRequest<BackendUser>('/api/users/register', {
    method: 'POST',
    body: JSON.stringify(request)
  })

  currentUserId = user.id
  console.log('registered user with backend:', user.id)
  return user
}

// get current user id
export const getCurrentUserId = (): string | null => currentUserId

// set user id (for restoring from storage)
export const setCurrentUserId = (userId: string): void => {
  currentUserId = userId
}

// update device token
export const updateDeviceToken = async (token: string): Promise<void> => {
  if (!currentUserId) {
    console.warn('cannot update device token: no user registered')
    return
  }

  await apiRequest(`/api/users/${currentUserId}/token`, {
    method: 'PUT',
    body: JSON.stringify({ deviceToken: token })
  })
  console.log('updated device token')
}

// update user profile on backend
export const syncProfile = async (profile: Partial<UserProfile>): Promise<void> => {
  if (!currentUserId) {
    console.warn('cannot sync profile: no user registered')
    return
  }

  await apiRequest(`/api/users/${currentUserId}/profile`, {
    method: 'PUT',
    body: JSON.stringify({ profile })
  })
  console.log('synced profile to backend')
}

// update timezone
export const updateTimezone = async (): Promise<void> => {
  if (!currentUserId) return

  await apiRequest(`/api/users/${currentUserId}/timezone`, {
    method: 'PUT',
    body: JSON.stringify({ timezone: getTimezone() })
  })
}

// grant lifetime access on backend
export const grantBackendLifetimeAccess = async (): Promise<void> => {
  if (!currentUserId) {
    console.warn('cannot grant lifetime access: no user registered')
    return
  }

  await apiRequest(`/api/users/${currentUserId}/lifetime`, {
    method: 'POST'
  })
  console.log('granted lifetime access on backend')
}

// send heartbeat to update last_active
export const sendHeartbeat = async (): Promise<void> => {
  if (!currentUserId) return

  try {
    await apiRequest(`/api/users/${currentUserId}/heartbeat`, {
      method: 'POST'
    })
  } catch (error) {
    // silently fail heartbeats
    console.warn('heartbeat failed:', error)
  }
}

// get messages from backend
export const fetchMessages = async (
  limit = 50,
  offset = 0
): Promise<SyncMessagesResponse> => {
  if (!currentUserId) {
    return { messages: [], hasMore: false }
  }

  return apiRequest<SyncMessagesResponse>(
    `/api/messages/${currentUserId}?limit=${limit}&offset=${offset}`
  )
}

// get new messages since timestamp
export const syncMessages = async (since: number): Promise<BackendMessage[]> => {
  if (!currentUserId) {
    return []
  }

  const result = await apiRequest<{ messages: BackendMessage[] }>(
    `/api/messages/${currentUserId}/sync?since=${since}`
  )
  return result.messages
}

// save a single message to backend
export const saveMessage = async (
  role: 'user' | 'assistant',
  content: string
): Promise<BackendMessage | null> => {
  if (!currentUserId) {
    console.warn('cannot save message: no user registered')
    return null
  }

  return apiRequest<BackendMessage>('/api/messages', {
    method: 'POST',
    body: JSON.stringify({
      userId: currentUserId,
      role,
      content
    })
  })
}

// save multiple messages to backend (for batch sync)
export const saveMessagesBatch = async (
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<void> => {
  if (!currentUserId || messages.length === 0) return

  await apiRequest('/api/messages/batch', {
    method: 'POST',
    body: JSON.stringify({
      userId: currentUserId,
      messages
    })
  })
  console.log('synced', messages.length, 'messages to backend')
}

// clear message history on backend
export const clearBackendMessages = async (): Promise<void> => {
  if (!currentUserId) return

  await apiRequest(`/api/messages/${currentUserId}`, {
    method: 'DELETE'
  })
  console.log('cleared backend message history')
}

// submit twitter share url for free lifetime
export const submitTwitterShare = async (tweetUrl: string): Promise<boolean> => {
  if (!currentUserId) {
    console.warn('cannot submit twitter share: no user registered')
    return false
  }

  // basic url validation
  const isValidTwitterUrl =
    (tweetUrl.includes('twitter.com') || tweetUrl.includes('x.com')) &&
    tweetUrl.includes('/status/')

  if (!isValidTwitterUrl) {
    console.warn('invalid twitter url:', tweetUrl)
    return false
  }

  try {
    await apiRequest(`/api/users/${currentUserId}/profile`, {
      method: 'PUT',
      body: JSON.stringify({
        twitterShareUrl: tweetUrl
      })
    })

    // grant lifetime access
    await grantBackendLifetimeAccess()
    return true
  } catch (error) {
    console.error('failed to submit twitter share:', error)
    return false
  }
}

// send test notification (for debugging)
export const sendTestNotification = async (
  message = 'Test notification from Luna!'
): Promise<boolean> => {
  if (!currentUserId) {
    console.warn('cannot send test notification: no user registered')
    return false
  }

  try {
    await apiRequest('/api/notifications/test', {
      method: 'POST',
      body: JSON.stringify({
        userId: currentUserId,
        message
      })
    })
    return true
  } catch (error) {
    console.error('failed to send test notification:', error)
    return false
  }
}
