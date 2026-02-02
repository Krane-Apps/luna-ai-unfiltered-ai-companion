// firebase initialization and firestore helpers

import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import {
  FIREBASE_API_KEY,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID
} from '@env'
import { UserProfile } from '../types'
import { isNetworkError, showNetworkError } from './api'

// firebase config from environment
const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID
}

// initialize firebase (only once)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
const db = getFirestore(app)

// current user id (set after registration)
let currentUserId: string | null = null

// set the current user id
export const setFirebaseUserId = (userId: string) => {
  currentUserId = userId
}

// get current user id
export const getFirebaseUserId = () => currentUserId

// create or update user in firestore
export const createOrUpdateUser = async (
  userId: string,
  data: {
    deviceToken?: string
    timezone?: string
    profile?: Partial<UserProfile>
    walletAddress?: string
    hasLifetimeAccess?: boolean
    twitterShareUrl?: string
  }
): Promise<void> => {
  const userRef = doc(db, 'users', userId)
  const userDoc = await getDoc(userRef)

  if (userDoc.exists()) {
    // update existing user
    await updateDoc(userRef, {
      ...data,
      lastActive: serverTimestamp()
    })
  } else {
    // create new user
    await setDoc(userRef, {
      ...data,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp()
    })
  }
}

// update device token for push notifications
export const updateUserDeviceToken = async (token: string): Promise<void> => {
  if (!currentUserId) {
    console.warn('cannot update device token: no user id')
    return
  }
  await updateDoc(doc(db, 'users', currentUserId), {
    deviceToken: token,
    lastActive: serverTimestamp()
  })
}

// update user timezone
export const updateUserTimezone = async (timezone: string): Promise<void> => {
  if (!currentUserId) return
  await updateDoc(doc(db, 'users', currentUserId), { timezone })
}

// grant lifetime access
export const grantFirebaseLifetimeAccess = async (): Promise<void> => {
  if (!currentUserId) return
  await updateDoc(doc(db, 'users', currentUserId), {
    hasLifetimeAccess: true
  })
}

// check if user has lifetime access in firestore (for "already have subscription" feature)
export const checkFirebaseLifetimeAccess = async (userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId)
    const userDoc = await getDoc(userRef)
    if (userDoc.exists()) {
      const data = userDoc.data()
      return data?.hasLifetimeAccess === true
    }
    return false
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn('[Firebase] network error checking lifetime access')
      showNetworkError()
    } else {
      console.error('failed to check lifetime access:', error)
    }
    return false
  }
}

// get user data from firestore by id
export const getUserFromFirestore = async (userId: string): Promise<{
  hasLifetimeAccess: boolean
  profile?: Partial<UserProfile>
} | null> => {
  try {
    const userRef = doc(db, 'users', userId)
    const userDoc = await getDoc(userRef)
    if (userDoc.exists()) {
      const data = userDoc.data()
      return {
        hasLifetimeAccess: data?.hasLifetimeAccess === true,
        profile: data?.profile
      }
    }
    return null
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn('[Firebase] network error getting user')
      showNetworkError()
    } else {
      console.error('failed to get user from firestore:', error)
    }
    return null
  }
}

// save twitter share url
export const saveTwitterShareUrl = async (url: string): Promise<void> => {
  if (!currentUserId) return
  await updateDoc(doc(db, 'users', currentUserId), {
    twitterShareUrl: url,
    hasLifetimeAccess: true
  })
}

// message type for firestore
interface FirestoreMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: Timestamp
}

// save a message to firestore
export const saveMessageToFirestore = async (
  role: 'user' | 'assistant',
  content: string
): Promise<void> => {
  if (!currentUserId) {
    console.warn('cannot save message: no user id')
    return
  }

  const messagesRef = collection(db, 'users', currentUserId, 'messages')
  await addDoc(messagesRef, {
    role,
    content,
    createdAt: serverTimestamp()
  })
}

// get messages from firestore
export const getMessagesFromFirestore = async (
  messageLimit = 50
): Promise<Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: Date }>> => {
  if (!currentUserId) {
    return []
  }

  try {
    const messagesRef = collection(db, 'users', currentUserId, 'messages')
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(messageLimit))
    const snapshot = await getDocs(q)

    return snapshot.docs.map(docSnap => {
      const data = docSnap.data() as FirestoreMessage
      return {
        id: docSnap.id,
        role: data.role,
        content: data.content,
        createdAt: data.createdAt?.toDate() || new Date()
      }
    })
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn('[Firebase] network error getting messages')
      showNetworkError()
    } else {
      console.error('failed to get messages from firestore:', error)
    }
    return []
  }
}

// get new messages since a timestamp (for syncing proactive messages)
export const getNewMessages = async (
  sinceTimestamp: Date
): Promise<Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: Date }>> => {
  if (!currentUserId) {
    return []
  }

  try {
    const messagesRef = collection(db, 'users', currentUserId, 'messages')
    const q = query(
      messagesRef,
      where('createdAt', '>', Timestamp.fromDate(sinceTimestamp)),
      orderBy('createdAt', 'asc')
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map(docSnap => {
      const data = docSnap.data() as FirestoreMessage
      return {
        id: docSnap.id,
        role: data.role,
        content: data.content,
        createdAt: data.createdAt?.toDate() || new Date()
      }
    })
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn('[Firebase] network error syncing messages')
    } else {
      console.error('failed to get new messages from firestore:', error)
    }
    return []
  }
}

// update last active timestamp (heartbeat)
export const sendFirebaseHeartbeat = async (): Promise<void> => {
  if (!currentUserId) return
  try {
    await updateDoc(doc(db, 'users', currentUserId), {
      lastActive: serverTimestamp()
    })
  } catch (error) {
    // silently fail heartbeats
    console.warn('firebase heartbeat failed:', error)
  }
}

export { db, app }
