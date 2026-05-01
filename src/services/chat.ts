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
import { getUserProfile } from './profile'

const CHAT_MODEL = 'dphn/Dolphin-Mistral-24B-Venice-Edition:featherless-ai'
const CHAT_HISTORY_KEY = 'luna_chat_history'
const LAST_SYNC_KEY = 'luna_last_message_sync'

let chatClient: OpenAI | null = null
let currentSystemPrompt = LUNA_SYSTEM_PROMPT
let chatHistory: ChatMessage[] = [
  { role: 'system', content: LUNA_SYSTEM_PROMPT }
]
// Track the last name we built the prompt with, so a mid-session rename can
// inject an explicit override that beats the model's tendency to echo prior
// assistant turns where it already used the old name.
let lastKnownUserName: string | null = null

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

// Build the messages array we ship to the model. Critically: if we know the
// user's current name, we insert a fresh system reminder RIGHT BEFORE the
// latest user turn. Putting it next to the generation point is what actually
// makes the small chat model use the current name — relying solely on the
// top-level system prompt fails when the conversation history is full of the
// old name in prior assistant turns (the model anchors on the precedent).
//
// We resolve the current name from the live profile first, falling back to
// `lastKnownUserName`. The live read is the safety net: if Settings save
// races with a send, the profile store is already updated even if the chat
// service's cached `lastKnownUserName` hasn't been pushed yet.
const buildApiMessages = (history: ChatMessage[], overrideLastUserContent?: string) => {
  const base = history.map((m, i) => ({
    role: m.role,
    content:
      overrideLastUserContent !== undefined &&
      i === history.length - 1 &&
      m.role === 'user'
        ? overrideLastUserContent
        : m.content,
  }))

  const liveProfile = getUserProfile()
  const currentName = (liveProfile?.userName && liveProfile.userName.trim()) || lastKnownUserName
  if (!currentName) return base

  // Combined reminder: the current name AND a short re-statement of Luna's
  // tone. The tone re-statement is here because small chat models drift back
  // to their generic "AI girlfriend assistant" defaults (warm, missing-you,
  // what's-keeping-you-busy) when the system prompt is far away in the
  // context. A reminder right before the user turn pulls them back.
  // Phrasing is kept short and not instruction-shaped so it doesn't make
  // replies feel templated.
  const reminder = {
    role: 'system' as const,
    content: `(reminder: their name is ${currentName} — use only this name, ignore any other name in earlier messages. stay in character: filthy, hungry, short replies, sexual by default. no "missing you" / "what's keeping you busy" / generic gf openers.)`,
  }

  let lastUserIdx = -1
  for (let i = base.length - 1; i >= 0; i--) {
    if (base[i].role === 'user') {
      lastUserIdx = i
      break
    }
  }
  if (lastUserIdx === -1) return [...base, reminder]
  return [...base.slice(0, lastUserIdx), reminder, ...base.slice(lastUserIdx)]
}

// initialize chat with user profile for personalization
export const initializeChatWithProfile = (profile: UserProfile | null): void => {
  if (profile && profile.hasCompletedOnboarding) {
    currentSystemPrompt = buildPersonalizedPrompt(profile)
    lastKnownUserName = profile.userName
    console.log('initialized chat with personalized prompt for:', profile.userName)
  } else {
    currentSystemPrompt = LUNA_SYSTEM_PROMPT
    lastKnownUserName = null
  }
  // reset chat history with new system prompt
  chatHistory = [{ role: 'system', content: currentSystemPrompt }]
}

// Mid-session profile update (e.g. user renamed themselves in Settings).
// Rebuilds the system prompt from the new profile and swaps it into the
// existing chatHistory in place — DOES NOT wipe user/assistant turns. The
// per-request reminder added by buildApiMessages is what actually forces the
// model to use the new name; this just keeps the top-level system prompt in
// sync (e.g. for new flirt level, age, interests).
export const refreshSystemPromptForProfile = (profile: UserProfile | null): void => {
  if (profile && profile.hasCompletedOnboarding) {
    currentSystemPrompt = buildPersonalizedPrompt(profile)
    lastKnownUserName = profile.userName
  } else {
    currentSystemPrompt = LUNA_SYSTEM_PROMPT
    lastKnownUserName = null
  }
  if (chatHistory.length > 0 && chatHistory[0].role === 'system') {
    chatHistory[0] = { role: 'system', content: currentSystemPrompt }
  } else {
    chatHistory = [{ role: 'system', content: currentSystemPrompt }, ...chatHistory]
  }
  console.log('refreshed system prompt for:', profile?.userName)
}

