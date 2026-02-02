// onboarding screen to collect user preferences for personalized conversations

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { UserProfile } from '../types'
import { createEmptyProfile, saveUserProfile } from '../services/profile'
import { generateSpeech } from '../services/tts'
import { audioService } from '../services/audio'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// pre-recorded audio for first 3 screens (no personalization needed)
// to enable, add these files and uncomment the requires:
// - assets/audio/onboarding-intro.mp3: "hey baby, before we start, I want you to know your privacy is safe with me"
// - assets/audio/onboarding-ask-name.mp3: "now that's out of the way... what should I call you, baby?"
const PRE_RECORDED_AUDIO: { intro: any; askName: any } = {
  intro: null,    // require('../assets/audio/onboarding-intro.mp3')
  askName: null   // require('../assets/audio/onboarding-ask-name.mp3')
}

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

// get random speaking video
const getRandomSpeakingVideo = () => {
  const index = Math.floor(Math.random() * speakingVideos.length)
  return speakingVideos[index]
}

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
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentSubtitle, setCurrentSubtitle] = useState('')
  const fadeAnim = useRef(new Animated.Value(1)).current
  const subtitleFadeAnim = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()
  const isMountedRef = useRef(true)
  const speakingVideoRef = useRef(getRandomSpeakingVideo())
  const lastVideoSourceRef = useRef(videoAssets.listening)
  const hasPlayedIntroRef = useRef(false)

  // pre-generated TTS audio cache (generated after name entry)
  const preGeneratedAudioRef = useRef<Record<string, string>>({})
  const isPreGeneratingRef = useRef(false)
  const hasStartedPreGenRef = useRef(false) // prevent duplicate pre-gen calls

  // initialize audio service
  useEffect(() => {
    audioService.initialize()
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      audioService.stopAudio()
    }
  }, [])

  const player = useVideoPlayer(videoAssets.listening, (p) => {
    p.loop = true
    p.muted = true
    p.play()
  })

  // change video based on speaking state
  useEffect(() => {
    if (!player) return

    const newSource = isSpeaking ? speakingVideoRef.current : videoAssets.listening

    if (newSource !== lastVideoSourceRef.current) {
      lastVideoSourceRef.current = newSource
      try {
        player.replace(newSource)
        player.loop = true
        player.muted = true
        player.play()
      } catch (e) {
        console.log('video replace error:', e)
      }
    }
  }, [isSpeaking, player])

  // play intro message on first load - uses pre-recorded if available, TTS otherwise
  useEffect(() => {
    if (!hasPlayedIntroRef.current) {
      hasPlayedIntroRef.current = true
      const introMessage = "Hey baby, before we start, I want you to know your privacy is safe with me."
      setTimeout(() => {
        if (PRE_RECORDED_AUDIO.intro) {
          playPreRecordedAudio(PRE_RECORDED_AUDIO.intro, introMessage)
        } else {
          speakMessage(introMessage)
        }
      }, 1000)
    }
  }, [])

  // pre-generate all personalized TTS messages after user enters their name
  const preGeneratePersonalizedAudio = async (userName: string) => {
    // strict duplicate prevention
    if (hasStartedPreGenRef.current) {
      console.log('[TTS] pre-gen already started, skipping')
      return
    }
    hasStartedPreGenRef.current = true
    isPreGeneratingRef.current = true

    console.log('[TTS] starting pre-generation for:', userName)

    const messages = [
      { key: 'step2', text: `${userName}... I love that name. Now I need to make sure you're old enough for me.` },
      { key: 'step3', text: `Perfect, ${userName}. Now tell me, what are you looking for with me?` },
      { key: 'step4', text: `I like that, ${userName}. What topics get you excited? Pick a few for me.` },
      { key: 'step5', text: `Great choices, ${userName}. Now, how playful do you want me to be with you?` },
      { key: 'step6', text: `Got it, ${userName}. Just a couple more questions... are you seeing anyone?` },
      { key: 'step7', text: `Thanks for sharing, ${userName}. When do you usually like to chat?` },
      { key: 'step8', text: `Almost done, ${userName}. Is there anything you'd rather not talk about?` },
      { key: 'finish', text: `Perfect, ${userName}! I can't wait to get to know you better. Let's chat!` }
    ]

    // generate all in parallel for speed
    const results = await Promise.all(
      messages.map(async ({ key, text }) => {
        const audioUrl = await generateSpeech(text)
        console.log(`[TTS] pre-gen complete: ${key}`)
        return { key, audioUrl }
      })
    )

    // store results
    results.forEach(({ key, audioUrl }) => {
      if (audioUrl) {
        preGeneratedAudioRef.current[key] = audioUrl
      }
    })
    isPreGeneratingRef.current = false
    console.log('[TTS] all pre-gen complete:', Object.keys(preGeneratedAudioRef.current).length, 'audio files ready')
  }

  // play pre-recorded audio file with subtitle - uses centralized audioService
  const playPreRecordedAudio = async (audioAsset: any, subtitle: string) => {
    if (!isMountedRef.current) return

    console.log('[Audio] playPreRecordedAudio:', subtitle.substring(0, 40) + '...')
    setCurrentSubtitle(subtitle)
    subtitleFadeAnim.setValue(0)
    Animated.timing(subtitleFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start()

    speakingVideoRef.current = getRandomSpeakingVideo()
    setIsSpeaking(true)

    await audioService.playAsset(audioAsset, () => {
      if (isMountedRef.current) {
        setIsSpeaking(false)
        setTimeout(() => {
          Animated.timing(subtitleFadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true
          }).start(() => {
            if (isMountedRef.current) setCurrentSubtitle('')
          })
        }, 1000)
      }
    })
  }

  // play pre-generated TTS audio with subtitle
  const playPreGeneratedAudio = async (key: string, subtitle: string) => {
    const audioUrl = preGeneratedAudioRef.current[key]
    console.log(`[Audio] playPreGeneratedAudio key=${key}, hasAudio=${!!audioUrl}`)
    if (audioUrl) {
      // use existing speakMessage logic but with cached URL
      setCurrentSubtitle(subtitle)
      subtitleFadeAnim.setValue(0)
      Animated.timing(subtitleFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start()

      speakingVideoRef.current = getRandomSpeakingVideo()
      setIsSpeaking(true)
      await audioService.playAudio(audioUrl, () => {
        if (isMountedRef.current) {
          setIsSpeaking(false)
          setTimeout(() => {
            Animated.timing(subtitleFadeAnim, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true
            }).start(() => {
              if (isMountedRef.current) setCurrentSubtitle('')
            })
          }, 1000)
        }
      })
    } else {
      // fallback to live TTS if pre-generated not available
      console.log(`[Audio] pre-gen not ready for ${key}, falling back to live TTS`)
      speakMessage(subtitle)
    }
  }

  // speak a message with TTS
  const speakMessage = useCallback(async (message: string) => {
    if (!isMountedRef.current) return

    console.log('[Audio] speakMessage (live TTS):', message.substring(0, 40) + '...')
    setCurrentSubtitle(message)
    subtitleFadeAnim.setValue(0)
    Animated.timing(subtitleFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start()

    const audioUrl = await generateSpeech(message)

    if (!isMountedRef.current) return

    if (audioUrl) {
      speakingVideoRef.current = getRandomSpeakingVideo()
      setIsSpeaking(true)
      await audioService.playAudio(audioUrl, () => {
        if (isMountedRef.current) {
          setIsSpeaking(false)
          // fade out subtitle after speaking
          setTimeout(() => {
            Animated.timing(subtitleFadeAnim, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true
            }).start(() => {
              if (isMountedRef.current) setCurrentSubtitle('')
            })
          }, 1000)
        }
      })
    } else {
      // no audio - show subtitle for a few seconds
      setTimeout(() => {
        Animated.timing(subtitleFadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true
        }).start(() => {
          if (isMountedRef.current) setCurrentSubtitle('')
        })
      }, 3000)
    }
  }, [subtitleFadeAnim])

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

    console.log('[Onboarding] nextStep called, current step:', step)

    // stop any current audio
    audioService.stopAudio()
    setIsSpeaking(false)

    const currentStep = step
    const nextStepNum = step + 1

    // after entering name (step 1), start pre-generating personalized audio
    if (currentStep === 1 && profile.userName && !hasStartedPreGenRef.current) {
      console.log('[Onboarding] triggering pre-gen after name entry')
      preGeneratePersonalizedAudio(profile.userName)
    }

    // animate transition
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true
    }).start(() => {
      if (currentStep < questions.length - 1) {
        console.log('[Onboarding] transitioning to step:', nextStepNum)
        setStep(nextStepNum)

        fadeAnim.setValue(0)
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }).start()

        // play appropriate audio based on step
        setTimeout(() => {
          playStepAudio(currentStep, nextStepNum)
        }, 500)
      } else {
        // complete onboarding - transition immediately, play audio in background
        console.log('[Onboarding] completing onboarding, transitioning immediately')

        // play finish audio in background (don't block)
        const name = profile.userName || 'baby'
        const finishMessage = `Perfect, ${name}! I can't wait to get to know you better. Let's chat!`

        if (preGeneratedAudioRef.current['finish']) {
          playPreGeneratedAudio('finish', finishMessage) // fire and forget
        }
        // skip TTS fallback on finish - just transition quickly

        finishOnboarding()
      }
    })
  }

  // play audio for step transition - uses pre-recorded for early steps, pre-generated for later
  const playStepAudio = (fromStep: number, toStep: number) => {
    console.log(`[Audio] playStepAudio ${fromStep} → ${toStep}`)
    const name = profile.userName || 'baby'

    // step 0 → 1: use pre-recorded "ask name" audio (or TTS fallback)
    if (fromStep === 0 && toStep === 1) {
      const askNameMsg = "Now that's out of the way... what should I call you, baby?"
      if (PRE_RECORDED_AUDIO.askName) {
        playPreRecordedAudio(PRE_RECORDED_AUDIO.askName, askNameMsg)
      } else {
        speakMessage(askNameMsg)
      }
      return
    }

    // step 1 → 2: use pre-generated (has name) - key 'step2'
    if (fromStep === 1 && toStep === 2) {
      const msg = `${name}... I love that name. Now I need to make sure you're old enough for me.`
      playPreGeneratedAudio('step2', msg)
      return
    }

    // step 2 → 3: key 'step3'
    if (fromStep === 2 && toStep === 3) {
      playPreGeneratedAudio('step3', `Perfect, ${name}. Now tell me, what are you looking for with me?`)
      return
    }

    // step 3 → 4: key 'step4'
    if (fromStep === 3 && toStep === 4) {
      playPreGeneratedAudio('step4', `I like that, ${name}. What topics get you excited? Pick a few for me.`)
      return
    }

    // step 4 → 5: key 'step5'
    if (fromStep === 4 && toStep === 5) {
      playPreGeneratedAudio('step5', `Great choices, ${name}. Now, how playful do you want me to be with you?`)
      return
    }

    // step 5 → 6: key 'step6'
    if (fromStep === 5 && toStep === 6) {
      playPreGeneratedAudio('step6', `Got it, ${name}. Just a couple more questions... are you seeing anyone?`)
      return
    }

    // step 6 → 7: key 'step7'
    if (fromStep === 6 && toStep === 7) {
      playPreGeneratedAudio('step7', `Thanks for sharing, ${name}. When do you usually like to chat?`)
      return
    }

    // step 7 → 8: key 'step8'
    if (fromStep === 7 && toStep === 8) {
      playPreGeneratedAudio('step8', `Almost done, ${name}. Is there anything you'd rather not talk about?`)
      return
    }
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
          <View style={styles.privacyItem}>
            <View style={styles.privacyIcon}>
              <Text style={styles.privacyIconText}>*</Text>
            </View>
            <View style={styles.privacyTextContainer}>
              <Text style={styles.privacyTitle}>Messages Stay on Your Phone</Text>
              <Text style={styles.privacyDesc}>Your chat history never leaves your device</Text>
            </View>
          </View>
          <View style={styles.privacyItem}>
            <View style={styles.privacyIcon}>
              <Text style={styles.privacyIconText}>*</Text>
            </View>
            <View style={styles.privacyTextContainer}>
              <Text style={styles.privacyTitle}>No Data Collection</Text>
              <Text style={styles.privacyDesc}>We don't store or send your conversations anywhere</Text>
            </View>
          </View>
          <View style={styles.privacyItem}>
            <View style={styles.privacyIcon}>
              <Text style={styles.privacyIconText}>*</Text>
            </View>
            <View style={styles.privacyTextContainer}>
              <Text style={styles.privacyTitle}>Your Secrets are Safe</Text>
              <Text style={styles.privacyDesc}>Everything you share stays between us</Text>
            </View>
          </View>
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
      {player && (
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
        />
      )}

      <View style={styles.overlay} />

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.stepIndicator}>
            {step + 1} / {questions.length}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${((step + 1) / questions.length) * 100}%` }]} />
          </View>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* luna's spoken message */}
          {currentSubtitle !== '' && (
            <Animated.View style={[styles.subtitleContainer, { opacity: subtitleFadeAnim }]}>
              <Text style={styles.subtitleText}>"{currentSubtitle}"</Text>
              {isSpeaking && (
                <View style={styles.speakingIndicator}>
                  <View style={styles.speakingDot} />
                  <View style={[styles.speakingDot, styles.speakingDotDelay1]} />
                  <View style={[styles.speakingDot, styles.speakingDotDelay2]} />
                </View>
              )}
            </Animated.View>
          )}

          <Animated.View style={[styles.questionContainer, { opacity: fadeAnim }]}>
            <Text style={styles.questionTitle}>{currentQuestion.title}</Text>
            <Text style={styles.questionSubtitle}>{currentQuestion.subtitle}</Text>

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
            <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
              <Text style={styles.nextButtonText}>
                {step === questions.length - 1 ? "Let's Go!" : step === 0 ? 'I Understand' : 'Continue'}
              </Text>
            </TouchableOpacity>
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
    paddingBottom: 16
  },
  stepIndicator: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 8
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff69b4',
    borderRadius: 2
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 3,
    borderLeftColor: '#ff69b4'
  },
  subtitleText: {
    fontSize: 16,
    color: '#fff',
    fontStyle: 'italic',
    lineHeight: 24
  },
  speakingIndicator: {
    flexDirection: 'row',
    marginTop: 12,
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
  questionContainer: {
    alignItems: 'center'
  },
  questionTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8
  },
  questionSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 32
  },
  privacyContainer: {
    width: '100%',
    gap: 20
  },
  privacyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#4ade80'
  },
  privacyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  privacyIconText: {
    fontSize: 18,
    color: '#4ade80',
    fontWeight: '700'
  },
  privacyTextContainer: {
    flex: 1
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4
  },
  privacyDesc: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 20
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
    paddingHorizontal: 24,
    paddingTop: 16
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12
  },
  backButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  skipButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 28
  },
  skipButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#ff69b4',
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: 'center',
    shadowColor: '#ff69b4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700'
  }
})
