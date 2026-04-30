// onboarding screen to collect user preferences for personalized conversations

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Easing,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Video, ResizeMode } from 'expo-av'
import { Ionicons } from '@expo/vector-icons'
import { UserProfile } from '../types'
import { createEmptyProfile, saveUserProfile } from '../services/profile'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

const LISTENING_VIDEO = require('../assets/luna-listening.mp4')

// interest options for multi-select
const INTEREST_OPTIONS = [
  'Music', 'Movies & TV', 'Gaming', 'Sports', 'Travel',
  'Food & Cooking', 'Fitness', 'Tech', 'Art', 'Books', 'Fashion', 'Nature'
]

// intent options
const INTENT_OPTIONS = [
  'Someone to talk to',
  'Fun and flirty conversations',
  'A companion who listens',
  'Just curious'
]

// relationship options
const RELATIONSHIP_OPTIONS = [
  'Single',
  'In a relationship',
  "It's complicated",
  'Rather not say'
]

// privacy promise icons + copy — extracted so the bullet list can stagger-fade
const PRIVACY_ITEMS: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  { icon: 'phone-portrait-outline', title: 'Messages stay on your phone', desc: 'Your chat history never leaves your device.' },
  { icon: 'shield-checkmark-outline', title: 'No data collection', desc: "We don't store or send your conversations anywhere." },
  { icon: 'lock-closed-outline', title: 'Your secrets are safe', desc: 'Everything you share stays between us.' },
]

