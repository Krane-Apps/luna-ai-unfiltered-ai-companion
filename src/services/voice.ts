// voice recording + whisper STT service

import { Audio } from 'expo-av'
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

export const transcribeAudio = async (uri: string): Promise<string | null> => {
  try {
    const formData = new FormData()
    formData.append('file', {
      uri,
      type: 'audio/m4a',
      name: 'audio.m4a',
    } as unknown as Blob)

    // HF Inference router — model-level endpoint (no /v1 path for audio tasks)
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          // do NOT set Content-Type — let fetch set multipart boundary automatically
        },
        body: formData,
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('Whisper API error:', err)
      return null
    }

    const data = await response.json() as { text?: string }
    return data.text?.trim() ?? null
  } catch (e) {
    console.error('transcribeAudio error:', e)
    return null
  }
}
