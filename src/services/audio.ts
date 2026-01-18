// audio playback service for react native

import { Audio, AVPlaybackStatus } from 'expo-av'

class AudioService {
  private sound: Audio.Sound | null = null
  private onPlaybackComplete: (() => void) | null = null

  async initialize(): Promise<void> {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true
    })
  }

  async playAudio(audioUrl: string, onComplete?: () => void): Promise<void> {
    await this.stopAudio()

    this.onPlaybackComplete = onComplete || null

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        this.handlePlaybackStatus
      )
      this.sound = sound
    } catch (error) {
      console.error('audio playback error:', error)
      this.onPlaybackComplete?.()
    }
  }

  private handlePlaybackStatus = (status: AVPlaybackStatus): void => {
    if (status.isLoaded && status.didJustFinish) {
      this.onPlaybackComplete?.()
      this.onPlaybackComplete = null
    }
  }

  async stopAudio(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.unloadAsync()
      } catch (error) {
        console.error('error stopping audio:', error)
      }
      this.sound = null
    }
  }

  async isPlaying(): Promise<boolean> {
    if (!this.sound) return false
    try {
      const status = await this.sound.getStatusAsync()
      return status.isLoaded && status.isPlaying
    } catch {
      return false
    }
  }
}

export const audioService = new AudioService()
