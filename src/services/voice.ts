// voice recording + whisper STT service

import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system/legacy'
import { HF_TOKEN } from '../constants/config'

let recording: Audio.Recording | null = null

export const startRecording = async (): Promise<boolean> => {
  try {
    const { granted } = await Audio.requestPermissionsAsync()
    if (!granted) return false

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    })

    const { recording: rec } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    )
    recording = rec
    return true
  } catch (e) {
    console.error('startRecording error:', e)
    return false
  }
}

export const pauseRecording = async (): Promise<boolean> => {
  if (!recording) return false
  try {
    await recording.pauseAsync()
    return true
  } catch (e) {
    console.error('pauseRecording error:', e)
    return false
  }
}

export const resumeRecording = async (): Promise<boolean> => {
  if (!recording) return false
  try {
    await recording.startAsync()
    return true
  } catch (e) {
    console.error('resumeRecording error:', e)
    return false
  }
}

export const cancelRecording = async (): Promise<void> => {
  if (!recording) return
  try {
    await recording.stopAndUnloadAsync()
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
  } catch (e) {
    console.error('cancelRecording error:', e)
  } finally {
    recording = null
  }
}

export const stopRecording = async (): Promise<string | null> => {
  if (!recording) return null
  try {
    await recording.stopAndUnloadAsync()
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
    const uri = recording.getURI()
    recording = null
    return uri ?? null
  } catch (e) {
    console.error('stopRecording error:', e)
    recording = null
    return null
  }
}

// hf-inference whisper-large-v3-turbo via HF Router.
// the Router-proxied endpoint only accepts JSON (the legacy raw-binary
// api-inference.huggingface.co path is deprecated and returns 404; the new
// Router path returns 400 if you POST raw bytes — only application/json
// is accepted now). so we read the recording as base64 and send it as
// {"inputs": "<base64>"} — confirmed shape from HF inference docs.
export const transcribeAudio = async (uri: string): Promise<string | null> => {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    })

    const res = await fetch(
      'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: `data:audio/mp4;base64,${base64}` }),
      }
    )

    if (!res.ok) {
      const body = await res.text()
      console.warn('[Whisper] hf-inference →', res.status, body.slice(0, 200))
      return null
    }

    const data = (await res.json()) as { text?: string }
    const text = data.text?.trim() || null
    if (text) console.log('[Whisper] hf-inference →', text)
    return text
  } catch (e) {
    console.warn('[Whisper] transcribe threw:', e)
    return null
  }
}
