// full screen luna video component

import { useEffect, useRef, useState } from 'react'
import { View, StyleSheet, Dimensions, Animated } from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { AvatarState } from '../types'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// video asset imports (speaking reuses listening loop — no dedicated speaking asset in text-only mode)
const videoAssets = {
  speaking: require('../assets/luna-listening.mp4'),
  thinking: require('../assets/luna-thinking.mp4'),
  listening: require('../assets/luna-listening.mp4')
}

interface LunaFullScreenProps {
  isSpeaking: boolean
  isThinking?: boolean
}

export const LunaFullScreen = ({
  isSpeaking,
  isThinking = false
}: LunaFullScreenProps) => {
  const [avatarState, setAvatarState] = useState<AvatarState>('listening')
  const videoRef = useRef<Video>(null)
  const glowAnim = useRef(new Animated.Value(0.3)).current
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
    setAvatarState('listening')
    scheduleRandomStateChange()
  }

  const scheduleRandomStateChange = () => {
    clearIdleTimer()
    const delay = 3000 + Math.random() * 5000

    idleTimerRef.current = setTimeout(() => {
      if (!isSpeaking && !isThinking) {
        setAvatarState(prev => prev === 'listening' ? 'thinking' : 'listening')
        scheduleRandomStateChange()
      }
    }, delay)
  }

  // glow animation based on state
  useEffect(() => {
    let glowAnimation: Animated.CompositeAnimation

    if (avatarState === 'speaking') {
      glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 200,
            useNativeDriver: true
          })
        ])
      )
    } else {
      glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.5,
            duration: 2000,
            useNativeDriver: true
          }),
          Animated.timing(glowAnim, {
            toValue: 0.2,
            duration: 2000,
            useNativeDriver: true
          })
        ])
      )
    }

    glowAnimation.start()
    return () => glowAnimation.stop()
  }, [avatarState, glowAnim])

  return (
    <View style={styles.container}>
      {/* video background */}
      <Video
        ref={videoRef}
        source={videoAssets[avatarState]}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />

      {/* gradient overlay at bottom */}
      <Animated.View
        style={[
          styles.gradientOverlay,
          { opacity: glowAnim }
        ]}
      />

      {/* top gradient */}
      <View style={styles.topGradient} />
    </View>
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
    position: 'absolute',
    top: 0,
    left: 0
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: 'transparent',
    // using border for gradient effect
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 105, 180, 0.3)'
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(10, 10, 15, 0.5)'
  }
})
