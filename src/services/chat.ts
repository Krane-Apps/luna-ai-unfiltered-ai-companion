// chat service using huggingface router with openai-compatible api

import OpenAI from 'openai'
import { ChatMessage } from '../types'
import { HF_TOKEN } from '../constants/config'
import { LUNA_SYSTEM_PROMPT } from '../constants/prompts'

const CHAT_MODEL = 'dphn/Dolphin-Mistral-24B-Venice-Edition:featherless-ai'

let chatClient: OpenAI | null = null
let chatHistory: ChatMessage[] = [
  { role: 'system', content: LUNA_SYSTEM_PROMPT }
]

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

    console.log('Response:', assistantMessage)
    return assistantMessage
  } catch (error) {
    console.error('chat error:', error)
    return "Sorry baby, something went wrong. Try again for me?"
  }
}

export const clearChatHistory = (): void => {
  chatHistory = [{ role: 'system', content: LUNA_SYSTEM_PROMPT }]
}

export const getChatHistory = (): ChatMessage[] => {
  return [...chatHistory]
}
