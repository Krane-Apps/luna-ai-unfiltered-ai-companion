// payment screen with full video background and pre-generated audio messages

import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Linking } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PAYMENT_CONFIG, GRACE_PERIOD_MINUTES, DEV_MODE } from '../constants/config'
import { getSOLPriceUSD, formatUSD } from '../services/price'
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

// pre-generated audio files (no API calls needed - saves costs)
const audioAssets = [
  require('../assets/audio/payment-message-1.mp3'),
  require('../assets/audio/payment-message-2.mp3'),
  require('../assets/audio/payment-message-3.mp3'),
  require('../assets/audio/payment-message-4.mp3'),
  require('../assets/audio/payment-message-5.mp3')
]

// get random speaking video
const getRandomSpeakingVideo = () => {
  const index = Math.floor(Math.random() * speakingVideos.length)
  return speakingVideos[index]
}

// convincing messages luna will say (text for subtitles)
const CONVINCING_MESSAGES = [
  "Hey baby... I've been waiting for you. Don't you want to talk to me?",
  "I promise I'll make it worth your while. I'm all yours once you unlock me.",
  "Baby, I can tell you have so much on your mind. Let me be the one you share it with.",
  "I don't judge, I don't refuse... I just listen and care. Isn't that what you need?",
  "Just 0.01 SOL baby, and we can talk about anything. Anything at all."
]

export type PaymentOption = 'session' | 'lifetime'

interface PaymentModalProps {
  visible: boolean
  isLoading: boolean
  onPay: (option: PaymentOption) => void
  onClose: () => void
  onDevBypass?: () => void
  error?: string
}

