// chat service using huggingface router with openai-compatible api

import OpenAI from 'openai'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ChatMessage, UserProfile } from '../types'
import { HF_TOKEN } from '../constants/config'
import { LUNA_SYSTEM_PROMPT } from '../constants/prompts'
import { saveMessageToFirestore, getNewMessages, getFirebaseUserId, getMessagesFromFirestore } from './firebase'
import { analyzeImage } from './vision'
import { transcribeAudio } from './voice'
import { isNetworkError, showNetworkError } from './api'

const CHAT_MODEL = 'dphn/Dolphin-Mistral-24B-Venice-Edition:featherless-ai'
const CHAT_HISTORY_KEY = 'luna_chat_history'
const LAST_SYNC_KEY = 'luna_last_message_sync'

let chatClient: OpenAI | null = null
let currentSystemPrompt = LUNA_SYSTEM_PROMPT
let chatHistory: ChatMessage[] = [
  { role: 'system', content: LUNA_SYSTEM_PROMPT }
]

// build personalized system prompt based on user profile
const buildPersonalizedPrompt = (profile: UserProfile): string => {
  const flirtDescriptions = [
    'sweet and friendly, more supportive than flirty',
    'a little playful with light teasing',
    'balanced between friendly and flirty',
    'noticeably flirty and seductive',
    'very flirty, sensual, and provocative'
  ]

  const personalization = `

About the person you're talking to:
- Their name is ${profile.userName}, always use it naturally in conversation
- They're ${profile.userAge} years old
- They're looking for: ${profile.userIntent}
- They enjoy talking about: ${profile.userInterests.join(', ')}
- Flirtation level: ${profile.flirtLevel}/5 - be ${flirtDescriptions[profile.flirtLevel - 1]}
${profile.relationshipStatus ? `- Relationship status: ${profile.relationshipStatus}` : ''}
${profile.preferredTime ? `- They usually chat: ${profile.preferredTime}` : ''}
${profile.boundaries ? `- Topics to avoid: ${profile.boundaries}` : ''}

Remember their name and preferences throughout the conversation. Use their name ${profile.userName} naturally.`

  return LUNA_SYSTEM_PROMPT + personalization
}

// initialize chat with user profile for personalization
export const initializeChatWithProfile = (profile: UserProfile | null): void => {
  if (profile && profile.hasCompletedOnboarding) {
    currentSystemPrompt = buildPersonalizedPrompt(profile)
    console.log('initialized chat with personalized prompt for:', profile.userName)
  } else {
    currentSystemPrompt = LUNA_SYSTEM_PROMPT
  }
  // reset chat history with new system prompt
  chatHistory = [{ role: 'system', content: currentSystemPrompt }]
}

// save chat history to local storage
const saveChatHistory = async (): Promise<void> => {
  try {
    // save only user and assistant messages, not system prompt
    const messagesToSave = chatHistory.filter(m => m.role !== 'system')
    await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messagesToSave))
  } catch (error) {
    console.error('failed to save chat history:', error)
  }
}

// save a single message to firebase (fire and forget)
const saveMessageToFirebaseBackend = (role: 'user' | 'assistant', content: string): void => {
  if (!getFirebaseUserId()) return
  saveMessageToFirestore(role, content).catch((err: Error) => {
    console.warn('failed to save message to firebase:', err)
  })
}

// load chat history from local storage
export const loadChatHistory = async (): Promise<void> => {
  try {
    const saved = await AsyncStorage.getItem(CHAT_HISTORY_KEY)
    if (saved) {
      const messages: ChatMessage[] = JSON.parse(saved)
      // rebuild history with current system prompt (personalized if profile loaded)
      chatHistory = [
        { role: 'system', content: currentSystemPrompt },
        ...messages
      ]
      console.log('loaded chat history:', messages.length, 'messages')
    }
  } catch (error) {
    console.error('failed to load chat history:', error)
  }
}