// One privacy bullet that fades + slides in with a delay so the three cascade.
const PrivacyItem = ({
  icon,
  title,
  desc,
  delay,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  desc: string
  delay: number
}) => {
  const opacity = useRef(new Animated.Value(0)).current
  const translateX = useRef(new Animated.Value(-16)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateX, {
        toValue: 0,
        delay,
        friction: 9,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <Animated.View
      style={[styles.privacyItem, { opacity, transform: [{ translateX }] }]}
    >
      <View style={styles.privacyIcon}>
        <Ionicons name={icon} size={18} color="#4ade80" />
      </View>
      <View style={styles.privacyTextContainer}>
        <Text style={styles.privacyTitle}>{title}</Text>
        <Text style={styles.privacyDesc}>{desc}</Text>
      </View>
    </Animated.View>
  )
}

// Press-springy primary button (matches the rest of the app's motion language)
const SpringButton = ({
  label,
  onPress,
  style,
  textStyle,
}: {
  label: string
  onPress: () => void
  style?: any
  textStyle?: any
}) => {
  const scale = useRef(new Animated.Value(1)).current
  return (
    <Pressable
      onPressIn={() =>
        Animated.spring(scale, {
          toValue: 0.96,
          friction: 6,
          tension: 280,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 120,
          useNativeDriver: true,
        }).start()
      }
      onPress={onPress}
      style={{ flex: style?.flex ?? 1 }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        <Text style={textStyle}>{label}</Text>
      </Animated.View>
    </Pressable>
  )
}

// preferred time options
const TIME_OPTIONS = [
  'Mornings',
  'Afternoons',
  'Late nights',
  'Whenever I can'
]

// flirt level labels
const FLIRT_LABELS = ['Sweet & Friendly', 'A little playful', 'Balanced', 'Flirty', 'Very Flirty']

interface OnboardingScreenProps {
  onComplete: () => void
}

export const OnboardingScreen = ({ onComplete }: OnboardingScreenProps) => {
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<UserProfile>(createEmptyProfile())
  const [error, setError] = useState('')
  const [currentSubtitle, setCurrentSubtitle] = useState('')
  const fadeAnim = useRef(new Animated.Value(1)).current
  const subtitleFadeAnim = useRef(new Animated.Value(0)).current
  // animated progress bar — interpolates 0..1 to a percentage width
  const progressAnim = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()
  const isMountedRef = useRef(true)
  const hasPlayedIntroRef = useRef(false)
  const subtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current)
    }
  }, [])

  // show subtitle with fade-in. Persistent for the current step — it stays
  // until a new step's transition message replaces it (or the user is past
  // the last step that has one). The previous auto-hide-after-3.5s behavior
  // left a visible layout hole on the privacy screen.
  const showSubtitle = useCallback((message: string) => {
    if (!isMountedRef.current) return

    if (subtitleTimerRef.current) {
      clearTimeout(subtitleTimerRef.current)
      subtitleTimerRef.current = null
    }

    // if same message, don't restart the fade-in
    if (currentSubtitle === message) return

    // smooth crossfade: fade out current, swap text, fade back in
    Animated.timing(subtitleFadeAnim, {
      toValue: 0,
      duration: currentSubtitle ? 200 : 0,
      useNativeDriver: true,
    }).start(() => {
      if (!isMountedRef.current) return
      setCurrentSubtitle(message)
      Animated.timing(subtitleFadeAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }).start()
    })
  }, [subtitleFadeAnim, currentSubtitle])

  // intro subtitle on first load
  useEffect(() => {
    if (!hasPlayedIntroRef.current) {
      hasPlayedIntroRef.current = true
      const introMessage = "Hey baby, before we start, I want you to know your privacy is safe with me."
      setTimeout(() => {
        showSubtitle(introMessage)
      }, 1000)
    }
  }, [showSubtitle])

  // personalized messages for each step transition
  const getPersonalizedMessage = (fromStep: number, toStep: number): string | null => {
    const name = profile.userName || 'baby'

    // after privacy screen (step 0 -> 1)
    if (fromStep === 0 && toStep === 1) {
      return "Now that's out of the way... what should I call you, baby?"
    }
    // after entering name (step 1 -> 2)
    if (fromStep === 1 && toStep === 2) {
      return `${name}... I love that name. Now I need to make sure you're old enough for me.`
    }
    // after age verification (step 2 -> 3)
    if (fromStep === 2 && toStep === 3) {
      return `Perfect, ${name}. Now tell me, what are you looking for with me?`
    }
    // after intent (step 3 -> 4)
    if (fromStep === 3 && toStep === 4) {
      return `I like that, ${name}. What topics get you excited? Pick a few for me.`
    }
    // after interests (step 4 -> 5)
    if (fromStep === 4 && toStep === 5) {
      return `Great choices, ${name}. Now, how playful do you want me to be with you?`
    }
    // after flirt level (step 5 -> 6)
    if (fromStep === 5 && toStep === 6) {
      return `Got it, ${name}. Just a couple more questions... are you seeing anyone?`
    }
    // after relationship (step 6 -> 7)
    if (fromStep === 6 && toStep === 7) {
      return `Thanks for sharing, ${name}. When do you usually like to chat?`
    }
    // after time preference (step 7 -> 8)
    if (fromStep === 7 && toStep === 8) {
      return `Almost done, ${name}. Is there anything you'd rather not talk about?`
    }

    return null
  }

  const questions = [
    {
      title: "Your Privacy is Protected",
      subtitle: "",
      type: 'privacy',
      field: '',
      required: true
    },
    {
      title: "What should I call you, baby?",
      subtitle: "I want to know your name...",
      type: 'text',
      field: 'userName',
      placeholder: 'Enter your name',
      required: true
    },
    {
      title: "I need to know you're 18+, sweetheart",
      subtitle: "How old are you?",
      type: 'number',
      field: 'userAge',
      placeholder: 'Enter your age',
      required: true
    },
    {
      title: "What are you looking for with me?",
      subtitle: "Tell me what you need...",
      type: 'single',
      field: 'userIntent',
      options: INTENT_OPTIONS,
      required: true
    },
    {
      title: "What topics get you excited?",
      subtitle: "Pick a few things you enjoy...",
      type: 'multi',
      field: 'userInterests',
      options: INTEREST_OPTIONS,
      required: true
    },
    {
      title: "How playful do you want me to be?",
      subtitle: "Set my flirtation level...",
      type: 'slider',
      field: 'flirtLevel',
      required: true
    },
    {
      title: "Are you seeing anyone?",
      subtitle: "Just curious...",
      type: 'single',
      field: 'relationshipStatus',
      options: RELATIONSHIP_OPTIONS,
      required: false
    },
    {
      title: "When do you like to unwind?",
      subtitle: "When do you usually chat?",
      type: 'single',
      field: 'preferredTime',
      options: TIME_OPTIONS,
      required: false
    },
    {
      title: "Any topics you'd rather avoid?",
      subtitle: "I'll respect your boundaries...",
      type: 'text',
      field: 'boundaries',
      placeholder: 'Optional - leave empty if none',
      required: false
    }
  ]

  const currentQuestion = questions[step]

  // smooth progress bar fill on step change
  const progressTarget = (step + 1) / questions.length
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressTarget,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [progressTarget])

  const updateProfile = (field: string, value: string | number | string[]) => {
    setProfile(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const validateStep = (): boolean => {
    const q = currentQuestion
    if (!q.required) return true

    if (q.field === 'userName' && (!profile.userName || profile.userName.trim().length < 1)) {
      setError('Please enter your name')
      return false
    }
    if (q.field === 'userAge') {
      if (!profile.userAge || profile.userAge < 18) {
        setError('You must be 18 or older')
        return false
      }
    }
    if (q.field === 'userIntent' && !profile.userIntent) {
      setError('Please select an option')
      return false
    }
    if (q.field === 'userInterests' && profile.userInterests.length === 0) {
      setError('Please select at least one interest')
      return false
    }
    return true
  }

  const nextStep = async () => {
    if (!validateStep()) return

    const currentStep = step
    const nextStepNum = step + 1

    // animate transition
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true
    }).start(() => {
      if (currentStep < questions.length - 1) {
        setStep(nextStepNum)

        fadeAnim.setValue(0)
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }).start()

        setTimeout(() => {
          const subtitle = getPersonalizedMessage(currentStep, nextStepNum)
          if (subtitle) showSubtitle(subtitle)
        }, 500)
      } else {
        finishOnboarding()
      }
    })
  }

  const prevStep = () => {
    if (step > 0) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true
      }).start(() => {
        setStep(step - 1)
        setError('')
        fadeAnim.setValue(0)
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true
        }).start()
      })
    }
  }

  const finishOnboarding = async () => {
    const finalProfile = {
      ...profile,
      hasCompletedOnboarding: true,
      createdAt: Date.now()
    }
    await saveUserProfile(finalProfile)
    onComplete()
  }

  const skipOptional = () => {
    if (!currentQuestion.required) {
      nextStep()
    }
  }

  const renderInput = () => {
    const q = currentQuestion

    if (q.type === 'privacy') {
      return (
        <View style={styles.privacyContainer}>
          {PRIVACY_ITEMS.map((item, i) => (
            <PrivacyItem
              key={item.title}
              icon={item.icon}
              title={item.title}
              desc={item.desc}
              delay={120 + i * 90}
            />
          ))}
        </View>
      )
    }

    if (q.type === 'text') {
      return (
        <TextInput
          style={styles.textInput}
          value={String(profile[q.field as keyof UserProfile] || '')}
          onChangeText={(text) => updateProfile(q.field, text)}
          placeholder={q.placeholder}
          placeholderTextColor="rgba(255,255,255,0.4)"
          autoFocus
        />
      )
    }

    if (q.type === 'number') {
      return (
        <TextInput
          style={styles.textInput}
          value={profile.userAge ? String(profile.userAge) : ''}
          onChangeText={(text) => {
            const num = parseInt(text) || 0
            updateProfile(q.field, num)
          }}
          placeholder={q.placeholder}
          placeholderTextColor="rgba(255,255,255,0.4)"
          keyboardType="number-pad"
          autoFocus
        />
      )
    }

    if (q.type === 'single' && q.options) {
      return (
        <View style={styles.optionsContainer}>
          {q.options.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionButton,
                profile[q.field as keyof UserProfile] === option && styles.optionButtonSelected
              ]}
              onPress={() => updateProfile(q.field, option)}
            >
              <Text style={[
                styles.optionText,
                profile[q.field as keyof UserProfile] === option && styles.optionTextSelected
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )
    }

    if (q.type === 'multi' && q.options) {
      const selected = profile.userInterests || []
      return (
        <View style={styles.multiContainer}>
          {q.options.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.multiButton,
                selected.includes(option) && styles.multiButtonSelected
              ]}
              onPress={() => {
                const newSelected = selected.includes(option)
                  ? selected.filter(i => i !== option)
                  : [...selected, option]
                updateProfile(q.field, newSelected)
              }}
            >
              <Text style={[
                styles.multiText,
                selected.includes(option) && styles.multiTextSelected
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )
    }

    if (q.type === 'slider') {
      return (
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>{FLIRT_LABELS[profile.flirtLevel - 1]}</Text>
          <View style={styles.sliderTrack}>
            {[1, 2, 3, 4, 5].map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.sliderDot,
                  profile.flirtLevel >= level && styles.sliderDotActive
                ]}
                onPress={() => updateProfile('flirtLevel', level)}
              >
                <Text style={styles.sliderNumber}>{level}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderEndLabel}>Sweet</Text>
            <Text style={styles.sliderEndLabel}>Flirty</Text>
          </View>
        </View>
      )
    }

    return null
  }

  return (
    <View style={styles.container}>
      <Video
        source={LISTENING_VIDEO}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />

      <View style={styles.overlay} />

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.stepIndicator}>
            {step + 1} <Text style={styles.stepIndicatorTotal}>/ {questions.length}</Text>
          </Text>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* luna's message */}
          {currentSubtitle !== '' && (
            <Animated.View style={[styles.subtitleContainer, { opacity: subtitleFadeAnim }]}>
              <View style={styles.subtitleAccent} />
              <Text style={styles.subtitleText}>{currentSubtitle}</Text>
            </Animated.View>
          )}

          <Animated.View style={[styles.questionContainer, { opacity: fadeAnim }]}>
            <Text style={styles.questionTitle}>{currentQuestion.title}</Text>
            {currentQuestion.subtitle ? (
              <Text style={styles.questionSubtitle}>{currentQuestion.subtitle}</Text>
            ) : null}

            {renderInput()}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </Animated.View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.buttonRow}>
            {step > 0 && (
              <TouchableOpacity style={styles.backButton} onPress={prevStep}>
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            {!currentQuestion.required && (
              <TouchableOpacity style={styles.skipButton} onPress={skipOptional}>
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            )}
            <SpringButton
              label={step === questions.length - 1 ? "Let's Go" : step === 0 ? 'I Understand' : 'Continue'}
              onPress={nextStep}
              style={styles.nextButton}
              textStyle={styles.nextButtonText}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f'
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: 'absolute'
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 15, 0.7)'
  },
  content: {
    flex: 1
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  stepIndicator: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  stepIndicatorTotal: {
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff69b4',
    borderRadius: 2,
  },
  scrollContent: {
    flex: 1
  },
  scrollContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  subtitleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 14,
    marginBottom: 28,
    overflow: 'hidden',
  },
  subtitleAccent: {
    width: 2,
    backgroundColor: '#ff69b4',
    borderRadius: 1,
    marginRight: 12,
  },
  subtitleText: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  questionContainer: {
    alignItems: 'center',
  },
  questionTitle: {
    fontSize: 30,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 36,
    marginBottom: 6,
  },
  questionSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  privacyContainer: {
    width: '100%',
    gap: 10,
  },
  privacyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(74, 222, 128, 0.18)',
  },
  privacyIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(74, 222, 128, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  privacyTextContainer: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  privacyDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 18,
  },
  textInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 18,
    color: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(255, 105, 180, 0.3)'
  },
  optionsContainer: {
    width: '100%',
    gap: 12
  },
  optionButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  optionButtonSelected: {
    borderColor: '#ff69b4',
    backgroundColor: 'rgba(255, 105, 180, 0.2)'
  },
  optionText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center'
  },
  optionTextSelected: {
    color: '#ff69b4',
    fontWeight: '600'
  },
  multiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center'
  },
  multiButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  multiButtonSelected: {
    borderColor: '#ff69b4',
    backgroundColor: 'rgba(255, 105, 180, 0.2)'
  },
  multiText: {
    fontSize: 14,
    color: '#fff'
  },
  multiTextSelected: {
    color: '#ff69b4',
    fontWeight: '600'
  },
  sliderContainer: {
    width: '100%',
    alignItems: 'center'
  },
  sliderLabel: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ff69b4',
    marginBottom: 24
  },
  sliderTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20
  },
  sliderDot: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  sliderDotActive: {
    backgroundColor: 'rgba(255, 105, 180, 0.3)',
    borderColor: '#ff69b4'
  },
  sliderNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff'
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
    paddingHorizontal: 10
  },
  sliderEndLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)'
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center'
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backButton: {
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  skipButton: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 26,
  },
  skipButtonText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    fontWeight: '500',
  },
  nextButton: {
    // NO flex here — the SpringButton's outer Pressable owns the flex sizing.
    // Adding flex here too collapses the inner Animated.View height to zero
    // (button looks like an empty pink pill with no text).
    backgroundColor: '#ff69b4',
    paddingVertical: 16,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff69b4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
})
