// main chat screen with full screen video and voice interaction

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  Keyboard,
  Platform,
  StatusBar,
  Animated,
  ScrollView,
  Linking
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { PaymentModal, PaymentOption } from '../components/PaymentModal'
import { SessionTimer } from '../components/SessionTimer'
import { OnboardingScreen } from './OnboardingScreen'
import { generateChatResponse, clearChatHistory, loadChatHistory, initializeChatWithProfile } from '../services/chat'
import { generateSpeech } from '../services/tts'
import { audioService } from '../services/audio'
import { initiatePayment, initiateLifetimePayment, getSessionState, endSession, loadSessionFromStorage } from '../services/payment'
import { loadUserProfile, getUserProfile, grantLifetimeAccess, hasLifetimeAccess, hasCompletedOnboarding } from '../services/profile'
import { WELCOME_MESSAGE } from '../constants/prompts'
import { AvatarState, UserProfile } from '../types'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// video assets - use stable references
const speakingVideos = [
  require('../assets/luna-speaking-1.mp4'),
  require('../assets/luna-speaking-2.mp4'),
  require('../assets/luna-speaking-3.mp4')
]

const videoAssets = {
  thinking: require('../assets/luna-thinking.mp4'),
  listening: require('../assets/luna-listening.mp4')
}

// get random speaking video
const getRandomSpeakingVideo = () => {
  const index = Math.floor(Math.random() * speakingVideos.length)
  return speakingVideos[index]
}