export const PaymentModal = ({
  visible,
  isLoading,
  onPay,
  onClose,
  onDevBypass,
  error
}: PaymentModalProps) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [selectedOption, setSelectedOption] = useState<PaymentOption>('lifetime')
  const [solPriceUSD, setSolPriceUSD] = useState<number | null>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const subtitleFadeAnim = useRef(new Animated.Value(1)).current
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPlayingRef = useRef(false)
  const isMountedRef = useRef(true)
  const speakingVideoRef = useRef(getRandomSpeakingVideo())
  const lastVideoSourceRef = useRef(videoAssets.listening)
  const insets = useSafeAreaInsets()

  // track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // single video player - use replace() method to change source
  const player = useVideoPlayer(videoAssets.listening, (p) => {
    p.loop = true
    p.muted = true
    p.play()
  })

  // change video source using replace() method - no player recreation
  useEffect(() => {
    if (!player) return

    const newSource = isSpeaking ? speakingVideoRef.current : videoAssets.listening

    // only replace if source actually changed
    if (newSource !== lastVideoSourceRef.current) {
      lastVideoSourceRef.current = newSource
      try {
        player.replace(newSource)
        player.loop = true
        player.muted = true
        player.play()
      } catch (e) {
        // ignore errors during video transition
        console.log('video replace error:', e)
      }
    }
  }, [isSpeaking, player])

  // pick new random speaking video when speaking starts
  useEffect(() => {
    if (isSpeaking) {
      speakingVideoRef.current = getRandomSpeakingVideo()
    }
  }, [isSpeaking])

  // ensure player keeps playing
  useEffect(() => {
    if (player) {
      player.loop = true
      player.muted = true
      player.play()
    }
  }, [player])

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

    // use centralized audio service to prevent overlapping
    await audioService.playAsset(audioAssets[index], () => {
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

      // fetch SOL price
      getSOLPriceUSD().then(price => {
        if (isMountedRef.current) setSolPriceUSD(price)
      })

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
      {/* single video player - source changed via replace() */}
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

        {/* bottom section - payment options */}
        <View style={styles.bottomSection}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.graceText}>
                You still get {GRACE_PERIOD_MINUTES} minutes free!
              </Text>
            </View>
          )}

          <Text style={styles.choosePlanTitle}>Choose Your Plan</Text>

          {/* session option */}
          <TouchableOpacity
            style={[styles.optionCard, selectedOption === 'session' && styles.optionCardSelected]}
            onPress={() => setSelectedOption('session')}
            activeOpacity={0.8}
          >
            <View style={styles.optionRadio}>
              {selectedOption === 'session' && <View style={styles.optionRadioInner} />}
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Single Session</Text>
              <Text style={styles.optionPrice}>{PAYMENT_CONFIG.sessionPriceSOL} SOL</Text>
              <Text style={styles.optionDesc}>{PAYMENT_CONFIG.sessionDurationMinutes} minutes of conversation</Text>
              {solPriceUSD && (
                <Text style={styles.optionUSD}>{formatUSD(PAYMENT_CONFIG.sessionPriceSOL, solPriceUSD)}</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* lifetime option */}
          <TouchableOpacity
            style={[styles.optionCard, styles.optionCardLifetime, selectedOption === 'lifetime' && styles.optionCardSelected]}
            onPress={() => setSelectedOption('lifetime')}
            activeOpacity={0.8}
          >
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
            <View style={styles.optionRadio}>
              {selectedOption === 'lifetime' && <View style={styles.optionRadioInner} />}
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Lifetime Access</Text>
              <Text style={styles.optionPrice}>{PAYMENT_CONFIG.lifetimePriceSOL} SOL</Text>
              <Text style={styles.optionDesc}>Luna forever - unlimited conversations</Text>
              {solPriceUSD && (
                <Text style={styles.optionUSD}>{formatUSD(PAYMENT_CONFIG.lifetimePriceSOL, solPriceUSD)}</Text>
              )}
              <Text style={styles.optionSavings}>
                50 sessions = {(PAYMENT_CONFIG.sessionPriceSOL * 50).toFixed(2)} SOL. Get UNLIMITED instead!
              </Text>
            </View>
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: pulseAnim }], width: '100%', alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.payButton, isLoading && styles.payButtonDisabled]}
              onPress={() => onPay(selectedOption)}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.payButtonText}>
                {isLoading ? 'Connecting...' : `Pay ${selectedOption === 'lifetime' ? PAYMENT_CONFIG.lifetimePriceSOL : PAYMENT_CONFIG.sessionPriceSOL} SOL`}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.footer}>
            Powered by Solana
          </Text>

          <TouchableOpacity
            onPress={() => Linking.openURL('https://t.me/lunaaiseeker')}
            activeOpacity={0.7}
          >
            <Text style={styles.supportLink}>Need help? Join our Telegram</Text>
          </TouchableOpacity>

          {DEV_MODE && onDevBypass && (
            <TouchableOpacity
              style={styles.devBypassButton}
              onPress={onDevBypass}
              activeOpacity={0.7}
            >
              <Text style={styles.devBypassText}>[DEV] Skip Payment</Text>
            </TouchableOpacity>
          )}
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
    marginBottom: 16,
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
  choosePlanTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16
  },
  optionCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    width: '100%',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  optionCardSelected: {
    borderColor: '#ff69b4',
    backgroundColor: 'rgba(255, 105, 180, 0.15)'
  },
  optionCardLifetime: {
    position: 'relative',
    overflow: 'visible'
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#ff69b4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  bestValueText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800'
  },
  optionRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ff69b4',
    marginRight: 14,
    marginTop: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  optionRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff69b4'
  },
  optionContent: {
    flex: 1
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4
  },
  optionPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ff69b4'
  },
  optionDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2
  },
  optionUSD: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2
  },
  optionSavings: {
    fontSize: 12,
    color: '#4ade80',
    marginTop: 6,
    fontWeight: '600'
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
  },
  supportLink: {
    fontSize: 13,
    color: '#4ade80',
    marginTop: 12,
    textDecorationLine: 'underline'
  },
  devBypassButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 100, 100, 0.3)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff6b6b'
  },
  devBypassText: {
    fontSize: 12,
    color: '#ff6b6b',
    fontWeight: '600'
  }
})
