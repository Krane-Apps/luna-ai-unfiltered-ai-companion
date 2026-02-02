// text-to-speech service using huggingface inference client

import { InferenceClient } from '@huggingface/inference'
import { HF_TOKEN } from '../constants/config'
import { isNetworkError } from './api'

let ttsClient: InferenceClient | null = null

const getClient = (): InferenceClient => {
  if (!ttsClient) {
    ttsClient = new InferenceClient(HF_TOKEN)
  }
  return ttsClient
}

// convert blob to base64 data url
const blobToDataUrl = async (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export const generateSpeech = async (text: string): Promise<string | null> => {
  const shortText = text.substring(0, 40) + (text.length > 40 ? '...' : '')
  try {
    console.log('[TTS] generating:', shortText)

    const client = getClient()

    // use kokoro model with fal-ai provider
    const response = await client.textToSpeech({
      inputs: text,
      model: 'hexgrad/Kokoro-82M',
      provider: 'fal-ai'
    })

    // convert blob to data url for audio playback
    const dataUrl = await blobToDataUrl(response)
    console.log('[TTS] done:', shortText)
    return dataUrl
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn('[TTS] network error, skipping:', shortText)
    } else {
      console.error('[TTS] error for:', shortText, error)
    }
    return null
  }
}
