// twitter share banner for free lifetime access

import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Linking,
  Alert
} from 'react-native'
import { submitTwitterShare } from '../services/api'
import { grantLifetimeAccess, hasLifetimeAccess } from '../services/profile'
import { TELEGRAM_SUPPORT_URL } from '../constants/config'

interface TwitterShareBannerProps {
  onLifetimeGranted: () => void
}

const TWEET_TEXT = "I've been chatting with Luna AI - my virtual girlfriend! She sends me sweet messages throughout the day. Try it out! #LunaAI #AI #VirtualGirlfriend"
const TWITTER_URL = `https://twitter.com/intent/tweet?text=${encodeURIComponent(TWEET_TEXT)}`

export const TwitterShareBanner = ({ onLifetimeGranted }: TwitterShareBannerProps) => {
  const [showModal, setShowModal] = useState(false)
  const [tweetUrl, setTweetUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showRefundInfo, setShowRefundInfo] = useState(false)

  // don't show banner if already has lifetime access
  if (hasLifetimeAccess()) {
    return null
  }

  const handleSharePress = () => {
    setShowModal(true)
  }

  const openTwitter = () => {
    Linking.openURL(TWITTER_URL)
  }

  const validateAndSubmit = async () => {
    if (!tweetUrl.trim()) {
      Alert.alert('Missing URL', 'Please paste your tweet URL')
      return
    }

    // basic validation
    const isValid =
      (tweetUrl.includes('twitter.com') || tweetUrl.includes('x.com')) &&
      tweetUrl.includes('/status/')

    if (!isValid) {
      Alert.alert(
        'Invalid URL',
        'Please paste a valid Twitter/X post URL. It should look like: twitter.com/username/status/123...'
      )
      return
    }

    setIsLoading(true)

    try {
      // submit to backend
      const success = await submitTwitterShare(tweetUrl)

      if (success) {
        // grant lifetime access locally
        await grantLifetimeAccess()

        setShowModal(false)
        setTweetUrl('')

        // check if user might have already paid
        // (we'll show refund info after granting access)
        Alert.alert(
          'Lifetime Access Granted!',
          'Thank you for sharing! You now have free lifetime access to Luna.',
          [
            {
              text: 'Already Paid? Get Refund',
              onPress: () => setShowRefundInfo(true)
            },
            { text: 'Awesome!', style: 'default' }
          ]
        )

        onLifetimeGranted()
      } else {
        Alert.alert('Error', 'Failed to verify your tweet. Please try again.')
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const openTelegramForRefund = () => {
    setShowRefundInfo(false)
    Linking.openURL(TELEGRAM_SUPPORT_URL)
  }

  return (
    <>
      {/* banner */}
      <TouchableOpacity style={styles.banner} onPress={handleSharePress}>
        <Text style={styles.bannerIcon}>*</Text>
        <View style={styles.bannerTextContainer}>
          <Text style={styles.bannerTitle}>Share & Get FREE Lifetime Access!</Text>
          <Text style={styles.bannerSubtitle}>Already paid? We'll refund you!</Text>
        </View>
        <Text style={styles.bannerArrow}>Share</Text>
      </TouchableOpacity>

      {/* share modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Get Free Lifetime Access</Text>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Share on Twitter/X</Text>
                <Text style={styles.stepDesc}>Post about Luna AI on your Twitter</Text>
                <TouchableOpacity style={styles.twitterButton} onPress={openTwitter}>
                  <Text style={styles.twitterButtonText}>Open Twitter</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Paste Your Tweet URL</Text>
                <Text style={styles.stepDesc}>Copy the link to your tweet and paste below</Text>
                <TextInput
                  style={styles.input}
                  value={tweetUrl}
                  onChangeText={setTweetUrl}
                  placeholder="https://twitter.com/..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={validateAndSubmit}
              disabled={isLoading}
            >
              <Text style={styles.submitButtonText}>
                {isLoading ? 'Verifying...' : 'Get Lifetime Access'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.cancelButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* refund info modal */}
      <Modal
        visible={showRefundInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRefundInfo(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Already Paid?</Text>
            <Text style={styles.refundText}>
              If you already purchased lifetime access, we'll refund you 100% - no questions asked!
            </Text>
            <Text style={styles.refundText}>
              Just message us on Telegram with your wallet address and we'll process your refund within 24 hours.
            </Text>

            <TouchableOpacity style={styles.submitButton} onPress={openTelegramForRefund}>
              <Text style={styles.submitButtonText}>Open Telegram</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowRefundInfo(false)}
            >
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 105, 180, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 105, 180, 0.3)'
  },
  bannerIcon: {
    fontSize: 20,
    marginRight: 8,
    color: '#ff69b4'
  },
  bannerTextContainer: {
    flex: 1
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff'
  },
  bannerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2
  },
  bannerArrow: {
    fontSize: 12,
    color: '#ff69b4',
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#1a1a24',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24
  },
  step: {
    flexDirection: 'row',
    marginBottom: 20
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 105, 180, 0.2)',
    color: '#ff69b4',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 28,
    marginRight: 12
  },
  stepContent: {
    flex: 1
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4
  },
  stepDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 10
  },
  twitterButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  twitterButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,105,180,0.3)'
  },
  submitButton: {
    backgroundColor: '#ff69b4',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16
  },
  submitButtonDisabled: {
    opacity: 0.6
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  cancelButton: {
    paddingVertical: 12,
    marginTop: 8
  },
  cancelButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center'
  },
  refundText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20
  }
})
