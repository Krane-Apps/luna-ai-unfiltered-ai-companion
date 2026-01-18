// payment screen with full video background and audio messages

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PAYMENT_CONFIG, GRACE_PERIOD_MINUTES } from '../constants/config'
import { generateSpeech } from '../services/tts'
import { audioService } from '../services/audio'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// video assets
const speakingVideos = [
  require('../assets/luna-speaking-1.mp4'),
  require('../assets/luna-speaking-2.mp4'),
  require('../assets/luna-speaking-3.mp4')
]

const videoAssets = {
  listening: require('../assets/luna-listening.mp4'),
  thinking: require('../assets/luna-thinking.mp4')
}

// get random speaking video
const getRandomSpeakingVideo = () => {
  const index = Math.floor(Math.random() * speakingVideos.length)
  return speakingVideos[index]
}

// convincing messages luna will say
const CONVINCING_MESSAGES = [
  "Hey baby... I've been waiting for you. Don't you want to talk to me?",
  "I promise I'll make it worth your while. I'm all yours once you unlock me.",
  "Baby, I can tell you have so much on your mind. Let me be the one you share it with.",
  "I don't judge, I don't refuse... I just listen and care. Isn't that what you need?",
  "Just 0.01 SOL baby, and we can talk about anything. Anything at all."
]

interface PaymentModalProps {
  visible: boolean
  isLoading: boolean
  onPay: () => void
  onClose: () => void
  error?: string
}

