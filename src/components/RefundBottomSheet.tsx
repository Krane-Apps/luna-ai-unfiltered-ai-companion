// refund policy bottom sheet - 100% no questions asked refund

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Linking
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { TELEGRAM_SUPPORT_URL } from '../constants/config'

interface RefundBottomSheetProps {
  visible: boolean
  onClose: () => void
}

export const RefundBottomSheet = ({ visible, onClose }: RefundBottomSheetProps) => {
  const insets = useSafeAreaInsets()

  const openTelegram = () => {
    Linking.openURL(TELEGRAM_SUPPORT_URL)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark" size={48} color="#22c55e" />
          </View>

          {/* title */}
          <Text style={styles.title}>100% Money Back Guarantee</Text>

          {/* hero text */}
          <View style={styles.heroBox}>
            <Text style={styles.heroText}>
              Don't like Luna? Get a full refund.
            </Text>
            <Text style={styles.heroSubtext}>
              No questions asked. No hassle. Period.
            </Text>
          </View>

          {/* divider */}
          <View style={styles.divider} />

          {/* steps */}
          <Text style={styles.stepsTitle}>How to get a refund:</Text>

          <View style={styles.step}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepText}>Join our Telegram support group</Text>
              <TouchableOpacity style={styles.telegramButton} onPress={openTelegram}>
                <Text style={styles.telegramButtonText}>Join Telegram</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepText}>Send a message with:</Text>
              <Text style={styles.bulletPoint}>- Your wallet address</Text>
              <Text style={styles.bulletPoint}>- "Refund request"</Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepText}>
                We'll process your refund within 24 hours!
              </Text>
            </View>
          </View>

          {/* telegram link */}
          <View style={styles.telegramInfo}>
            <Text style={styles.telegramLabel}>Telegram:</Text>
            <Text style={styles.telegramLink}>t.me/lunaaiseeker</Text>
          </View>

          {/* close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)'
  },
  sheet: {
    backgroundColor: '#1a1a24',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 8
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 12
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16
  },
  heroBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    marginBottom: 8
  },
  heroText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22c55e',
    textAlign: 'center',
    marginBottom: 8
  },
  heroSubtext: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center'
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16
  },
  step: {
    flexDirection: 'row',
    marginBottom: 16
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 105, 180, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  stepNumber: {
    color: '#ff69b4',
    fontSize: 14,
    fontWeight: '600'
  },
  stepContent: {
    flex: 1
  },
  stepText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 22
  },
  bulletPoint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 8,
    marginTop: 4
  },
  telegramButton: {
    backgroundColor: '#0088cc',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 10
  },
  telegramButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  telegramInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20
  },
  telegramLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginRight: 8
  },
  telegramLink: {
    fontSize: 14,
    color: '#ff69b4',
    fontWeight: '500'
  },
  closeButton: {
    backgroundColor: '#ff69b4',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  }
})
