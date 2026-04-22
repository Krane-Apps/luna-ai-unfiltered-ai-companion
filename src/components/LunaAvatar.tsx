// animated luna avatar component using mp4 video assets

import { useEffect, useRef, useState } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av'
import { AvatarState } from '../types'

// video asset imports (speaking reuses listening loop — no dedicated speaking asset in text-only mode)
const videoAssets = {
  speaking: require('../assets/luna-listening.mp4'),
  thinking: require('../assets/luna-thinking.mp4'),
  listening: require('../assets/luna-listening.mp4')
}

interface LunaAvatarProps {
  isSpeaking: boolean
  isThinking?: boolean
  size?: number
}

export const LunaAvatar = ({
  isSpeaking,
  isThinking = false,
  size = 200
}: LunaAvatarProps) => {
  const [avatarState, setAvatarState] = useState<AvatarState>('listening')
  const videoRef = useRef<Video>(null)
  const glowAnim = useRef(new Animated.Value(0.3)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // determine current state based on props
  useEffect(() => {
    if (isSpeaking) {
      setAvatarState('speaking')
      clearIdleTimer()
    } else if (isThinking) {
      setAvatarState('thinking')
      clearIdleTimer()
    } else {
      // when idle, randomly switch between listening and thinking
      startIdleBehavior()
    }

    return () => clearIdleTimer()
  }, [isSpeaking, isThinking])

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }

  const startIdleBehavior = () => {
    // start with listening
    setAvatarState('listening')
    scheduleRandomStateChange()
  }

  const scheduleRandomStateChange = () => {
    clearIdleTimer()
    // random interval between 3-8 seconds
    const delay = 3000 + Math.random() * 5000

    idleTimerRef.current = setTimeout(() => {
      // only switch if not speaking or thinking from props
      if (!isSpeaking && !isThinking) {
        setAvatarState(prev => prev === 'listening' ? 'thinking' : 'listening')
        scheduleRandomStateChange()
      }
    }, delay)
  }

  // glow animation based on state
  useEffect(() => {
    let glowAnimation: Animated.CompositeAnimation
    let pulseAnimation: Animated.CompositeAnimation

    if (avatarState === 'speaking') {
      // intense glow while speaking
      glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 200,
            useNativeDriver: true
          })
        ])
      )
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 150,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true
          })
        ])
      )
    } else if (avatarState === 'thinking') {
      // gentle pulsing while thinking
      glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true
          })
        ])
      )
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 1000,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true
          })
        ])
      )
    } else {
      // subtle breathing while listening
      glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.5,
            duration: 2000,
            useNativeDriver: true
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 2000,
            useNativeDriver: true
          })
        ])
      )
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.01,
            duration: 2500,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2500,
            useNativeDriver: true
          })
        ])
      )
    }

    glowAnimation.start()
    pulseAnimation.start()

    return () => {
      glowAnimation.stop()
      pulseAnimation.stop()
    }
  }, [avatarState, glowAnim, pulseAnim])

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    // video loops automatically, no action needed
  }

  const avatarSize = { width: size, height: size, borderRadius: size / 2 }
  const glowSize = {
    width: size + 24,
    height: size + 24,
    borderRadius: (size + 24) / 2
  }

  return (
    <View style={styles.container}>
      {/* outer glow ring */}
      <Animated.View
        style={[
          styles.glowRing,
          glowSize,
          {
            opacity: glowAnim,
            transform: [{ scale: pulseAnim }]
          }
        ]}
      />

      {/* inner glow */}
      <Animated.View
        style={[
          styles.innerGlow,
          { width: size + 12, height: size + 12, borderRadius: (size + 12) / 2 },
          {
            opacity: Animated.multiply(glowAnim, 0.6),
            transform: [{ scale: pulseAnim }]
          }
        ]}
      />

      {/* video avatar */}
      <Animated.View
        style={[
          styles.avatarContainer,
          avatarSize,
          {
            transform: [{ scale: pulseAnim }]
          }
        ]}
      >
        <Video
          ref={videoRef}
          source={videoAssets[avatarState]}
          style={[styles.video, avatarSize]}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />
      </Animated.View>

      {/* state indicator */}
      <View style={styles.stateIndicator}>
        <View style={[styles.stateDot, styles[`${avatarState}Dot`]]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16
  },
  glowRing: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: '#ff69b4'
  },
  innerGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 105, 180, 0.15)'
  },
  avatarContainer: {
    overflow: 'hidden',
    backgroundColor: '#1a1a2e'
  },
  video: {
    backgroundColor: '#1a1a2e'
  },
  stateIndicator: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  speakingDot: {
    backgroundColor: '#ff69b4'
  },
  thinkingDot: {
    backgroundColor: '#a855f7'
  },
  listeningDot: {
    backgroundColor: '#4ade80'
  }
})
