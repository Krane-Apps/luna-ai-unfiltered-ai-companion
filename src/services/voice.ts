// voice recording + whisper STT service.
// recording uses expo-av; transcription uses OpenAI's Whisper API directly
// (multipart audio upload — works with the m4a/aac files expo-av produces).

import { Audio } from 'expo-av'
import { OPENAI_API_KEY } from '../constants/config'

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

// transcribe an audio file using OpenAI's Whisper API.
// expo-av records to .m4a (AAC in MP4 container) on both iOS and Android with
// the HIGH_QUALITY preset; OpenAI accepts that as audio/mp4 multipart upload.
// returns the transcript on success, or null on any failure (caller shows the
// "Could not transcribe" alert).
export const transcribeAudio = async (uri: string): Promise<string | null> => {
  try {
    if (!OPENAI_API_KEY) {
      console.warn('[Whisper] OPENAI_API_KEY missing — cannot transcribe')
      return null
    }

    // RN's FormData accepts a {uri,name,type} blob descriptor for local files;
    // fetch handles multipart boundary automatically (don't set Content-Type).
    const form = new FormData()
    form.append('file', {
      uri,
      name: 'audio.m4a',
      type: 'audio/mp4',
    } as any)
    form.append('model', 'whisper-1')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: form,
    })

    if (!res.ok) {
      const body = await res.text()
      console.warn('[Whisper] error', res.status, body.slice(0, 200))
      return null
    }

    const data = (await res.json()) as { text?: string }
    const text = data.text?.trim() || null
    if (text) console.log('[Whisper] →', text)
    return text
  } catch (e) {
    console.warn('[Whisper] transcribe threw:', e)
    return null
  }
}
