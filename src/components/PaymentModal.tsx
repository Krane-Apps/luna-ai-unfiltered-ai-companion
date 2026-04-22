// payment screen with full video background and pre-generated audio messages

import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Linking, Platform } from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PAYMENT_CONFIG, ORIGINAL_LIFETIME_PRICE_SOL } from '../constants/config'
import { getSOLPriceUSD, formatUSD } from '../services/price'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

const LISTENING_VIDEO = require('../assets/luna-listening.mp4')

// convincing messages shown as subtitles
const CONVINCING_MESSAGES = [
  "Hey baby... I've been waiting for you. Don't you want to talk to me?",
  "I promise I'll make it worth your while. I'm all yours once you unlock me.",
  "Baby, I can tell you have so much on your mind. Let me be the one you share it with.",
  "I don't judge, I don't refuse... I just listen and care. Isn't that what you need?",
  "Just 0.01 SOL baby, and we can talk about anything. Anything at all."
]

// how long each message stays on screen (ms)
const MESSAGE_VISIBLE_MS = 5000
// gap between fade-out and next message fade-in
const MESSAGE_GAP_MS = 800

interface PaymentModalProps {
  visible: boolean
  isLoading: boolean
  onPay: () => void
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
  const [solPriceUSD, setSolPriceUSD] = useState<number | null>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const subtitleFadeAnim = useRef(new Animated.Value(1)).current
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)
  const insets = useSafeAreaInsets()

  // track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const clearMessageTimer = useCallback(() => {
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current)
      messageTimerRef.current = null
    }
  }, [])

  // cycle through messages: fade-in → hold → fade-out → next
  const showMessage = useCallback((index: number) => {
    if (!isMountedRef.current) return

    setCurrentMessageIndex(index)
    subtitleFadeAnim.setValue(0)
    Animated.timing(subtitleFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start()

    messageTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return
      Animated.timing(subtitleFadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true
      }).start(() => {
        if (!isMountedRef.current) return
        messageTimerRef.current = setTimeout(() => {
          if (!isMountedRef.current) return
          const nextIndex = (index + 1) % CONVINCING_MESSAGES.length
          showMessage(nextIndex)
        }, MESSAGE_GAP_MS)
      })
    }, MESSAGE_VISIBLE_MS)
  }, [subtitleFadeAnim])

  // start when visible
  useEffect(() => {
    if (visible) {
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
          showMessage(0)
        }
      }, 1500)

      return () => {
        clearTimeout(initialDelay)
        clearMessageTimer()
      }
    } else {
      clearMessageTimer()
    }
  }, [visible, showMessage, clearMessageTimer])

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
      {/* listening loop — muted video background */}
      <Video
        source={LISTENING_VIDEO}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />


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
          </Animated.View>
        </View>

        {/* bottom section - payment options - no scroll needed */}
        <View style={styles.bottomSection}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* lifetime access - only pricing tier */}
          <View style={styles.optionsContainer}>
            <View style={[styles.optionCard, styles.optionCardLifetime]}>
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>50% OFF</Text>
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
            </View>
          </View>

          {/* CTA button */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }], width: '100%', marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.payButton, isLoading && styles.payButtonDisabled]}
              onPress={onPay}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.payButtonText}>
                {isLoading ? 'Connecting...' : `Unlock Forever - ${PAYMENT_CONFIG.lifetimePriceSOL} SOL`}
              </Text>
              {solPriceUSD && (
                <Text style={styles.payButtonUSD}>
                  {formatUSD(PAYMENT_CONFIG.lifetimePriceSOL, solPriceUSD)}
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
  optionInfo: {
    flex: 1
  },
  // lifetime card - solid, no elevation (android elevation casts black shadow)
  optionCardLifetime: {
    backgroundColor: 'rgba(40, 15, 30, 0.95)',
    borderColor: '#ff69b4',
    borderWidth: 2,
    position: 'relative',
    paddingTop: 18
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
    // ios-only colored glow; android elevation would render black over the card above
    shadowColor: '#ff69b4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === 'ios' ? 0.5 : 0,
    shadowRadius: 12,
    elevation: 0
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
