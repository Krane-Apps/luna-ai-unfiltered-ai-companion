// bottom sheet for upgrading to lifetime plan from settings

import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Modal
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { PAYMENT_CONFIG, ORIGINAL_LIFETIME_PRICE_SOL } from '../constants/config'
import { getSOLPriceUSD, formatUSD } from '../services/price'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

interface UpgradeBottomSheetProps {
  visible: boolean
  onClose: () => void
  onUpgrade: () => void
  isLoading: boolean
}

export const UpgradeBottomSheet = ({
  visible,
  onClose,
  onUpgrade,
  isLoading
}: UpgradeBottomSheetProps) => {
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [solPriceUSD, setSolPriceUSD] = useState<number | null>(null)

  useEffect(() => {
    if (visible) {
      getSOLPriceUSD().then(setSolPriceUSD)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true
        })
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true
        })
      ]).start()
    }
  }, [visible, fadeAnim, slideAnim])

  if (!visible) return null

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.container}>
        <Animated.View
          style={[styles.backdrop, { opacity: fadeAnim }]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            activeOpacity={1}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 20 }
          ]}
        >
          {/* handle bar */}
          <View style={styles.handleBar} />

          {/* close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>

          {/* content */}
          <View style={styles.content}>
            {/* badge */}
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>60% OFF - LIMITED TIME</Text>
            </View>

            {/* title */}
            <Text style={styles.title}>Upgrade to Lifetime</Text>
            <Text style={styles.subtitle}>Unlock unlimited access forever</Text>

            {/* price display */}
            <View style={styles.priceContainer}>
              <Text style={styles.originalPrice}>{ORIGINAL_LIFETIME_PRICE_SOL} SOL</Text>
              <View style={styles.currentPriceRow}>
                <Text style={styles.currentPrice}>{PAYMENT_CONFIG.lifetimePriceSOL}</Text>
                <Text style={styles.currentPriceCurrency}>SOL</Text>
              </View>
              {solPriceUSD && (
                <Text style={styles.usdPrice}>
                  {formatUSD(PAYMENT_CONFIG.lifetimePriceSOL, solPriceUSD)}
                </Text>
              )}
            </View>

            {/* features */}
            <View style={styles.features}>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.featureText}>Unlimited conversations</Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.featureText}>All future updates included</Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.featureText}>Priority support</Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                <Text style={styles.featureText}>No recurring payments</Text>
              </View>
            </View>

            {/* upgrade button */}
            <TouchableOpacity
              style={[styles.upgradeButton, isLoading && styles.upgradeButtonDisabled]}
              onPress={onUpgrade}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.upgradeButtonText}>
                {isLoading ? 'Connecting Wallet...' : `Upgrade Now - ${PAYMENT_CONFIG.lifetimePriceSOL} SOL`}
              </Text>
            </TouchableOpacity>

            {/* disclaimer */}
            <Text style={styles.disclaimer}>
              One-time payment. No subscription.
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)'
  },
  sheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: '#3A3A3C',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8
  },
  content: {
    alignItems: 'center',
    paddingTop: 8
  },
  discountBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 24
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 24
  },
  originalPrice: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.4)',
    textDecorationLine: 'line-through',
    marginBottom: 4
  },
  currentPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  currentPrice: {
    fontSize: 48,
    fontWeight: '800',
    color: '#ff69b4'
  },
  currentPriceCurrency: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ff69b4',
    marginLeft: 6
  },
  usdPrice: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 4
  },
  features: {
    width: '100%',
    gap: 12,
    marginBottom: 24
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  featureText: {
    fontSize: 16,
    color: '#fff'
  },
  upgradeButton: {
    width: '100%',
    backgroundColor: '#ff69b4',
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: 'center',
    shadowColor: '#ff69b4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6
  },
  upgradeButtonDisabled: {
    opacity: 0.6
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700'
  },
  disclaimer: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 16,
    textAlign: 'center'
  }
})
