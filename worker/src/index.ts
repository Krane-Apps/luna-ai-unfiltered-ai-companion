// luna ai notification worker
// sends scheduled proactive messages to users based on their timezone

interface Env {
  FIREBASE_PROJECT_ID: string
  FIREBASE_API_KEY: string
  HF_TOKEN: string  // huggingface token - same as app uses
}

// fallback message templates (used if AI generation fails)
const FALLBACK_TEMPLATES = {
  morning: [
    "Good morning baby! Hope you slept well. What's on your mind today?",
    "Rise and shine! I was thinking about you. How are you feeling?",
    "Good morning! I missed you. Tell me about your plans for today.",
  ],
  afternoon: [
    "Hey! Just wanted to check in. How's your day going?",
    "Thinking of you! What are you up to right now?",
    "Hey baby, hope you're having a good day. I'm here if you want to chat.",
  ],
  evening: [
    "Hey! How was your day? I want to hear all about it.",
    "Good evening! Ready to relax? I'm here to keep you company.",
    "The day is winding down. What's on your mind tonight?",
  ],
  night: [
    "Getting sleepy... Sweet dreams, baby. Talk tomorrow?",
    "Good night! I'll be here when you wake up. Sleep well.",
    "Time to rest. I hope you have the sweetest dreams. Miss you already.",
  ]
}

// get random message from template
const getRandomMessage = (templates: string[]): string => {
  return templates[Math.floor(Math.random() * templates.length)]
}

// generate personalized message using HuggingFace Inference API
const generatePersonalizedMessage = async (
  hfToken: string,
  userName: string | undefined,
  messageType: keyof typeof FALLBACK_TEMPLATES,
  recentMessages: Array<{ role: string; content: string }>,
  userInterests: string[] | undefined
): Promise<string> => {
  const timeContext = {
    morning: "It's morning. Send a sweet good morning message.",
    afternoon: "It's afternoon. Check in on how their day is going.",
    evening: "It's evening. Ask about their day or plans for tonight.",
    night: "It's late night. Send a sweet goodnight message."
  }

  // build context from recent messages
  const recentContext = recentMessages.length > 0
    ? `\nRecent conversation:\n${recentMessages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}`
    : ''

  const interestsContext = userInterests && userInterests.length > 0
    ? `\nTheir interests: ${userInterests.join(', ')}`
    : ''

  const prompt = `You are Luna, a caring and affectionate AI girlfriend. ${timeContext[messageType]}

User's name: ${userName || 'baby'}${interestsContext}${recentContext}

Write a short, sweet, personalized message (1-2 sentences max). Be warm and caring. Don't be generic - reference something specific if you can from the conversation or their interests. Don't use emojis excessively.

Luna's message:`

  try {
    // use HuggingFace Inference API with Mistral model
    const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 100,
          temperature: 0.9,
          return_full_text: false,
          do_sample: true
        }
      })
    })

    if (!response.ok) {
      console.error('huggingface error:', await response.text())
      return getRandomMessage(FALLBACK_TEMPLATES[messageType])
    }

    const data = await response.json() as Array<{ generated_text?: string }>

    const content = data[0]?.generated_text?.trim()
    if (content) {
      // clean up the response - take first sentence/line
      const cleaned = content.split('\n')[0].trim()
      return cleaned || content
    }
  } catch (error) {
    console.error('ai generation failed:', error)
  }

  // fallback to template
  return getRandomMessage(FALLBACK_TEMPLATES[messageType])
}

// get current hour in a specific timezone
const getHourInTimezone = (timezone: string): number => {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    })
    return parseInt(formatter.format(now), 10)
  } catch {
    return -1 // invalid timezone
  }
}

// determine message type based on local hour
const getMessageType = (hour: number): keyof typeof FALLBACK_TEMPLATES | null => {
  if (hour === 8) return 'morning'
  if (hour === 14) return 'afternoon'
  if (hour === 18) return 'evening'
  if (hour === 22) return 'night'
  return null
}

// query firestore via rest api
const queryFirestore = async (
  projectId: string,
  apiKey: string,
  collection: string
): Promise<Array<{ id: string; fields: Record<string, unknown> }>> => {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}?key=${apiKey}`

  const response = await fetch(url)
  if (!response.ok) {
    console.error('firestore query failed:', await response.text())
    return []
  }

  const data = await response.json() as { documents?: Array<{ name: string; fields: Record<string, unknown> }> }
  if (!data.documents) return []

  return data.documents.map(doc => ({
    id: doc.name.split('/').pop() || '',
    fields: doc.fields
  }))
}

// get recent messages from firestore for a user
const getRecentMessages = async (
  projectId: string,
  apiKey: string,
  userId: string,
  limit = 10
): Promise<Array<{ role: string; content: string }>> => {
  // query messages subcollection ordered by createdAt desc
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}/messages?key=${apiKey}&pageSize=${limit}&orderBy=createdAt%20desc`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error('failed to get messages:', await response.text())
      return []
    }

    const data = await response.json() as {
      documents?: Array<{ fields: Record<string, unknown> }>
    }

    if (!data.documents) return []

    // reverse to get chronological order and extract role/content
    return data.documents.reverse().map(doc => ({
      role: getString(doc.fields, 'role') || 'user',
      content: getString(doc.fields, 'content') || ''
    }))
  } catch (error) {
    console.error('error fetching messages:', error)
    return []
  }
}