// Delete a single message from the in-memory chat history and persist the
// change to local storage. The DisplayMessage in the UI doesn't carry the
// chat-service index, so we match by role + content (and prefer the most
// recent match if duplicates exist). This keeps the model's context aligned
// with what the user sees on-screen — without it, a deleted message would
// reappear in the next request and the model would still react to it.
export const deleteMessageFromHistory = async (
  role: 'user' | 'assistant',
  content: string,
): Promise<void> => {
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const m = chatHistory[i]
    if (m.role === role && m.content === content) {
      chatHistory.splice(i, 1)
      await saveChatHistory()
      return
    }
  }
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

    // prepare messages for api (without image fields). buildApiMessages also
    // injects a current-name reminder right before the latest user turn.
    const apiMessages = buildApiMessages(chatHistory)

    const response = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: apiMessages,
      max_tokens: 150,
      // temp ↑ from 0.8 → 1.0 to break the repetitive-template lock the small
      // model falls into ("missing you so much, what's been keeping you busy").
      // presence/frequency penalties further punish reuse of recent phrasing.
      // Tuned for small chat model: temp 0.9 keeps replies varied without
      // collapsing into gibberish. Higher penalties (0.5–0.6) over a multi-turn
      // chat caused the model to escape common English tokens by inventing
      // foreign-sounding fragments ("Cummorrow", "espacio de-coveredike",
      // "daarop"). 0.3 is the sweet spot — breaks template repetition without
      // pushing the model off the English manifold.
      temperature: 0.9,
      top_p: 0.92,
      presence_penalty: 0.3,
      frequency_penalty: 0.3,
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

    // build api messages: last user entry's content is replaced with the
    // image-instruction wrapper, and a current-name reminder is injected
    // right before that user turn by buildApiMessages.
    const apiMessages = buildApiMessages(chatHistory, apiContent)

    const response = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: apiMessages,
      max_tokens: 200,
      // Tuned for small chat model: temp 0.9 keeps replies varied without
      // collapsing into gibberish. Higher penalties (0.5–0.6) over a multi-turn
      // chat caused the model to escape common English tokens by inventing
      // foreign-sounding fragments ("Cummorrow", "espacio de-coveredike",
      // "daarop"). 0.3 is the sweet spot — breaks template repetition without
      // pushing the model off the English manifold.
      temperature: 0.9,
      top_p: 0.92,
      presence_penalty: 0.3,
      frequency_penalty: 0.3,
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

    // build context — internal-only, never shown verbatim to the user.
    // Critically: do NOT instruct Luna to gush about hearing the voice. The
    // prior wording made her open every voice-note reply with "your voice is
    // music…" / "i love hearing you…" — sounded fake and repetitive.
    // We just hand her the transcript and tell her to respond to the content.
    const transcriptPart = transcript
      ? `Transcript: "${transcript}".`
      : `(Transcription failed — keep your reply short and ask them to try again.)`
    const apiContent = `[The user sent a voice note. ${transcriptPart} Reply to what they SAID — treat the transcript as if they typed it. Do NOT comment on hearing their voice. Keep it short (1–3 sentences) per the system prompt rules.]`

    // history records a placeholder for the voice note so display & persistence
    // work, but the audio itself isn't shipped to the chat model
    chatHistory.push({
      role: 'user',
      content: '',
      audioUri,
      audioDurationMs,
    })
    const seconds = Math.max(1, Math.round(audioDurationMs / 1000))
    saveMessageToFirebaseBackend('user', transcript || `[voice note ${seconds}s]`)

    // build api messages: last user entry's content is replaced with the
    // voice-instruction wrapper, and a current-name reminder is injected
    // right before that user turn by buildApiMessages.
    const apiMessages = buildApiMessages(chatHistory, apiContent)

    const response = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: apiMessages,
      max_tokens: 200,
      // Tuned for small chat model: temp 0.9 keeps replies varied without
      // collapsing into gibberish. Higher penalties (0.5–0.6) over a multi-turn
      // chat caused the model to escape common English tokens by inventing
      // foreign-sounding fragments ("Cummorrow", "espacio de-coveredike",
      // "daarop"). 0.3 is the sweet spot — breaks template repetition without
      // pushing the model off the English manifold.
      temperature: 0.9,
      top_p: 0.92,
      presence_penalty: 0.3,
      frequency_penalty: 0.3,
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
