// settings screen with modern ios-style design

import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  StatusBar,
  Alert,
  Image
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { getUserProfile, updateUserProfile, grantLifetimeAccess, hasLifetimeAccess } from '../services/profile'
import { submitTwitterShare } from '../services/api'
import { TELEGRAM_SUPPORT_URL, PAYMENT_CONFIG, ORIGINAL_LIFETIME_PRICE_SOL } from '../constants/config'
import { UserProfile } from '../types'
import { UpgradeBottomSheet } from '../components/UpgradeBottomSheet'

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
  const [twitterUrl, setTwitterUrl] = useState('')
  const [showTwitterInput, setShowTwitterInput] = useState(false)
  const [isSubmittingTwitter, setIsSubmittingTwitter] = useState(false)
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)

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
    await updateUserProfile({
      userName: name,
      userAge: parseInt(age, 10) || 0,
      userInterests: interests,
      flirtLevel,
      relationshipStatus: relationshipStatus || undefined,
      boundaries: boundaries || undefined
    })
    setEditMode(false)
    // reload profile
    const p = getUserProfile()
    setProfile(p)
    Alert.alert('Saved', 'Your profile has been updated!')
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

  const handleTwitterShare = async () => {
    const tweetText = encodeURIComponent("I've been chatting with Luna AI - my virtual girlfriend! Try it out!")
    const url = `https://twitter.com/intent/tweet?text=${tweetText}`
    await Linking.openURL(url)
    setShowTwitterInput(true)
  }

  const handleSubmitTwitterUrl = async () => {
    if (!twitterUrl.trim()) {
      Alert.alert('Error', 'Please paste your tweet URL')
      return
    }

    setIsSubmittingTwitter(true)
    try {
      const success = await submitTwitterShare(twitterUrl.trim())
      if (success) {
        await grantLifetimeAccess()
        Alert.alert('Success!', 'You now have lifetime access to Luna!')
        setShowTwitterInput(false)
        setTwitterUrl('')
        const p = getUserProfile()
        setProfile(p)
      } else {
        Alert.alert('Invalid URL', 'Please make sure you paste a valid Twitter/X post URL')
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    }
    setIsSubmittingTwitter(false)
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
        Alert.alert('Welcome!', 'You now have lifetime access to Luna!')
      }
    } catch {
      Alert.alert('Error', 'Payment failed. Please try again.')
    }
    setIsUpgrading(false)
  }

  const flirtLabels = ['Friendly', 'Playful', 'Balanced', 'Flirty', 'Spicy']

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out? Your local chat history will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            if (onLogout) onLogout()
          }
        }
      ]
    )
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
        <View style={styles.profileCard}>
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
        </View>

        {/* cancel edit button */}
        {editMode && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel editing</Text>
          </TouchableOpacity>
        )}

        {/* profile details section */}
        <View style={styles.section}>
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
        </View>

        {/* interests section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Interests</Text>
          <View style={styles.card}>
            <View style={styles.interestsContainer}>
              {INTERESTS_OPTIONS.map(interest => (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.interestChip,
                    interests.includes(interest) && styles.interestChipActive
                  ]}
                  onPress={() => editMode && toggleInterest(interest)}
                  activeOpacity={editMode ? 0.7 : 1}
                >
                  <Text style={[
                    styles.interestText,
                    interests.includes(interest) && styles.interestTextActive
                  ]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {!editMode && interests.length === 0 && (
              <Text style={styles.emptyHint}>Tap Edit to add interests</Text>
            )}
          </View>
        </View>

        {/* flirt level section */}
        <View style={styles.section}>
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
                <View style={[styles.flirtBarFill, { width: `${(flirtLevel / 5) * 100}%` }]} />
              </View>
            )}
          </View>
        </View>

        {/* boundaries section */}
        <View style={styles.section}>
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
        </View>

        {/* upgrade to lifetime section */}
        {!hasLifetimeAccess() && onUpgradeToLifetime && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.upgradeCard}
              onPress={() => setShowUpgradeSheet(true)}
              activeOpacity={0.8}
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
            </TouchableOpacity>
          </View>
        )}

        {/* twitter share card */}
        {!hasLifetimeAccess() && (
          <View style={styles.section}>
            <View style={styles.promoCard}>
              <View style={styles.promoIcon}>
                <Ionicons name="gift-outline" size={28} color="#ff69b4" />
              </View>
              <Text style={styles.promoTitle}>Get Free Lifetime Access</Text>
              <Text style={styles.promoDesc}>
                Share Luna on Twitter and unlock unlimited access forever!
              </Text>
              {!showTwitterInput ? (
                <TouchableOpacity style={styles.promoButton} onPress={handleTwitterShare}>
                  <Ionicons name="logo-twitter" size={18} color="#fff" />
                  <Text style={styles.promoButtonText}>Share on Twitter</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.twitterInputBox}>
                  <Text style={styles.twitterHint}>Paste your tweet URL:</Text>
                  <TextInput
                    style={styles.twitterInput}
                    value={twitterUrl}
                    onChangeText={setTwitterUrl}
                    placeholder="https://twitter.com/..."
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={[styles.claimButton, isSubmittingTwitter && styles.buttonDisabled]}
                    onPress={handleSubmitTwitterUrl}
                    disabled={isSubmittingTwitter}
                  >
                    <Text style={styles.claimButtonText}>
                      {isSubmittingTwitter ? 'Verifying...' : 'Claim Lifetime Access'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* support section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Support</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.menuRow} onPress={openTelegram}>
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
            </TouchableOpacity>

            <View style={styles.cardDivider} />

            <TouchableOpacity style={styles.menuRow} onPress={onShowRefundPolicy}>
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
            </TouchableOpacity>
          </View>
        </View>

        {/* about section */}
        <View style={styles.section}>
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
        </View>

        {/* logout button */}
        {onLogout && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
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
  twitterInputBox: {
    width: '100%'
  },
  twitterHint: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8
  },
  twitterInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    marginBottom: 12
  },
  claimButton: {
    backgroundColor: '#ff69b4',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  claimButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600'
  },
  buttonDisabled: {
    opacity: 0.5
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
