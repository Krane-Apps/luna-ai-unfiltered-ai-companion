// vision service — image-to-text via HF router hf-inference (same as Whisper)

import { HF_TOKEN } from '../constants/config'
import * as FileSystem from 'expo-file-system/legacy'

const BLIP_URL = 'https://router.huggingface.co/hf-inference/models/Salesforce/blip-image-captioning-large'

// analyze image — returns a plain-English description Luna can react to
export const analyzeImage = async (imageUri: string): Promise<string> => {
  try {
    const ext = imageUri.split('?')[0].split('.').pop()?.toLowerCase()
    const mime =
      ext === 'png'  ? 'image/png'  :
      ext === 'gif'  ? 'image/gif'  :
      ext === 'webp' ? 'image/webp' :
      'image/jpeg'

    // uploadAsync sends raw binary directly from the file path — no fetch(data:) hacks
    const result = await FileSystem.uploadAsync(BLIP_URL, imageUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': mime,
      },
    })

    if (result.status !== 200) {
      console.warn('[Vision] API error:', result.status, result.body?.slice(0, 200))

      // model cold-starting — retry once after 8s
      if (result.status === 503) {
        console.log('[Vision] model loading, retrying in 8s...')
        await new Promise((r) => setTimeout(r, 8000))
        const retry = await FileSystem.uploadAsync(BLIP_URL, imageUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            'Content-Type': mime,
          },
        })
        if (retry.status === 200) {
          const retryData = JSON.parse(retry.body) as Array<{ generated_text?: string }>
          const caption = retryData[0]?.generated_text?.trim()
          if (caption) { console.log('[Vision] retry caption:', caption); return caption }
        }
      }
      return 'an image'
    }

    const data = JSON.parse(result.body) as Array<{ generated_text?: string }>
    const caption = data[0]?.generated_text?.trim()

    if (caption) {
      console.log('[Vision] caption:', caption)
      return caption
    }

    return 'an image'
  } catch (error) {
    console.warn('[Vision] failed, continuing without caption:', error)
    return 'an image'
  }
}

// convert image uri to base64
export const imageToBase64 = async (imageUri: string): Promise<string | null> => {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    return base64
  } catch (error) {
    console.error('failed to convert image to base64:', error)
    return null
  }
}
