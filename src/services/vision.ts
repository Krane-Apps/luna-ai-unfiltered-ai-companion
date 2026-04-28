// vision service for analyzing images using huggingface router

import OpenAI from 'openai'
import { HF_TOKEN } from '../constants/config'
import * as FileSystem from 'expo-file-system/legacy'
import { isNetworkError, showNetworkError } from './api'

// use qwen vision model via openai-compatible api
const VISION_MODEL = 'meta-llama/Llama-3.2-11B-Vision-Instruct'

let visionClient: OpenAI | null = null

const getVisionClient = (): OpenAI => {
  if (!visionClient) {
    visionClient = new OpenAI({
      baseURL: 'https://router.huggingface.co/v1',
      apiKey: HF_TOKEN,
      dangerouslyAllowBrowser: true
    })
  }
  return visionClient
}

// analyze image and return description
export const analyzeImage = async (imageUri: string): Promise<string> => {
  try {
    // read image as base64 using legacy api (sdk 54+)
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64
    })

    // create data url for the image
    const imageDataUrl = `data:image/jpeg;base64,${base64}`

    const client = getVisionClient()

    // use openai-compatible vision api
    const response = await client.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this image in one short sentence. Be concise.'
            },
            {
              type: 'image_url',
              image_url: { url: imageDataUrl }
            }
          ]
        }
      ],
      max_tokens: 100
    })

    const caption = response.choices[0]?.message?.content?.trim()

    if (caption) {
      console.log('image analysis:', caption)
      return caption
    }

    return 'an image'
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn('[Vision] network error')
      showNetworkError()
    } else {
      console.error('failed to analyze image:', error)
    }
    return 'an image'
  }
}

// convert image uri to base64
export const imageToBase64 = async (imageUri: string): Promise<string | null> => {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64
    })
    return base64
  } catch (error) {
    console.error('failed to convert image to base64:', error)
    return null
  }
}
