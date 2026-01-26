// chat service using huggingface router with openai-compatible api

import OpenAI from 'openai'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ChatMessage, UserProfile } from '../types'
import { HF_TOKEN } from '../constants/config'
import { LUNA_SYSTEM_PROMPT } from '../constants/prompts'

const CHAT_MODEL = 'dphn/Dolphin-Mistral-24B-Venice-Edition:featherless-ai'
const CHAT_HISTORY_KEY = 'luna_chat_history'

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

  try {
    console.log('Sending request to HuggingFace Router...')

    const response = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: chatHistory,
      max_tokens: 150,
      temperature: 0.8
    })

    const assistantMessage = response.choices[0]?.message?.content ||
      "Mmm, give me a second baby... my mind wandered somewhere fun."

    chatHistory.push({ role: 'assistant', content: assistantMessage })

    // save conversation to local storage for persistence
    await saveChatHistory()

    console.log('Response:', assistantMessage)
    return assistantMessage
  } catch (error) {
    console.error('chat error:', error)
    // still save user message even if response failed
    await saveChatHistory()
    return "Sorry baby, something went wrong. Try again for me?"
  }
}

export const clearChatHistory = async (): Promise<void> => {
  chatHistory = [{ role: 'system', content: currentSystemPrompt }]
  try {
    await AsyncStorage.removeItem(CHAT_HISTORY_KEY)
  } catch (error) {
    console.error('failed to clear chat history:', error)
  }
}

export const getChatHistory = (): ChatMessage[] => {
  return [...chatHistory]
}