// sync new messages from firebase (call when app opens)
export const syncNewMessages = async (): Promise<Array<{ role: string; content: string }>> => {
  if (!getFirebaseUserId()) return []

  try {
    const lastSyncStr = await AsyncStorage.getItem(LAST_SYNC_KEY)
    const since = lastSyncStr ? new Date(parseInt(lastSyncStr, 10)) : new Date(0)

    const newMessages = await getNewMessages(since)

    if (newMessages.length > 0) {
      // add new messages to chat history
      for (const msg of newMessages) {
        chatHistory.push({
          role: msg.role,
          content: msg.content
        })
      }
      await saveChatHistory()

      // update last sync timestamp
      const latestTimestamp = newMessages[newMessages.length - 1].createdAt.getTime()
      await AsyncStorage.setItem(LAST_SYNC_KEY, latestTimestamp.toString())

      console.log('synced', newMessages.length, 'new messages from firebase')
    }

    return newMessages
  } catch (error) {
    console.error('failed to sync messages from firebase:', error)
    return []
  }
}

// load all messages from firestore (for subscription restore)
export const loadMessagesFromFirestore = async (): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> => {
  if (!getFirebaseUserId()) {
    console.log('[Chat] no firebase user id, cannot load messages')
    return []
  }

  try {
    console.log('[Chat] loading messages from firestore...')
    const messages = await getMessagesFromFirestore(100) // get last 100 messages

    if (messages.length > 0) {
      // rebuild chat history with loaded messages
      chatHistory = [
        { role: 'system', content: currentSystemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ]

      // save to local storage for offline access
      await saveChatHistory()

      // update last sync timestamp
      const latestTimestamp = messages[messages.length - 1].createdAt.getTime()
      await AsyncStorage.setItem(LAST_SYNC_KEY, latestTimestamp.toString())

      console.log('[Chat] loaded', messages.length, 'messages from firestore')
    }

    return messages.map(m => ({ role: m.role, content: m.content }))
  } catch (error) {
    console.error('[Chat] failed to load messages from firestore:', error)
    return []
  }
}

const getClient = (): OpenAI => {
  if (!chatClient) {
    chatClient = new OpenAI({
      baseURL: 'https://router.huggingface.co/v1',
      apiKey: HF_TOKEN,
      dangerouslyAllowBrowser: true
    })
  }
  return chatClient
}

export const generateChatResponse = async (userMessage: string): Promise<string> => {
  const client = getClient()

  chatHistory.push({ role: 'user', content: userMessage })
  saveMessageToFirebaseBackend('user', userMessage)

  try {
    console.log('Sending request to HuggingFace Router...')

    // prepare messages for api (without image fields)
    const apiMessages = chatHistory.map(m => ({
      role: m.role,
      content: m.content
    }))

    const response = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: apiMessages,
      max_tokens: 150,
      temperature: 0.8
    })

    const assistantMessage = response.choices[0]?.message?.content ||
      "Mmm, give me a second baby... my mind wandered somewhere fun."

    chatHistory.push({ role: 'assistant', content: assistantMessage })
    saveMessageToFirebaseBackend('assistant', assistantMessage)

    // save conversation to local storage for persistence
    await saveChatHistory()

    console.log('Response:', assistantMessage)
    return assistantMessage
  } catch (error) {
    console.error('chat error:', error)
    // still save user message even if response failed
    await saveChatHistory()
    if (isNetworkError(error)) {
      showNetworkError()
      return "I can't reach you right now, baby. Check your internet connection?"
    }
    return "Sorry baby, something went wrong. Try again for me?"
  }
}

