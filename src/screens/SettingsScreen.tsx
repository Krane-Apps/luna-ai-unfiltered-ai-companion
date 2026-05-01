// settings screen with modern ios-style design

import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  StatusBar,
  Image,
  Animated,
  Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { getUserProfile, updateUserProfile, grantLifetimeAccess, hasLifetimeAccess } from '../services/profile'
import { TELEGRAM_SUPPORT_URL, PAYMENT_CONFIG, ORIGINAL_LIFETIME_PRICE_SOL } from '../constants/config'
import { UserProfile } from '../types'
import { UpgradeBottomSheet } from '../components/UpgradeBottomSheet'
import { showAlert } from '../components/AppAlert'

interface SettingsScreenProps {
  onClose: () => void
  onShowRefundPolicy: () => void
  onUpgradeToLifetime?: () => Promise<boolean>
  onLogout?: () => void
}

const INTERESTS_OPTIONS = [
  'Music', 'Movies', 'Travel', 'Food', 'Gaming',
  'Sports', 'Art', 'Technology', 'Fashion', 'Fitness'
]

// staggered fade + slide-up wrapper for each section on mount
const AnimatedSection = ({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode
  delay?: number
  style?: any
}) => {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(18)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        friction: 9,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  )
}

// interest chip with spring-pop on tap + smooth color transition
const AnimatedChip = ({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string
  active: boolean
  disabled: boolean
  onPress: () => void
}) => {
  const scale = useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    if (disabled) return
    Animated.spring(scale, {
      toValue: 0.92,
      friction: 5,
      tension: 220,
      useNativeDriver: true,
    }).start()
  }
  const handlePressOut = () => {
    if (disabled) return
    Animated.spring(scale, {
      toValue: 1,
      friction: 3,
      tension: 180,
      useNativeDriver: true,
    }).start()
  }

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
    >
      <Animated.View
        style={[
          styles.interestChip,
          active && styles.interestChipActive,
          { transform: [{ scale }] },
        ]}
      >
        <Text style={[styles.interestText, active && styles.interestTextActive]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

// pressable card with subtle scale-down on press for tactile feedback
const PressableCard = ({
  children,
  onPress,
  style,
  disabled,
}: {
  children: React.ReactNode
  onPress?: () => void
  style?: any
  disabled?: boolean
}) => {
  const scale = useRef(new Animated.Value(1)).current

  return (
    <Pressable
      onPressIn={() =>
        !disabled &&
        Animated.spring(scale, {
          toValue: 0.97,
          friction: 6,
          tension: 280,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        !disabled &&
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 120,
          useNativeDriver: true,
        }).start()
      }
      onPress={onPress}
      disabled={disabled || !onPress}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  )
}

// menu row with subtle background flash on press
const PressableRow = ({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode
  onPress: () => void
  style?: any
}) => {
  const bg = useRef(new Animated.Value(0)).current

  return (
    <Pressable
      onPressIn={() =>
        Animated.timing(bg, {
          toValue: 1,
          duration: 120,
          useNativeDriver: false,
        }).start()
      }
      onPressOut={() =>
        Animated.timing(bg, {
          toValue: 0,
          duration: 220,
          useNativeDriver: false,
        }).start()
      }
      onPress={onPress}
    >
      <Animated.View
        style={[
          style,
          {
            backgroundColor: bg.interpolate({
              inputRange: [0, 1],
              outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.04)'],
            }),
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  )
}

export const SettingsScreen = ({ onClose, onShowRefundPolicy, onUpgradeToLifetime, onLogout }: SettingsScreenProps) => {
  const insets = useSafeAreaInsets()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [flirtLevel, setFlirtLevel] = useState(3)
  const [relationshipStatus, setRelationshipStatus] = useState('')
  const [boundaries, setBoundaries] = useState('')
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)

  // animated flirt-bar fill width (0..1) — springs to new value when level changes
  const flirtBarAnim = useRef(new Animated.Value((flirtLevel - 1) / 4)).current
  useEffect(() => {
    Animated.spring(flirtBarAnim, {
      toValue: Math.max(0, (flirtLevel - 1) / 4),
      friction: 9,
      tension: 80,
      useNativeDriver: false,
    }).start()
  }, [flirtLevel])

  // subtle pulse on the upgrade card to draw attention
  const upgradeGlow = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (profile?.hasLifetimeAccess) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(upgradeGlow, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: false,
        }),
        Animated.timing(upgradeGlow, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: false,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [profile?.hasLifetimeAccess])

  useEffect(() => {
    const loadProfile = () => {
      const p = getUserProfile()
      if (p) {
        setProfile(p)
        setName(p.userName)
        setAge(p.userAge?.toString() || '')
        setInterests(p.userInterests || [])
        setFlirtLevel(p.flirtLevel || 3)
        setRelationshipStatus(p.relationshipStatus || '')
        setBoundaries(p.boundaries || '')
      }
    }
    loadProfile()
  }, [])

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    )
  }

  const handleSave = async () => {
    // 18+ gate — Luna is an unfiltered companion, no underage users allowed.
    // mirrors the onboarding check so age can't be lowered post-onboarding.
    const parsedAge = parseInt(age, 10)
    if (!parsedAge || parsedAge < 18) {
      showAlert({
        title: 'Age Restricted',
        message: 'You must be 18 or older to use Luna.',
        icon: 'warning',
      })
      return
    }
    if (parsedAge > 120) {
      showAlert({
        title: 'Invalid Age',
        message: 'Please enter a valid age.',
        icon: 'warning',
      })
      return
    }

    await updateUserProfile({
      userName: name,
      userAge: parsedAge,
      userInterests: interests,
      flirtLevel,
      relationshipStatus: relationshipStatus || undefined,
      boundaries: boundaries || undefined
    })
    setEditMode(false)
    // reload profile
    const p = getUserProfile()
    setProfile(p)
    showAlert({ title: 'Saved', message: 'Your profile has been updated!', icon: 'success' })
  }

  const handleCancel = () => {
    if (profile) {
      setName(profile.userName)
      setAge(profile.userAge?.toString() || '')
      setInterests(profile.userInterests || [])
      setFlirtLevel(profile.flirtLevel || 3)
      setRelationshipStatus(profile.relationshipStatus || '')
      setBoundaries(profile.boundaries || '')
    }
    setEditMode(false)
  }

  const openTelegram = () => {
    Linking.openURL(TELEGRAM_SUPPORT_URL)
  }

  const handleUpgrade = async () => {
    if (!onUpgradeToLifetime) return
    setIsUpgrading(true)
    try {
      const success = await onUpgradeToLifetime()
      if (success) {
        setShowUpgradeSheet(false)
        const p = getUserProfile()
        setProfile(p)
        showAlert({ title: 'Welcome!', message: 'You now have lifetime access to Luna!', icon: 'success' })
      }
    } catch {
      showAlert({ title: 'Payment Failed', message: 'Something went wrong. Please try again.', icon: 'error' })
    }
    setIsUpgrading(false)
  }

  const flirtLabels = ['Friendly', 'Playful', 'Balanced', 'Flirty', 'Spicy']

  const handleLogout = () => {
    showAlert({
      title: 'Log Out',
      message: 'Are you sure you want to log out? Your local chat history will be cleared.',
      icon: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: () => { if (onLogout) onLogout() } },
      ],
    })
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        {editMode ? (
          <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
            <Text style={styles.saveText}>Done</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setEditMode(true)} style={styles.headerButton}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* profile header card */}
        <AnimatedSection delay={0}>
          <PressableCard style={styles.profileCard}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.profileAvatar}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{name || 'Your Name'}</Text>
              <Text style={styles.profileStatus}>
                {profile?.hasLifetimeAccess ? 'Lifetime Member' : 'Free Trial'}
              </Text>
            </View>
            {profile?.hasLifetimeAccess && (
              <View style={styles.lifetimeBadge}>
                <Ionicons name="star" size={14} color="#fff" />
              </View>
            )}
          </PressableCard>
        </AnimatedSection>

        {/* cancel edit button */}
        {editMode && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel editing</Text>
          </TouchableOpacity>
        )}

        {/* profile details section */}
        <AnimatedSection delay={60} style={styles.section}>
          <Text style={styles.sectionHeader}>Profile</Text>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.cardRowLeft}>
                <Ionicons name="person-outline" size={20} color="#8E8E93" />
                <Text style={styles.cardLabel}>Name</Text>
              </View>
              {editMode ? (
                <TextInput
                  style={styles.cardInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter name"
                  placeholderTextColor="#666"
                />
              ) : (
                <Text style={styles.cardValue}>{name || 'Not set'}</Text>
              )}
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.cardRow}>
              <View style={styles.cardRowLeft}>
                <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
                <Text style={styles.cardLabel}>Age</Text>
              </View>
              {editMode ? (
                <TextInput
                  style={styles.cardInput}
                  value={age}
                  onChangeText={setAge}
                  placeholder="Enter age"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                />
              ) : (
                <Text style={styles.cardValue}>{age || 'Not set'}</Text>
              )}
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.cardRow}>
              <View style={styles.cardRowLeft}>
                <Ionicons name="heart-outline" size={20} color="#8E8E93" />
                <Text style={styles.cardLabel}>Status</Text>
              </View>
              {editMode ? (
                <TextInput
                  style={styles.cardInput}
                  value={relationshipStatus}
                  onChangeText={setRelationshipStatus}
                  placeholder="e.g. Single"
                  placeholderTextColor="#666"
                />
              ) : (
                <Text style={styles.cardValue}>{relationshipStatus || 'Not set'}</Text>
              )}
            </View>
          </View>
        </AnimatedSection>

        {/* interests section */}
        <AnimatedSection delay={120} style={styles.section}>
          <Text style={styles.sectionHeader}>Interests</Text>
          <View style={styles.card}>
            <View style={styles.interestsContainer}>
              {INTERESTS_OPTIONS.map((interest) => (
                <AnimatedChip
                  key={interest}
                  label={interest}
                  active={interests.includes(interest)}
                  disabled={!editMode}
                  onPress={() => toggleInterest(interest)}
                />
              ))}
            </View>
            {!editMode && interests.length === 0 && (
              <Text style={styles.emptyHint}>Tap Edit to add interests</Text>
            )}
          </View>
        </AnimatedSection>

        {/* flirt level section */}
        <AnimatedSection delay={180} style={styles.section}>
          <Text style={styles.sectionHeader}>Flirt Level</Text>
          <View style={styles.card}>
            <View style={styles.flirtHeader}>
              <Text style={styles.flirtValue}>{flirtLabels[flirtLevel - 1]}</Text>
              <Text style={styles.flirtNumber}>{flirtLevel}/5</Text>
            </View>
            {editMode && (
              <View style={styles.flirtSlider}>
                {[1, 2, 3, 4, 5].map(level => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.flirtDot,
                      level <= flirtLevel && styles.flirtDotActive
                    ]}
                    onPress={() => setFlirtLevel(level)}
                  />
                ))}
              </View>
            )}
            {!editMode && (
              <View style={styles.flirtBar}>
                <Animated.View
                  style={[
                    styles.flirtBarFill,
                    {
                      width: flirtBarAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            )}
          </View>
        </AnimatedSection>

        {/* boundaries section */}
        <AnimatedSection delay={240} style={styles.section}>
          <Text style={styles.sectionHeader}>Topics to Avoid</Text>
          <View style={styles.card}>
            {editMode ? (
              <TextInput
                style={styles.boundariesInput}
                value={boundaries}
                onChangeText={setBoundaries}
                placeholder="Topics you'd rather not discuss..."
                placeholderTextColor="#666"
                multiline
              />
            ) : (
              <Text style={styles.boundariesText}>
                {boundaries || 'None set - Luna will discuss anything'}
              </Text>
            )}
          </View>
        </AnimatedSection>

        {/* upgrade to lifetime section */}
        {!hasLifetimeAccess() && onUpgradeToLifetime && (
          <AnimatedSection delay={300} style={styles.section}>
            <PressableCard
              style={styles.upgradeCard}
              onPress={() => setShowUpgradeSheet(true)}
            >
              <View style={styles.upgradeBadge}>
                <Text style={styles.upgradeBadgeText}>60% OFF</Text>
              </View>
              <View style={styles.upgradeIconContainer}>
                <Ionicons name="diamond" size={28} color="#ff69b4" />
              </View>
              <Text style={styles.upgradeTitle}>Upgrade to Lifetime</Text>
              <Text style={styles.upgradeDesc}>
                Unlimited access forever
              </Text>
              <View style={styles.upgradePriceRow}>
                <Text style={styles.upgradeOriginalPrice}>{ORIGINAL_LIFETIME_PRICE_SOL} SOL</Text>
                <Text style={styles.upgradePrice}>{PAYMENT_CONFIG.lifetimePriceSOL} SOL</Text>
              </View>
              <View style={styles.upgradeButton}>
                <Text style={styles.upgradeButtonText}>View Offer</Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </View>
            </PressableCard>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.upgradeGlow,
                {
                  opacity: upgradeGlow.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.18, 0.45],
                  }),
                },
              ]}
            />
          </AnimatedSection>
        )}


        {/* support section */}
        <AnimatedSection delay={360} style={styles.section}>
          <Text style={styles.sectionHeader}>Support</Text>
          <View style={styles.card}>
            <PressableRow style={styles.menuRow} onPress={openTelegram}>
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#5856D6' }]}>
                  <Ionicons name="chatbubbles" size={18} color="#fff" />
                </View>
                <Text style={styles.menuLabel}>Help & Support</Text>
              </View>
              <View style={styles.menuRowRight}>
                <Text style={styles.menuHint}>Telegram</Text>
                <Ionicons name="chevron-forward" size={20} color="#3A3A3C" />
              </View>
            </PressableRow>

            <View style={styles.cardDivider} />

            <PressableRow style={styles.menuRow} onPress={onShowRefundPolicy}>
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#34C759' }]}>
                  <Ionicons name="shield-checkmark" size={18} color="#fff" />
                </View>
                <Text style={styles.menuLabel}>Refund Policy</Text>
              </View>
              <View style={styles.menuRowRight}>
                <Text style={styles.menuHint}>100%</Text>
                <Ionicons name="chevron-forward" size={20} color="#3A3A3C" />
              </View>
            </PressableRow>
          </View>
        </AnimatedSection>

        {/* about section */}
        <AnimatedSection delay={420} style={styles.section}>
          <Text style={styles.sectionHeader}>About</Text>
          <View style={styles.card}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Version</Text>
              <Text style={styles.aboutValue}>1.0.2</Text>
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Account</Text>
              <Text style={[styles.aboutValue, profile?.hasLifetimeAccess && styles.lifetimeValue]}>
                {profile?.hasLifetimeAccess ? 'Lifetime' : 'Free Trial'}
              </Text>
            </View>
          </View>
        </AnimatedSection>

        {/* logout button */}
        {onLogout && (
          <AnimatedSection delay={480} style={styles.section}>
            <PressableCard style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
              <Text style={styles.logoutText}>Log Out</Text>
            </PressableCard>
          </AnimatedSection>
        )}

        <Text style={styles.footer}>Luna AI - Your AI Companion</Text>
      </ScrollView>

      {/* upgrade bottom sheet */}
      <UpgradeBottomSheet
        visible={showUpgradeSheet}
        onClose={() => setShowUpgradeSheet(false)}
        onUpgrade={handleUpgrade}
        isLoading={isUpgrading}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)'
  },
  headerButton: {
    padding: 8,
    minWidth: 60
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff'
  },
  editText: {
    color: '#ff69b4',
    fontSize: 16,
    textAlign: 'right'
  },
  saveText: {
    color: '#ff69b4',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right'
  },
  content: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40
  },
  // profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginTop: 16
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2C2C2E'
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff'
  },
  profileStatus: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2
  },
  lifetimeBadge: {
    backgroundColor: '#ff69b4',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  cancelButton: {
    alignSelf: 'center',
    marginTop: 12
  },
  cancelText: {
    color: '#8E8E93',
    fontSize: 14
  },
  // sections
  section: {
    marginTop: 24
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    overflow: 'hidden'
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  cardRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  cardLabel: {
    fontSize: 16,
    color: '#fff'
  },
  cardValue: {
    fontSize: 16,
    color: '#8E8E93'
  },
  cardInput: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
    padding: 0
  },
  cardDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginLeft: 44
  },
  // interests
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#2C2C2E'
  },
  interestChipActive: {
    backgroundColor: 'rgba(255,105,180,0.2)',
    borderWidth: 1,
    borderColor: '#ff69b4'
  },
  interestText: {
    fontSize: 14,
    color: '#8E8E93'
  },
  interestTextActive: {
    color: '#ff69b4'
  },
  emptyHint: {
    color: '#8E8E93',
    fontSize: 13,
    textAlign: 'center',
    paddingBottom: 12
  },
  // flirt level
  flirtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14
  },
  flirtValue: {
    fontSize: 16,
    color: '#ff69b4',
    fontWeight: '500'
  },
  flirtNumber: {
    fontSize: 14,
    color: '#8E8E93'
  },
  flirtSlider: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 16
  },
  flirtDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2C2C2E',
    borderWidth: 2,
    borderColor: '#3A3A3C'
  },
  flirtDotActive: {
    backgroundColor: 'rgba(255,105,180,0.3)',
    borderColor: '#ff69b4'
  },
  flirtBar: {
    height: 4,
    backgroundColor: '#2C2C2E',
    marginHorizontal: 14,
    marginBottom: 14,
    marginTop: 8,
    borderRadius: 2,
    overflow: 'hidden'
  },
  flirtBarFill: {
    height: '100%',
    backgroundColor: '#ff69b4',
    borderRadius: 2
  },
  // boundaries
  boundariesInput: {
    padding: 14,
    color: '#fff',
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top'
  },
  boundariesText: {
    padding: 14,
    color: '#8E8E93',
    fontSize: 15
  },
  // promo card
  promoCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,105,180,0.3)'
  },
  promoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,105,180,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6
  },
  promoDesc: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16
  },
  promoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8
  },
  promoButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600'
  },
  // menu rows
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  menuIcon: {
    width: 30,
    height: 30,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center'
  },
  menuLabel: {
    fontSize: 16,
    color: '#fff'
  },
  menuRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  menuHint: {
    fontSize: 15,
    color: '#8E8E93'
  },
  // about
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  aboutLabel: {
    fontSize: 16,
    color: '#fff'
  },
  aboutValue: {
    fontSize: 16,
    color: '#8E8E93'
  },
  lifetimeValue: {
    color: '#ff69b4',
    fontWeight: '500'
  },
  footer: {
    textAlign: 'center',
    color: '#3A3A3C',
    fontSize: 12,
    marginTop: 32,
    marginBottom: 20
  },
  // soft pink halo behind the upgrade card — pulses to draw attention
  upgradeGlow: {
    position: 'absolute',
    top: 0,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 22,
    backgroundColor: 'rgba(255,105,180,0.25)',
    shadowColor: '#ff69b4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 0,
    zIndex: -1,
  },
  // upgrade card styles
  upgradeCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 105, 180, 0.4)',
    position: 'relative'
  },
  upgradeBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10
  },
  upgradeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800'
  },
  upgradeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 105, 180, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4
  },
  upgradeDesc: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12
  },
  upgradePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16
  },
  upgradeOriginalPrice: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.4)',
    textDecorationLine: 'line-through'
  },
  upgradePrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ff69b4'
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff69b4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 6
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600'
  },
  // logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '500'
  }
})
