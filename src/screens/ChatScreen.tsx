// main chat screen with full screen video and voice interaction

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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
  Animated
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { PaymentModal } from '../components/PaymentModal'
import { SessionTimer } from '../components/SessionTimer'
import { generateChatResponse, clearChatHistory } from '../services/chat'
import { generateSpeech } from '../services/tts'
import { audioService } from '../services/audio'
import { initiatePayment, getSessionState, endSession, loadSessionFromStorage } from '../services/payment'
import { WELCOME_MESSAGE } from '../constants/prompts'
import { AvatarState } from '../types'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// video assets
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
  const [showPayment, setShowPayment] = useState(true)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<string>()
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const [currentSubtitle, setCurrentSubtitle] = useState('')
  const [avatarState, setAvatarState] = useState<AvatarState>('listening')

  const subtitleFadeAnim = useRef(new Animated.Value(0)).current
  const keyboardHeight = useRef(new Animated.Value(0)).current
  const videoFadeAnim = useRef(new Animated.Value(1)).current
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)
  const speakingVideoRef = useRef(getRandomSpeakingVideo())
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A')
  const [videoSourceA, setVideoSourceA] = useState(videoAssets.listening)
  const [videoSourceB, setVideoSourceB] = useState(videoAssets.thinking)
  const insets = useSafeAreaInsets()

  // dual video players for smooth crossfade
  const playerA = useVideoPlayer(videoSourceA, (p) => {
    p.loop = true
    p.muted = true
    p.play()
  })

  const playerB = useVideoPlayer(videoSourceB, (p) => {
    p.loop = true
    p.muted = true
    p.play()
  })

  // smooth video transition when avatar state changes
  useEffect(() => {
    let newSource
    if (avatarState === 'speaking') {
      newSource = speakingVideoRef.current
    } else {
      newSource = videoAssets[avatarState]
    }

    // load new source into inactive player, then crossfade
    if (activePlayer === 'A') {
      setVideoSourceB(newSource)
      // small delay to let new video load
      setTimeout(() => {
        Animated.timing(videoFadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true
        }).start(() => {
          setActivePlayer('B')
        })
      }, 50)
    } else {
      setVideoSourceA(newSource)
      setTimeout(() => {
        Animated.timing(videoFadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }).start(() => {
          setActivePlayer('A')
        })
      }, 50)
    }
  }, [avatarState])

  // ensure players keep playing
  useEffect(() => {
    if (playerA) {
      playerA.loop = true
      playerA.muted = true
      playerA.play()
    }
  }, [playerA, videoSourceA])

  useEffect(() => {
    if (playerB) {
      playerB.loop = true
      playerB.muted = true
      playerB.play()
    }
  }, [playerB, videoSourceB])

  // track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // keyboard handling for android
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardHeight, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? 250 : 100,
        useNativeDriver: false
      }).start()
    })

    const hideSub = Keyboard.addListener(hideEvent, () => {
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
      await loadSessionFromStorage()
      checkSession()
    }
    init()
  }, [])

  // handle avatar state
  useEffect(() => {
    if (isSpeaking) {
      // pick a new random speaking video each time
      speakingVideoRef.current = getRandomSpeakingVideo()
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

  const handlePayment = async () => {
    setPaymentLoading(true)
    setPaymentError(undefined)

    const result = await initiatePayment()

    setPaymentLoading(false)

    if (result.success) {
      setShowPayment(false)
      setHasActiveSession(true)
      startConversation()
    } else {
      setPaymentError(result.error)
      const session = getSessionState()
      if (session.isActive) {
        setHasActiveSession(true)
        setTimeout(() => {
          setShowPayment(false)
          startConversation()
        }, 2000)
      }
    }
  }

  const showSubtitle = (text: string) => {
    setCurrentSubtitle(text)
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
    })
  }

  const startConversation = async () => {
    showSubtitle(WELCOME_MESSAGE)
    setIsSpeaking(true)

    const audioUrl = await generateSpeech(WELCOME_MESSAGE)
    if (audioUrl && isMountedRef.current) {
      await audioService.playAudio(audioUrl, () => {
        if (isMountedRef.current) {
          setIsSpeaking(false)
          hideSubtitle()
        }
      })
    } else if (isMountedRef.current) {
      setIsSpeaking(false)
      setTimeout(() => {
        if (isMountedRef.current) hideSubtitle()
      }, 3000)
    }
  }

  const handleSessionExpired = useCallback(() => {
    endSession()
    setHasActiveSession(false)
    setShowPayment(true)
    clearChatHistory()
    setCurrentSubtitle('')
  }, [])

  // stop luna from speaking
  const stopSpeaking = useCallback(() => {
    audioService.stopAudio()
    setIsSpeaking(false)
    hideSubtitle()
  }, [])

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
    showSubtitle(response)
    setIsSpeaking(true)

    const audioUrl = await generateSpeech(response)

    if (!isMountedRef.current) return

    if (audioUrl) {
      await audioService.playAudio(audioUrl, () => {
        if (isMountedRef.current) {
          setIsSpeaking(false)
          hideSubtitle()
        }
      })
    } else {
      setIsSpeaking(false)
      setTimeout(() => {
        if (isMountedRef.current) hideSubtitle()
      }, 4000)
    }
  }

  // show payment screen if no active session
  if (showPayment) {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <PaymentModal
          visible={showPayment}
          isLoading={paymentLoading}
          onPay={handlePayment}
          onClose={() => {}}
          error={paymentError}
        />
      </>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* dual video players for smooth crossfade */}
      {playerB && (
        <VideoView
          player={playerB}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
        />
      )}
      {playerA && (
        <Animated.View style={[styles.video, { opacity: videoFadeAnim }]}>
          <VideoView
            player={playerA}
            style={styles.videoInner}
            contentFit="cover"
            nativeControls={false}
          />
        </Animated.View>
      )}

      {/* dark overlay at top only */}
      <View style={[styles.topOverlay, { height: insets.top + 60 }]} />

      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Luna</Text>
        {hasActiveSession && (
          <SessionTimer onSessionExpired={handleSessionExpired} />
        )}
      </View>

      {/* subtitle area */}
      {currentSubtitle !== '' && (
        <Animated.View style={[styles.subtitleContainer, { opacity: subtitleFadeAnim }]}>
          <Text style={styles.subtitle}>"{currentSubtitle}"</Text>
        </Animated.View>
      )}

      {/* loading indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Luna is thinking...</Text>
        </View>
      )}

      {/* input section */}
      <Animated.View
        style={[
          styles.inputWrapper,
          { bottom: keyboardHeight, paddingBottom: Math.max(insets.bottom, 16) }
        ]}
      >
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
  videoInner: {
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
  subtitleContainer: {
    position: 'absolute',
    bottom: 180,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ff69b4'
  },
  subtitle: {
    fontSize: 18,
    color: '#fff',
    fontStyle: 'italic',
    lineHeight: 26
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 180,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center'
  },
  loadingText: {
    fontSize: 16,
    color: '#ff69b4',
    fontStyle: 'italic'
  },
  inputWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 10, 15, 0.8)'
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