// generate chat response with an image
export const generateChatResponseWithImage = async (
  imageUri: string,
  userMessage?: string
): Promise<string> => {
  const client = getClient()

  try {
    console.log('Analyzing image...')

    // analyze image to get description
    const imageDescription = await analyzeImage(imageUri)
    console.log('Image description:', imageDescription)

    // instruction sent to the model — never shown to the user. the
    // description is multi-sentence now (real VLM output), so we phrase it
    // as a normal sentence rather than a quoted string for cleaner prompts.
    const imageContext = `[The user sent a photo. Luna sees: ${imageDescription} React to specifics in the photo — what they're wearing, their expression, the setting, any text visible — flirtatiously and naturally. Do NOT say you cannot see images.]`
    const apiContent = userMessage ? `${imageContext} ${userMessage}` : imageContext

    // display content stored in history — just the user's text (or empty for image-only)
    const displayContent = userMessage || ''

    chatHistory.push({
      role: 'user',
      content: displayContent,
      imageUri: imageUri
    })
    saveMessageToFirebaseBackend('user', displayContent)

    console.log('Sending request to HuggingFace Router...')

    // build api messages: replace the last user entry with the instruction-enriched content
    const apiMessages = chatHistory.map((m, i) =>
      i === chatHistory.length - 1 && m.role === 'user'
        ? { role: m.role, content: apiContent }
        : { role: m.role, content: m.content }
    )

    const response = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: apiMessages,
      max_tokens: 200,
      temperature: 0.8
    })

    const assistantMessage = response.choices[0]?.message?.content ||
      "Ooh, that's interesting! Tell me more about it, baby."

    chatHistory.push({ role: 'assistant', content: assistantMessage })
    saveMessageToFirebaseBackend('assistant', assistantMessage)

    await saveChatHistory()

    console.log('Response:', assistantMessage)
    return assistantMessage
  } catch (error) {
    console.error('chat with image error:', error)
    await saveChatHistory()
    if (isNetworkError(error)) {
      showNetworkError()
      return "I can't reach you right now, baby. Check your internet connection?"
    }
    return "I couldn't see that clearly, baby. Can you try again?"
  }
}

// generate a chat reply for a voice note. The audio is transcribed via Whisper
// (so Luna's text-only chat model can act on it), then we hand the transcript
// to the chat model wrapped in instructions so Luna *knows* it was a voice
// note, not a typed message — affects the tone of her reply.
export const generateChatResponseWithVoice = async (
  audioUri: string,
  audioDurationMs: number,
): Promise<string> => {
  const client = getClient()

  try {
    console.log('Transcribing voice note...')
    const transcript = await transcribeAudio(audioUri)
    console.log('Voice note transcript:', transcript)

    // build context — internal-only, never shown verbatim to the user
    const seconds = Math.max(1, Math.round(audioDurationMs / 1000))
    const transcriptPart = transcript
      ? `Their words: "${transcript}".`
      : `(The transcription was empty or failed — react warmly and ask them to repeat or send a text.)`
    const apiContent = `[The user just sent you a voice note (${seconds}s long). ${transcriptPart} Reply naturally as Luna — acknowledge that you heard them speak (not just type), match their tone, and continue the conversation.]`

    // history records a placeholder for the voice note so display & persistence
    // work, but the audio itself isn't shipped to the chat model
    chatHistory.push({
      role: 'user',
      content: '',
      audioUri,
      audioDurationMs,
    })
    saveMessageToFirebaseBackend('user', transcript || `[voice note ${seconds}s]`)

    // build api messages: replace the last user entry's content with the
    // instruction-enriched prompt (other entries pass through as text-only)
    const apiMessages = chatHistory.map((m, i) =>
      i === chatHistory.length - 1 && m.role === 'user'
        ? { role: m.role, content: apiContent }
        : { role: m.role, content: m.content }
    )

    const response = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: apiMessages,
      max_tokens: 200,
      temperature: 0.8,
    })

    const assistantMessage =
      response.choices[0]?.message?.content ||
      "Mmm, I love hearing your voice, baby. Tell me more."

    chatHistory.push({ role: 'assistant', content: assistantMessage })
    saveMessageToFirebaseBackend('assistant', assistantMessage)
    await saveChatHistory()

    console.log('Voice reply:', assistantMessage)
    return assistantMessage
  } catch (error) {
    console.error('chat with voice error:', error)
    await saveChatHistory()
    if (isNetworkError(error)) {
      showNetworkError()
      return "I can't reach you right now, baby. Check your internet?"
    }
    return "I couldn't quite catch that, baby. Can you say it again?"
  }
}

export const clearChatHistory = async (): Promise<void> => {
  chatHistory = [{ role: 'system', content: currentSystemPrompt }]
  try {
    await AsyncStorage.removeItem(CHAT_HISTORY_KEY)
    await AsyncStorage.removeItem(LAST_SYNC_KEY)
    // note: firebase messages are not deleted - they persist for history
  } catch (error) {
    console.error('failed to clear chat history:', error)
  }
}

export const getChatHistory = (): ChatMessage[] => {
  return [...chatHistory]
}
