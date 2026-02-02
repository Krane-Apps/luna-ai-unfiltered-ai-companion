// payment screen with full video background and pre-generated audio messages

import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Linking } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PAYMENT_CONFIG, ORIGINAL_LIFETIME_PRICE_SOL } from '../constants/config'
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

export type PaymentOption = 'single' | 'weekly' | 'lifetime'

interface PaymentModalProps {
  visible: boolean
  isLoading: boolean
  onPay: (option: PaymentOption) => void
  onShowRefund?: () => void
  onRestoreSubscription?: () => void
  isRestoringSubscription?: boolean
  error?: string
}

export const PaymentModal = ({
  visible,
  isLoading,
  onPay,
  onShowRefund,
  onRestoreSubscription,
  isRestoringSubscription,
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

        {/* bottom section - payment options - no scroll needed */}
        <View style={styles.bottomSection}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* 2 options: 30 min session + lifetime (selected by default) */}
          <View style={styles.optionsContainer}>
            {/* lifetime - highlighted and selected by default */}
            <TouchableOpacity
              style={[styles.optionCard, styles.optionCardLifetime, selectedOption === 'lifetime' && styles.optionCardLifetimeSelected]}
              onPress={() => setSelectedOption('lifetime')}
              activeOpacity={0.8}
            >
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>60% OFF</Text>
              </View>
              <View style={styles.optionRadioLifetime}>
                {selectedOption === 'lifetime' && <View style={styles.optionRadioInnerLifetime} />}
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitleLifetime}>Lifetime Access</Text>
                <Text style={styles.optionDescLifetime}>Unlimited forever + all updates</Text>
                <Text style={styles.limitedTimeText}>Limited time offer</Text>
              </View>
              <View style={styles.optionPriceBoxLifetime}>
                <Text style={styles.originalPrice}>{ORIGINAL_LIFETIME_PRICE_SOL} SOL</Text>
                <View style={styles.discountedPriceRow}>
                  <Text style={styles.optionPriceLifetime}>{PAYMENT_CONFIG.lifetimePriceSOL}</Text>
                  <Text style={styles.optionCurrencyLifetime}>SOL</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* 30 min session */}
            <TouchableOpacity
              style={[styles.optionCard, selectedOption === 'single' && styles.optionCardSelected]}
              onPress={() => setSelectedOption('single')}
              activeOpacity={0.8}
            >
              <View style={styles.optionRadio}>
                {selectedOption === 'single' && <View style={styles.optionRadioInner} />}
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>30 Min Session</Text>
                <Text style={styles.optionDesc}>Try it out first</Text>
              </View>
              <View style={styles.optionPriceBox}>
                <Text style={styles.optionPrice}>{PAYMENT_CONFIG.singleChatPriceSOL}</Text>
                <Text style={styles.optionCurrency}>SOL</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* CTA button */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }], width: '100%', marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.payButton, isLoading && styles.payButtonDisabled]}
              onPress={() => onPay(selectedOption)}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.payButtonText}>
                {isLoading ? 'Connecting...' : selectedOption === 'lifetime'
                  ? `Unlock Forever - ${PAYMENT_CONFIG.lifetimePriceSOL} SOL`
                  : `Pay ${PAYMENT_CONFIG.singleChatPriceSOL} SOL`
                }
              </Text>
              {solPriceUSD && (
                <Text style={styles.payButtonUSD}>
                  {formatUSD(
                    selectedOption === 'lifetime' ? PAYMENT_CONFIG.lifetimePriceSOL : PAYMENT_CONFIG.singleChatPriceSOL,
                    solPriceUSD
                  )}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* trust row */}
          <View style={styles.trustRow}>
            {onShowRefund && (
              <TouchableOpacity onPress={onShowRefund} activeOpacity={0.7}>
                <Text style={styles.trustLink}>Don't like it? 100% refund</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => Linking.openURL('https://t.me/lunaaiseeker')}
              activeOpacity={0.7}
            >
              <Text style={styles.trustLink}>Help</Text>
            </TouchableOpacity>
          </View>

          {/* restore subscription button */}
          {onRestoreSubscription && (
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={onRestoreSubscription}
              disabled={isRestoringSubscription}
              activeOpacity={0.7}
            >
              <Text style={styles.restoreText}>
                {isRestoringSubscription ? 'Checking...' : 'I already have a subscription'}
              </Text>
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
    backgroundColor: 'rgba(10, 10, 15, 0.65)'
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
    paddingBottom: 16
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 100, 100, 0.3)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10
  },
  errorText: {
    color: '#ff8a8a',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600'
  },
  optionsContainer: {
    gap: 8
  },
  // compact option card - horizontal layout
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  optionCardSelected: {
    borderColor: '#ff69b4',
    backgroundColor: 'rgba(255, 105, 180, 0.25)'
  },
  optionRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  optionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff69b4'
  },
  optionInfo: {
    flex: 1
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff'
  },
  optionDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 1
  },
  optionPriceBox: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  optionPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff'
  },
  optionCurrency: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 4
  },
  // lifetime card - highlighted
  optionCardLifetime: {
    backgroundColor: 'rgba(255, 105, 180, 0.2)',
    borderColor: 'rgba(255, 105, 180, 0.5)',
    position: 'relative',
    paddingTop: 18
  },
  optionCardLifetimeSelected: {
    borderColor: '#ff69b4',
    backgroundColor: 'rgba(255, 105, 180, 0.35)',
    shadowColor: '#ff69b4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6
  },
  discountBadge: {
    position: 'absolute',
    top: -10,
    right: 14,
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  limitedTimeText: {
    fontSize: 11,
    color: '#22c55e',
    fontWeight: '600',
    marginTop: 2
  },
  optionPriceBoxLifetime: {
    alignItems: 'flex-end'
  },
  originalPrice: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    textDecorationLine: 'line-through',
    marginBottom: 2
  },
  discountedPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  optionRadioLifetime: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#ff69b4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  optionRadioInnerLifetime: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff69b4'
  },
  optionTitleLifetime: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff'
  },
  optionDescLifetime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 1
  },
  optionPriceLifetime: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ff69b4'
  },
  optionCurrencyLifetime: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff69b4',
    marginLeft: 4
  },
  payButton: {
    backgroundColor: '#ff69b4',
    paddingVertical: 16,
    borderRadius: 26,
    alignItems: 'center',
    shadowColor: '#ff69b4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8
  },
  payButtonDisabled: {
    opacity: 0.7
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700'
  },
  payButtonUSD: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginTop: 2
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12
  },
  trustLink: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textDecorationLine: 'underline'
  },
  restoreButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center'
  },
  restoreText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    textDecorationLine: 'underline'
  }
})