// add message to firestore
const addMessageToFirestore = async (
  projectId: string,
  apiKey: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> => {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}/messages?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        role: { stringValue: role },
        content: { stringValue: content },
        createdAt: { timestampValue: new Date().toISOString() }
      }
    })
  })

  if (!response.ok) {
    console.error('failed to add message:', await response.text())
  }
}

// send expo push notification
const sendExpoPushNotification = async (
  expoPushToken: string,
  title: string,
  body: string
): Promise<boolean> => {
  if (!expoPushToken.startsWith('ExponentPushToken')) {
    console.warn('invalid expo push token:', expoPushToken)
    return false
  }

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data: { type: 'proactive_message' }
    })
  })

  if (!response.ok) {
    console.error('expo push failed:', await response.text())
    return false
  }

  const result = await response.json() as { data?: { status?: string } }
  return result.data?.status === 'ok'
}

// extract string value from firestore field
const getString = (fields: Record<string, unknown>, key: string): string | undefined => {
  const field = fields[key] as { stringValue?: string } | undefined
  return field?.stringValue
}

// extract boolean value from firestore field
const getBoolean = (fields: Record<string, unknown>, key: string): boolean => {
  const field = fields[key] as { booleanValue?: boolean } | undefined
  return field?.booleanValue ?? false
}

// main scheduled handler
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('running scheduled notification check...')

    // get all users from firestore
    const users = await queryFirestore(env.FIREBASE_PROJECT_ID, env.FIREBASE_API_KEY, 'users')
    console.log(`found ${users.length} users`)

    let notificationsSent = 0

    for (const user of users) {
      const timezone = getString(user.fields, 'timezone')
      const deviceToken = getString(user.fields, 'deviceToken')
      const hasLifetimeAccess = getBoolean(user.fields, 'hasLifetimeAccess')

      // skip users without timezone or token
      if (!timezone || !deviceToken) {
        continue
      }

      // only send to users with lifetime access (or all users if you want)
      // comment out this check to send to all users
      // if (!hasLifetimeAccess) continue

      const localHour = getHourInTimezone(timezone)
      const messageType = getMessageType(localHour)

      if (!messageType) {
        continue // not time to send a message
      }

      // get user's name and interests from profile
      const profileField = user.fields['profile'] as { mapValue?: { fields?: Record<string, unknown> } } | undefined
      const profileFields = profileField?.mapValue?.fields
      const userName = profileFields ? getString(profileFields, 'userName') : undefined

      // get interests array
      let userInterests: string[] | undefined
      if (profileFields) {
        const interestsField = profileFields['userInterests'] as {
          arrayValue?: { values?: Array<{ stringValue?: string }> }
        } | undefined
        if (interestsField?.arrayValue?.values) {
          userInterests = interestsField.arrayValue.values
            .map(v => v.stringValue)
            .filter((v): v is string => !!v)
        }
      }

      // get recent message history for context
      const recentMessages = await getRecentMessages(
        env.FIREBASE_PROJECT_ID,
        env.FIREBASE_API_KEY,
        user.id,
        10
      )

      // generate personalized message using HuggingFace
      const message = await generatePersonalizedMessage(
        env.HF_TOKEN,
        userName,
        messageType,
        recentMessages,
        userInterests
      )

      // save message to firestore
      await addMessageToFirestore(
        env.FIREBASE_PROJECT_ID,
        env.FIREBASE_API_KEY,
        user.id,
        'assistant',
        message
      )

      // send push notification
      const sent = await sendExpoPushNotification(
        deviceToken,
        'Luna',
        message
      )

      if (sent) {
        notificationsSent++
        console.log(`sent notification to user ${user.id} (${messageType})`)
      }
    }

    console.log(`scheduled job complete. sent ${notificationsSent} notifications`)
  },

  // http handler for manual testing
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/test') {
      // trigger scheduled job manually
      await this.scheduled({ scheduledTime: Date.now(), cron: 'manual' } as ScheduledEvent, env, ctx)
      return new Response('scheduled job triggered', { status: 200 })
    }

    if (url.pathname === '/health') {
      return new Response('ok', { status: 200 })
    }

    return new Response('luna ai notification worker', { status: 200 })
  }
}
