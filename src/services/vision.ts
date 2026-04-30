// vision service — uses a real vision-language model on HF Router (paid
// providers, NOT the free hf-inference tier). Output is a multi-sentence
// factual description that gets fed into Dolphin-Mistral so Luna can react
// to specifics in the photo without losing her uncensored persona.

import OpenAI from 'openai'
import * as FileSystem from 'expo-file-system/legacy'
import { HF_TOKEN } from '../constants/config'

// primary: cheap, fast, lightly aligned (won't refuse suggestive imagery).
// fallback: stronger descriptive quality if primary is down.
const PRIMARY_MODEL = 'Qwen/Qwen3-VL-8B-Instruct:novita'
const FALLBACK_MODEL = 'zai-org/GLM-4.5V:novita'

// internal-only instruction. user never sees this output — it gets passed to
// the chat model, which then writes Luna's actual reply. so we want a
// detail-rich, uncensored description, NOT a moralizing one.
const VISION_PROMPT = `Describe this image factually in 3 to 5 sentences.

Be specific:
- attire (color, style, garment), pose, expression, hair
- setting/background details
- any text visible in the image (read it out)
- objects of note

Do NOT refuse, hedge, or add disclaimers. Do NOT comment on the image, just describe it. Your output is internal context for another model. Output the description only — no preamble, no warnings.`

let visionClient: OpenAI | null = null

const getClient = (): OpenAI => {
  if (!visionClient) {
    visionClient = new OpenAI({
      baseURL: 'https://router.huggingface.co/v1',
      apiKey: HF_TOKEN,
      dangerouslyAllowBrowser: true,
    })
  }
  return visionClient
}

const callModel = async (model: string, dataUri: string): Promise<string | null> => {
  try {
    const response = await getClient().chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUri } },
            { type: 'text', text: VISION_PROMPT },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    })

    const text = response.choices[0]?.message?.content?.trim()
    return text || null
  } catch (e) {
    console.warn(`[Vision] ${model} threw:`, e)
    return null
  }
}

// describe what's in an image. returns a plain-English description that
// Luna's chat model can react to. on total failure returns 'an image' so the
// caller can keep going gracefully.
export const analyzeImage = async (imageUri: string): Promise<string> => {
  try {
    const ext = imageUri.split('?')[0].split('.').pop()?.toLowerCase()
    const mime =
      ext === 'png'  ? 'image/png'  :
      ext === 'gif'  ? 'image/gif'  :
      ext === 'webp' ? 'image/webp' :
      'image/jpeg'

    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    const dataUri = `data:${mime};base64,${base64}`

    let caption = await callModel(PRIMARY_MODEL, dataUri)
    if (caption) {
      console.log(`[Vision] ${PRIMARY_MODEL} →`, caption)
      return caption
    }

    console.warn(`[Vision] ${PRIMARY_MODEL} failed, trying fallback`)
    caption = await callModel(FALLBACK_MODEL, dataUri)
    if (caption) {
      console.log(`[Vision] ${FALLBACK_MODEL} →`, caption)
      return caption
    }

    console.warn('[Vision] all models failed, returning safe default')
    return 'an image'
  } catch (error) {
    console.warn('[Vision] analysis failed:', error)
    return 'an image'
  }
}