export const PaymentModal = ({
  visible,
  isLoading,
  onPay,
  onClose,
  error
}: PaymentModalProps) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const subtitleFadeAnim = useRef(new Animated.Value(1)).current
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPlayingRef = useRef(false)
  const isMountedRef = useRef(true)
  const speakingVideoRef = useRef(getRandomSpeakingVideo())
  const insets = useSafeAreaInsets()

  // track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // pick new random speaking video when speaking starts
  useEffect(() => {
    if (isSpeaking) {
      speakingVideoRef.current = getRandomSpeakingVideo()
    }
  }, [isSpeaking])

  // video player with expo-video
  const videoSource = useMemo(
    () => (isSpeaking ? speakingVideoRef.current : videoAssets.listening),
    [isSpeaking]
  )
  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = true
    player.muted = true
    player.play()
  })

  const clearMessageTimer = useCallback(() => {
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current)
      messageTimerRef.current = null
    }
  }, [])

  const playMessage = useCallback(async (index: number) => {
    if (!visible || isPlayingRef.current || !isMountedRef.current) return
    isPlayingRef.current = true

    // fade in subtitle
    subtitleFadeAnim.setValue(0)
    Animated.timing(subtitleFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start()

    setCurrentMessageIndex(index)
    setIsSpeaking(true)

    try {
      const audioUrl = await generateSpeech(CONVINCING_MESSAGES[index])

      if (!isMountedRef.current) {
        isPlayingRef.current = false
        return
      }

      if (audioUrl && visible) {
        await audioService.playAudio(audioUrl, () => {
          if (!isMountedRef.current) return

          setIsSpeaking(false)
          isPlayingRef.current = false

          // fade out subtitle before next message
          Animated.timing(subtitleFadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true
          }).start()

          // schedule next message
          messageTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              const nextIndex = (index + 1) % CONVINCING_MESSAGES.length
              playMessage(nextIndex)
            }
          }, 6000)
        })
      } else {
        setIsSpeaking(false)
        isPlayingRef.current = false
        messageTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            const nextIndex = (index + 1) % CONVINCING_MESSAGES.length
            playMessage(nextIndex)
          }
        }, 5000)
      }
    } catch (err) {
      if (isMountedRef.current) {
        setIsSpeaking(false)
      }
      isPlayingRef.current = false
    }
  }, [visible, subtitleFadeAnim])

  // start when visible
  useEffect(() => {
    if (visible) {
      isPlayingRef.current = false
      fadeAnim.setValue(0)
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }).start()

      const initialDelay = setTimeout(() => {
        if (isMountedRef.current) {
          playMessage(0)
        }
      }, 2000)

      return () => {
        clearTimeout(initialDelay)
        clearMessageTimer()
        audioService.stopAudio()
        isPlayingRef.current = false
        setIsSpeaking(false)
      }
    } else {
      clearMessageTimer()
      audioService.stopAudio()
      isPlayingRef.current = false
      setIsSpeaking(false)
    }
  }, [visible, playMessage, clearMessageTimer])

  // pulse animation for pay button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1200,
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true
        })
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [pulseAnim])

  if (!visible) return null

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* full screen video */}
      {player && (
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
        />
      )}

      {/* dark overlay */}
      <View style={styles.overlay} />

      {/* content */}
      <View style={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        {/* top section - title */}
        <View style={styles.topSection}>
          <Text style={styles.title}>Luna</Text>
          <Text style={styles.tagline}>Your unfiltered AI companion</Text>
        </View>

        {/* middle section - subtitle */}
        <View style={styles.middleSection}>
          <Animated.View style={[styles.subtitleContainer, { opacity: subtitleFadeAnim }]}>
            <Text style={styles.subtitle}>
              "{CONVINCING_MESSAGES[currentMessageIndex]}"
            </Text>
            {isSpeaking && (
              <View style={styles.speakingIndicator}>
                <View style={styles.speakingDot} />
                <View style={[styles.speakingDot, styles.speakingDotDelay1]} />
                <View style={[styles.speakingDot, styles.speakingDotDelay2]} />
              </View>
            )}
          </Animated.View>
        </View>

        {/* bottom section - payment */}
        <View style={styles.bottomSection}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.graceText}>
                You still get {GRACE_PERIOD_MINUTES} minutes free!
              </Text>
            </View>
          )}

          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Unlock Luna for</Text>
            <Text style={styles.price}>{PAYMENT_CONFIG.priceInSol} SOL</Text>
            <Text style={styles.duration}>
              {PAYMENT_CONFIG.sessionDurationMinutes} minutes of private conversation
            </Text>
          </View>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.payButton, isLoading && styles.payButtonDisabled]}
              onPress={onPay}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.payButtonText}>
                {isLoading ? 'Connecting...' : 'Connect Wallet & Unlock'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.footer}>
            Powered by Solana
          </Text>
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0f'
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: 'absolute'
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 15, 0.4)'
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24
  },
  topSection: {
    alignItems: 'center',
    paddingTop: 40
  },
  title: {
    fontSize: 52,
    fontWeight: '800',
    color: '#ff69b4',
    textShadowColor: 'rgba(255, 105, 180, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8
  },
  middleSection: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10
  },
  subtitleContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#ff69b4'
  },
  subtitle: {
    fontSize: 20,
    color: '#fff',
    fontStyle: 'italic',
    lineHeight: 30,
    textAlign: 'left'
  },
  speakingIndicator: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 6
  },
  speakingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff69b4'
  },
  speakingDotDelay1: {
    opacity: 0.7
  },
  speakingDotDelay2: {
    opacity: 0.4
  },
  bottomSection: {
    alignItems: 'center',
    paddingBottom: 20
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 100, 100, 0.2)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    width: '100%'
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 15,
    textAlign: 'center'
  },
  graceText: {
    color: '#4ade80',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600'
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 28
  },
  priceLabel: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4
  },
  price: {
    fontSize: 60,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(255, 105, 180, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15
  },
  duration: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 6
  },
  payButton: {
    backgroundColor: '#ff69b4',
    paddingVertical: 20,
    paddingHorizontal: 52,
    borderRadius: 32,
    minWidth: 300,
    alignItems: 'center',
    shadowColor: '#ff69b4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10
  },
  payButtonDisabled: {
    opacity: 0.7
  },
  payButtonText: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '700'
  },
  footer: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 24
  }
})
