// push notification service for luna ai

import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { updateUserDeviceToken } from './firebase'

let _muted = false

// configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: !_muted,
    shouldPlaySound: !_muted,
    shouldSetBadge: !_muted,
  })
})

export const setNotificationsMuted = (muted: boolean) => {
  _muted = muted
}

// request permission for push notifications
export const requestNotificationPermissions = async (): Promise<boolean> => {
  // must be physical device for push notifications
  if (!Device.isDevice) {
    console.warn('push notifications require physical device')
    return false
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.warn('push notification permission not granted')
    return false
  }

  return true
}

// get push token and register with firebase
export const registerForPushNotifications = async (): Promise<string | null> => {
  const hasPermission = await requestNotificationPermissions()
  if (!hasPermission) return null

  try {
    // set notification channel for android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('luna-messages', {
        name: 'Luna Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF69B4',
        sound: 'default'
      })
    }

    // get expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'luna-ai-5f54f'
    })

    const token = tokenData.data
    console.log('expo push token:', token)

    // save token to firebase
    await updateUserDeviceToken(token)

    return token
  } catch (error) {
    console.error('failed to get push token:', error)
    return null
  }
}

// handle incoming notification when app is foregrounded
export const setupNotificationHandlers = (
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
): () => void => {
  const subscriptions: Notifications.Subscription[] = []

  // handle notification while app is open
  if (onNotificationReceived) {
    const sub = Notifications.addNotificationReceivedListener(notification => {
      console.log('notification received:', notification)
      onNotificationReceived(notification)
    })
    subscriptions.push(sub)
  }

  // handle notification tap (app was in background)
  if (onNotificationTapped) {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('notification tapped:', response)
      onNotificationTapped(response)
    })
    subscriptions.push(sub)
  }

  // return cleanup function
  return () => {
    subscriptions.forEach(sub => sub.remove())
  }
}

// get last notification that opened the app
export const getInitialNotification = async (): Promise<Notifications.NotificationResponse | null> => {
  return Notifications.getLastNotificationResponseAsync()
}

// schedule a local notification (for testing)
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  seconds = 1
): Promise<string> => {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default'
    },
    trigger: { seconds }
  })
}