export const ChatScreen = () => {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<string>()
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [currentSubtitle, setCurrentSubtitle] = useState('')
  const [showSubtitleBox, setShowSubtitleBox] = useState(false)
  const [avatarState, setAvatarState] = useState<AvatarState>('listening')
  const pendingSubtitleRef = useRef<string>('')

  const subtitleFadeAnim = useRef(new Animated.Value(0)).current
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const keyboardHeight = useRef(new Animated.Value(0)).current
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)
  const speakingVideoRef = useRef(getRandomSpeakingVideo())
  const lastVideoSourceRef = useRef(videoAssets.listening)
  const insets = useSafeAreaInsets()

  // single video player - use replace() method to change source instead of recreating
  const player = useVideoPlayer(videoAssets.listening, (p) => {
    p.loop = true
    p.muted = true
    p.play()
  })

  // change video source using replace() method - no player recreation
  useEffect(() => {
    if (!player) return

    let newSource
    if (avatarState === 'speaking') {
      newSource = speakingVideoRef.current
    } else {
      newSource = videoAssets[avatarState]
    }

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
  }, [avatarState, player])

  // ensure player keeps playing
  useEffect(() => {
    if (player) {
      player.loop = true
      player.muted = true
      player.play()
    }
  }, [player])

  // track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // keyboard handling for android - animate input position based on keyboard height
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true)
      Animated.timing(keyboardHeight, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? 250 : 100,
        useNativeDriver: false
      }).start()
    })

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false)
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? 250 : 100,
        useNativeDriver: false
      }).start()
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [keyboardHeight])

  useEffect(() => {
    const init = async () => {
      audioService.initialize()

      // load user profile first
      const profile = await loadUserProfile()
      setUserProfile(profile)

      // initialize chat with personalized prompt if profile exists
      initializeChatWithProfile(profile)

      await loadSessionFromStorage()
      await loadChatHistory()

      // NEW FLOW: onboarding first, then payment
      // check if onboarding is completed
      if (!profile?.hasCompletedOnboarding) {
        // show onboarding first (default state)
        setShowOnboarding(true)
        setShowPayment(false)
      } else {
        // onboarding done, check payment/access
        setShowOnboarding(false)
        if (profile?.hasLifetimeAccess) {
          setShowPayment(false)
          setHasActiveSession(true)
        } else {
          checkSession()
        }
      }
    }
    init()
  }, [])

  // handle avatar state - video is already selected before setIsSpeaking is called
  useEffect(() => {
    if (isSpeaking) {
      setAvatarState('speaking')
      clearIdleTimer()
    } else if (isLoading) {
      setAvatarState('thinking')
      clearIdleTimer()
    } else {
      startIdleBehavior()
    }

    return () => clearIdleTimer()
  }, [isSpeaking, isLoading])

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }

  const startIdleBehavior = () => {
    setAvatarState('listening')
    scheduleRandomStateChange()
  }

  const scheduleRandomStateChange = () => {
    clearIdleTimer()
    const delay = 3000 + Math.random() * 5000

    idleTimerRef.current = setTimeout(() => {
      if (!isSpeaking && !isLoading) {
        setAvatarState(prev => prev === 'listening' ? 'thinking' : 'listening')
        scheduleRandomStateChange()
      }
    }, delay)
  }

  const checkSession = () => {
    const session = getSessionState()
    setHasActiveSession(session.isActive)
    setShowPayment(!session.isActive)
  }

  const handlePayment = async (option: PaymentOption) => {
    setPaymentLoading(true)
    setPaymentError(undefined)

    // choose payment method based on option
    const result = option === 'lifetime'
      ? await initiateLifetimePayment()
      : await initiatePayment()

    setPaymentLoading(false)

    if (result.success) {
      // grant lifetime access if that option was selected
      if (option === 'lifetime') {
        await grantLifetimeAccess()
      }

      setShowPayment(false)
      setHasActiveSession(true)
      // onboarding is already done (new flow), go to chat
      startConversation()
    } else {
      setPaymentError(result.error)
      const session = getSessionState()
      if (session.isActive) {
        setHasActiveSession(true)
        setTimeout(() => {
          setShowPayment(false)
          // onboarding is already done (new flow), go to chat
          startConversation()
        }, 2000)
      }
    }
  }

  // prepare subtitle but don't show yet - wait for audio
  const prepareSubtitle = (text: string) => {
    pendingSubtitleRef.current = text
  }

  // show subtitle when audio starts playing
  const showSubtitleNow = () => {
    if (!pendingSubtitleRef.current) return
    setCurrentSubtitle(pendingSubtitleRef.current)
    setShowSubtitleBox(true)
    subtitleFadeAnim.setValue(0)
    Animated.timing(subtitleFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start()
  }

  const hideSubtitle = () => {
    Animated.timing(subtitleFadeAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true
    }).start(() => {
      setCurrentSubtitle('')
      setShowSubtitleBox(false)
      pendingSubtitleRef.current = ''
    })
  }

  const startConversation = async () => {
    // personalize welcome message if we have user's name
    const profile = getUserProfile()
    const welcomeMsg = profile?.userName
      ? `Hey ${profile.userName}! ${WELCOME_MESSAGE}`
      : WELCOME_MESSAGE

    prepareSubtitle(welcomeMsg)
    // don't set speaking yet - wait for audio to be ready

    const audioUrl = await generateSpeech(welcomeMsg)
    if (audioUrl && isMountedRef.current) {
      // pick speaking video and start speaking only when audio is ready
      speakingVideoRef.current = getRandomSpeakingVideo()
      setIsSpeaking(true)
      showSubtitleNow()
      await audioService.playAudio(audioUrl, () => {
        if (isMountedRef.current) {
          setIsSpeaking(false)
          hideSubtitle()
        }
      })
    } else if (isMountedRef.current) {
      // no audio - show subtitle anyway for a few seconds
      showSubtitleNow()
      setTimeout(() => {
        if (isMountedRef.current) hideSubtitle()
      }, 3000)
    }
  }

  const handleSessionExpired = useCallback(async () => {
    // lifetime users don't expire
    if (hasLifetimeAccess()) return

    endSession()
    setHasActiveSession(false)
    setShowPayment(true)
    await clearChatHistory()
    setCurrentSubtitle('')
  }, [])

  // stop luna from speaking
  const stopSpeaking = useCallback(() => {
    audioService.stopAudio()
    setIsSpeaking(false)
    hideSubtitle()
  }, [])

  // handle onboarding completion - now shows payment after onboarding
  const handleOnboardingComplete = async () => {
    // reload profile to get updated data
    const profile = await loadUserProfile()
    setUserProfile(profile)
    // reinitialize chat with personalized prompt
    initializeChatWithProfile(profile)
    setShowOnboarding(false)

    // NEW FLOW: after onboarding, check if payment needed
    if (profile?.hasLifetimeAccess) {
      setShowPayment(false)
      setHasActiveSession(true)
      startConversation()
    } else {
      // check session state
      const session = getSessionState()
      if (session.isActive) {
        setHasActiveSession(true)
        setShowPayment(false)
        startConversation()
      } else {
        // no active session, show payment
        setShowPayment(true)
      }
    }
  }

  const sendMessage = async () => {
    // if luna is speaking, stop her first
    if (isSpeaking) {
      stopSpeaking()
    }

    if (!input.trim() || isLoading) return

    const userText = input.trim()
    setInput('')
    setIsLoading(true)

    // get ai response
    const response = await generateChatResponse(userText)

    if (!isMountedRef.current) return

    setIsLoading(false)
    prepareSubtitle(response)
    // don't set speaking yet - wait for audio to be ready

    const audioUrl = await generateSpeech(response)

    if (!isMountedRef.current) return

    if (audioUrl) {
      // pick speaking video and start speaking only when audio is ready
      speakingVideoRef.current = getRandomSpeakingVideo()
      setIsSpeaking(true)
      showSubtitleNow()
      await audioService.playAudio(audioUrl, () => {
        if (isMountedRef.current) {
          setIsSpeaking(false)
          hideSubtitle()
        }
      })
    } else {
      // no audio - show subtitle anyway
      showSubtitleNow()
      setTimeout(() => {
        if (isMountedRef.current) hideSubtitle()
      }, 4000)
    }
  }

  // dev mode bypass - grants lifetime access (persists to storage)
  const handleDevBypass = async () => {
    await grantLifetimeAccess()
    setShowPayment(false)
    setShowOnboarding(false)
    setHasActiveSession(true)
    startConversation()
  }

  // NEW FLOW: show onboarding first (before payment)
  if (showOnboarding) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </>
    )
  }

  // show payment screen after onboarding if no active session
  if (showPayment) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <PaymentModal
          visible={showPayment}
          isLoading={paymentLoading}
          onPay={handlePayment}
          onClose={() => {}}
          onDevBypass={handleDevBypass}
          error={paymentError}
        />
      </>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* single video player - source changed via replace() */}
      {player && (
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
        />
      )}

      {/* dark overlay at top only */}
      <View style={[styles.topOverlay, { height: insets.top + 60 }]} />

      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Luna</Text>
        <View style={styles.headerRight}>
          {hasActiveSession && !hasLifetimeAccess() && (
            <SessionTimer onSessionExpired={handleSessionExpired} />
          )}
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => Linking.openURL('https://t.me/lunaaiseeker')}
          >
            <Text style={styles.helpButtonText}>?</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* subtitle area - smaller box, scrollable, moves up when keyboard visible */}
      {showSubtitleBox && currentSubtitle !== '' && (
        <Animated.View style={[
          styles.subtitleContainer,
          { opacity: subtitleFadeAnim },
          keyboardVisible && styles.subtitleContainerKeyboard
        ]}>
          <ScrollView
            style={styles.subtitleScroll}
            showsVerticalScrollIndicator={true}
            persistentScrollbar={true}
          >
            <Text style={styles.subtitle}>"{currentSubtitle}"</Text>
          </ScrollView>
        </Animated.View>
      )}

      {/* loading indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Luna is thinking...</Text>
        </View>
      )}

      {/* input section - animated to move above keyboard */}
      <Animated.View
        style={[
          styles.inputAnimatedContainer,
          { bottom: keyboardHeight, paddingBottom: Math.max(insets.bottom, 16) }
        ]}
      >
        <View style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={isSpeaking ? "Type to interrupt Luna..." : "Talk to Luna..."}
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={styles.input}
              multiline
              maxLength={500}
              editable={!isLoading}
            />
            {isSpeaking ? (
              <TouchableOpacity
                style={styles.stopButton}
                onPress={stopSpeaking}
              >
                <Text style={styles.stopText}>Stop</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!input.trim() || isLoading}
              >
                <Text style={styles.sendText}>Send</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f'
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 10, 15, 0.6)'
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ff69b4',
    textShadowColor: 'rgba(255, 105, 180, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  helpButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  helpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  subtitleContainer: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    right: 16,
    maxHeight: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ff69b4'
  },
  subtitleContainerKeyboard: {
    bottom: 320
  },
  subtitleScroll: {
    maxHeight: 76
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    fontStyle: 'italic',
    lineHeight: 20
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center'
  },
  loadingText: {
    fontSize: 14,
    color: '#ff69b4',
    fontStyle: 'italic'
  },
  inputAnimatedContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 10, 15, 0.9)'
  },
  inputWrapper: {
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'flex-end',
    gap: 12
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    maxHeight: 120,
    minHeight: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 105, 180, 0.4)'
  },
  sendButton: {
    backgroundColor: '#ff69b4',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
    justifyContent: 'center',
    shadowColor: '#ff69b4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6
  },
  sendButtonDisabled: {
    opacity: 0.4
  },
  sendText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16
  },
  stopButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
    justifyContent: 'center',
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6
  },
  stopText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16
  }
})
