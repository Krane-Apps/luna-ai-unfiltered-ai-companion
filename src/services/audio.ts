// centralized audio playback service - single source of truth for all audio in the app

import { Audio, AVPlaybackStatus } from 'expo-av'

type AudioStateListener = (isPlaying: boolean) => void

class AudioManager {
  private sound: Audio.Sound | null = null
  private onPlaybackComplete: (() => void) | null = null
  private isCurrentlyPlaying: boolean = false
  private listeners: Set<AudioStateListener> = new Set()
  private playbackId: number = 0 // track current playback to handle race conditions

  async initialize(): Promise<void> {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true
    })
  }

  // subscribe to audio state changes
  subscribe(listener: AudioStateListener): () => void {
    this.listeners.add(listener)
    // immediately notify of current state
    listener(this.isCurrentlyPlaying)
    // return unsubscribe function
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.isCurrentlyPlaying))
  }

  private setPlaying(playing: boolean): void {
    if (this.isCurrentlyPlaying !== playing) {
      this.isCurrentlyPlaying = playing
      this.notifyListeners()
    }
  }

  // play audio from URL (TTS generated audio)
  async playAudio(audioUrl: string, onComplete?: () => void): Promise<void> {
    // stop any currently playing audio first
    await this.stopAudio()

    const currentPlaybackId = ++this.playbackId
    this.onPlaybackComplete = onComplete || null

    try {
      this.setPlaying(true)
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        (status) => this.handlePlaybackStatus(status, currentPlaybackId)
      )

      // check if this playback was cancelled while loading
      if (this.playbackId !== currentPlaybackId) {
        await sound.unloadAsync()
        return
      }

      this.sound = sound
    } catch (error) {
      console.error('audio playback error:', error)
      this.setPlaying(false)
      this.onPlaybackComplete?.()
      this.onPlaybackComplete = null
    }
  }

  // play audio from local asset (pre-recorded files)
  async playAsset(asset: any, onComplete?: () => void): Promise<void> {
    // stop any currently playing audio first
    await this.stopAudio()

    const currentPlaybackId = ++this.playbackId
    this.onPlaybackComplete = onComplete || null

    try {
      this.setPlaying(true)
      const { sound } = await Audio.Sound.createAsync(
        asset,
        { shouldPlay: true },
        (status) => this.handlePlaybackStatus(status, currentPlaybackId)
      )

      // check if this playback was cancelled while loading
      if (this.playbackId !== currentPlaybackId) {
        await sound.unloadAsync()
        return
      }

      this.sound = sound
    } catch (error) {
      console.error('asset playback error:', error)
      this.setPlaying(false)
      this.onPlaybackComplete?.()
      this.onPlaybackComplete = null
    }
  }

  private handlePlaybackStatus = (status: AVPlaybackStatus, playbackId: number): void => {
    // ignore callbacks from previous playbacks
    if (playbackId !== this.playbackId) return

    if (status.isLoaded && status.didJustFinish) {
      this.setPlaying(false)
      this.onPlaybackComplete?.()
      this.onPlaybackComplete = null
    }
  }

  async stopAudio(): Promise<void> {
    // increment playback id to invalidate any pending callbacks
    this.playbackId++

    if (this.sound) {
      try {
        await this.sound.stopAsync()
        await this.sound.unloadAsync()
      } catch (error) {
        // ignore errors when stopping
      }
      this.sound = null
    }

    this.setPlaying(false)
    this.onPlaybackComplete = null
  }

  isPlaying(): boolean {
    return this.isCurrentlyPlaying
  }

  // async version for backward compatibility
  async checkIsPlaying(): Promise<boolean> {
    return this.isCurrentlyPlaying
  }
}

// singleton instance
export const audioService = new AudioManager()
