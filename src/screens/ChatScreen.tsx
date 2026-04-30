// chat screen with chatgpt-style message interface

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
  Platform,
  StatusBar,
  FlatList,
  Animated,
  Image,
  Linking,
  ActivityIndicator,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { EmojiPicker } from "../components/EmojiPicker";
import { HeaderMenu } from "../components/HeaderMenu";
import { SearchBar } from "../components/SearchBar";
import { ThemePicker, ThemeBackground, ChatTheme, THEMES } from "../components/ThemePicker";
import { LunaProfileModal, AvatarPreview, LunaProfile } from "../components/LunaProfileModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showAlert, AlertProvider } from "../components/AppAlert";
import { ImageSourceSheet } from "../components/ImageSourceSheet";
import { ImageViewerModal } from "../components/ImageViewerModal";
import { VoiceNoteBubble } from "../components/VoiceNoteBubble";
import { startRecording, stopRecording, pauseRecording, resumeRecording, cancelRecording } from "../services/voice";
import { setNotificationsMuted } from "../services/notifications";
import { PaymentModal } from "../components/PaymentModal";
import { RefundBottomSheet } from "../components/RefundBottomSheet";
import { OnboardingScreen } from "./OnboardingScreen";
import { SettingsScreen } from "./SettingsScreen";
import {
  generateChatResponse,
  generateChatResponseWithImage,
  generateChatResponseWithVoice,
  clearChatHistory,
  loadChatHistory,
  initializeChatWithProfile,
  getChatHistory,
  loadMessagesFromFirestore,
} from "../services/chat";
import {
  initiateLifetimePayment,
  getSessionState,
  endSession,
  loadSessionFromStorage,
  connectWallet,
} from "../services/payment";
import { DEV_MODE } from "../constants/config";
import {
  loadUserProfile,
  getUserProfile,
  grantLifetimeAccess,
  hasLifetimeAccess,
  initializeBackend,
  restoreSubscriptionFromFirestore,
  clearUserProfile,
} from "../services/profile";
import { WELCOME_MESSAGE } from "../constants/prompts";
import { UserProfile } from "../types";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageUri?: string;
  audioUri?: string;
  audioDurationMs?: number;
}

// Tracks which message ids have already played their entry animation so that
// scrolling them out and back into the FlatList window doesn't re-trigger it.
const animatedMessageIds = new Set<string>();

const AnimatedBubble = ({
  itemId,
  isUser,
  children,
}: {
  itemId: string;
  isUser: boolean;
  children: React.ReactNode;
}) => {
  const hasAnimated = animatedMessageIds.has(itemId);
  const translateX = useRef(
    new Animated.Value(hasAnimated ? 0 : isUser ? 60 : -60),
  ).current;
  const opacity = useRef(new Animated.Value(hasAnimated ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(hasAnimated ? 1 : 0.85)).current;

  useEffect(() => {
    if (hasAnimated) return;
    animatedMessageIds.add(itemId);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(translateX, {
        toValue: 0,
        tension: 180,
        friction: 18,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 200,
        friction: 18,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.messageRow,
        isUser ? styles.messageRowUser : styles.messageRowAssistant,
        { opacity, transform: [{ translateX }, { scale }] },
      ]}
    >
      {children}
    </Animated.View>
  );
};


const messageKeyExtractor = (item: DisplayMessage) => item.id;

// 12-hour "h:mm AM/PM" format used in the message timestamp under each bubble
const formatTime = (d: Date) => {
  const hours = d.getHours();
  const mins = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${h12}:${mins.toString().padStart(2, "0")} ${ampm}`;
};

const EmptyList = () => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyText}>Start chatting with Luna!</Text>
  </View>
);

const TypingIndicator = React.memo(function TypingIndicator({
  dots,
  lunaProfile,
}: {
  dots: Animated.Value[];
  lunaProfile: LunaProfile;
}) {
  return (
    <View style={styles.typingContainer}>
      <View style={styles.avatarWrap}>
        <AvatarPreview profile={lunaProfile} size={28} />
      </View>
      <View style={styles.typingBubble}>
        <View style={styles.typingDots}>
          {dots.map((dot, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { transform: [{ translateY: dot }] }]}
            />
          ))}
        </View>
      </View>
    </View>
  );
});

interface MessageItemProps {
  item: DisplayMessage;
  isActiveMatch: boolean;
  searchQuery: string;
  lunaProfile: LunaProfile;
  onImagePress: (uri: string) => void;
}

const MessageItem = React.memo(
  function MessageItem({ item, isActiveMatch, searchQuery, lunaProfile, onImagePress }: MessageItemProps) {
    const isUser = item.role === "user";
    const hasImage = !!item.imageUri;
    const hasAudio = !!item.audioUri;
    const displayContent =
      isUser &&
      (item.content.startsWith("[User sent an image") ||
        item.content.startsWith("[Image received"))
        ? ""
        : item.content;

    const textStyle = [
      styles.messageText,
      isUser ? styles.userMessageText : styles.assistantMessageText,
    ];

    let content: React.ReactNode = null;
    if (displayContent.length > 0) {
      const query = searchQuery.trim();
      if (!query) {
        content = <Text style={textStyle}>{displayContent}</Text>;
      } else {
        const parts = displayContent.split(new RegExp(`(${query})`, "gi"));
        content = (
          <Text style={textStyle}>
            {parts.map((part, i) =>
              part.toLowerCase() === query.toLowerCase() ? (
                <Text
                  key={i}
                  style={[
                    styles.searchHighlight,
                    isActiveMatch && styles.searchHighlightActive,
                  ]}
                >
                  {part}
                </Text>
              ) : (
                part
              ),
            )}
          </Text>
        );
      }
    }

    return (
      <AnimatedBubble itemId={item.id} isUser={isUser}>
        {!isUser && (
          <View style={styles.avatarWrap}>
            <AvatarPreview profile={lunaProfile} size={28} />
          </View>
        )}
        <View style={isUser ? styles.bubbleColumnUser : styles.bubbleColumnAssistant}>
          {hasAudio && item.audioUri ? (
            <VoiceNoteBubble
              audioUri={item.audioUri}
              durationMs={item.audioDurationMs ?? 0}
              isUser={isUser}
            />
          ) : (
            <View
              style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.assistantBubble,
                hasImage && styles.imageBubble,
              ]}
            >
              {hasImage && item.imageUri && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onImagePress(item.imageUri!)}
                >
                  <Image
                    source={{ uri: item.imageUri }}
                    style={[
                      styles.messageImage,
                      isUser ? styles.messageImageUser : styles.messageImageAssistant,
                    ]}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
              {content && (
                <View style={hasImage ? styles.imageCaption : undefined}>
                  {content}
                </View>
              )}
            </View>
          )}
          <Text
            style={[
              styles.timestamp,
              isUser ? styles.timestampUser : styles.timestampAssistant,
            ]}
          >
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </AnimatedBubble>
    );
  },
);

export const ChatScreen = () => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string>();
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showRefundSheet, setShowRefundSheet] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isRestoringSubscription, setIsRestoringSubscription] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [chatTheme, setChatTheme] = useState<ChatTheme>(THEMES[0]);
  const [lunaProfile, setLunaProfile] = useState<LunaProfile>({
    name: "Luna",
    avatarUri: null,
    presetIndex: null,
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showImageSheet, setShowImageSheet] = useState(false);
  const [viewerImageUri, setViewerImageUri] = useState<string | null>(null);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const isMountedRef = useRef(true);
  const insets = useSafeAreaInsets();
  const menuTop = insets.top + 62;

  // Single source of truth for the bottom region (below the input bar).
  // Whether the keyboard is up, the emoji picker is open, or neither, it's
  // ALWAYS driven by one Animated.Value with one timing call per state change.
  // Eliminates the prior dual-animation (KAV marginBottom + picker height)
  // jitter, and makes the input bar position stable across all three states.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const lastKbHeight = useRef(0);
  const PICKER_TOTAL = 380 + Math.max(insets.bottom, 0); // matches EmojiPicker
  const computeBottomTarget = () => {
    if (showEmojiPicker) return PICKER_TOTAL;
    // Some Android devices report keyboardDidShow height EXCLUDING the gesture
    // nav inset. Adding insets.bottom guarantees the input clears the keyboard's
    // top on every device — at worst a tiny extra gap on devices that include
    // the inset already, which is invisible since the keyboard sits below.
    if (keyboardHeight > 0) return keyboardHeight + Math.max(insets.bottom, 0);
    return Math.max(insets.bottom, 0);
  };
  const bottomSpace = useRef(
    new Animated.Value(Math.max(insets.bottom, 0)),
  ).current;

  useEffect(() => {
    Animated.timing(bottomSpace, {
      toValue: computeBottomTarget(),
      duration: 240,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [showEmojiPicker, keyboardHeight, insets.bottom]);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, (e) => {
      const h = e.endCoordinates.height;
      lastKbHeight.current = h;
      setKeyboardHeight(h);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      setKeyboardHeight(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  // animated typing dots in header (3 dots bounce sequentially)
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const typingAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isTyping) {
      const bounce = (dot: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dot, { toValue: -4, duration: 300, useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
            Animated.delay(600 - delay),
          ])
        );
      typingAnim.current = Animated.parallel([
        bounce(dot1, 0),
        bounce(dot2, 150),
        bounce(dot3, 300),
      ]);
      typingAnim.current.start();
    } else {
      typingAnim.current?.stop();
      dot1.setValue(0); dot2.setValue(0); dot3.setValue(0);
    }
  }, [isTyping]);

  // play a subtle UI sound
  const playSound = useCallback(async (type: "send" | "receive") => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        type === "send"
          ? require("../../assets/sounds/send.mp3")
          : require("../../assets/sounds/receive.mp3"),
        { volume: 0.4 }
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) sound.unloadAsync();
      });
    } catch {}
  }, []);

  // track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);


  useEffect(() => {
    setNotificationsMuted(isMuted);
  }, [isMuted]);

  // persist luna profile
  useEffect(() => {
    AsyncStorage.setItem("luna_profile", JSON.stringify(lunaProfile)).catch(() => {});
  }, [lunaProfile]);

  // load luna profile on mount
  useEffect(() => {
    AsyncStorage.getItem("luna_profile").then(raw => {
      if (raw) {
        try { setLunaProfile(JSON.parse(raw)); } catch {}
      }
    }).catch(() => {});
  }, []);

  const pickLunaAvatarFromGallery = async (onResult: (uri: string) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      onResult(uri);
      setLunaProfile(p => ({ ...p, avatarUri: uri, presetIndex: null }));
    }
  };

  useEffect(() => {
    const init = async () => {
      // load user profile first
      let profile = await loadUserProfile();

      // 18+ enforcement at boot — Luna is unfiltered, no underage users.
      // Catches existing profiles where age was lowered before the Settings
      // gate landed, and any other path that might've left an under-18 age
      // in storage. Wipe the profile and force back through onboarding
      // (which has its own >=18 gate).
      if (profile?.hasCompletedOnboarding && profile.userAge && profile.userAge < 18) {
        console.warn('[AgeGate] under-18 profile detected, clearing and re-onboarding');
        await clearUserProfile();
        profile = await loadUserProfile();
        showAlert({
          title: 'Age Restricted',
          message: 'You must be 18 or older to use Luna. Please set up again.',
          icon: 'warning',
        });
      }

      setUserProfile(profile);

      // initialize chat with personalized prompt if profile exists
      initializeChatWithProfile(profile);

      await loadSessionFromStorage();
      await loadChatHistory();

      // load existing messages into display
      const history = getChatHistory();
      const displayMessages: DisplayMessage[] = history
        .filter((m) => m.role !== "system")
        .map((m, index) => ({
          id: `${index}-${Date.now()}`,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(),
          imageUri: m.imageUri,
          audioUri: m.audioUri,
          audioDurationMs: m.audioDurationMs,
        }));
      setMessages(displayMessages);

      // note: backend is initialized after payment with wallet address

      // check if onboarding is completed
      if (!profile?.hasCompletedOnboarding) {
        setShowOnboarding(true);
        setShowPayment(false);
      } else {
        setShowOnboarding(false);
        if (profile?.hasLifetimeAccess) {
          setShowPayment(false);
          setHasActiveSession(true);
        } else {
          checkSession();
        }
      }
    };
    init();
  }, []);

  const checkSession = () => {
    if (DEV_MODE) {
      setHasActiveSession(true);
      setShowPayment(false);
      return;
    }
    const session = getSessionState();
    setHasActiveSession(session.isActive);
    setShowPayment(!session.isActive);
  };

  const handlePayment = async () => {
    setPaymentLoading(true);
    setPaymentError(undefined);

    const result = await initiateLifetimePayment();

    setPaymentLoading(false);

    if (result.success && result.walletAddress) {
      // initialize backend with wallet address as user id
      await initializeBackend(result.walletAddress);
      await grantLifetimeAccess();

      setShowPayment(false);
      setHasActiveSession(true);
      startConversation();
    } else {
      setPaymentError(result.error || "Failed to get wallet address");
    }
  };

  const startConversation = async () => {
    // personalize welcome message if we have user's name
    const profile = getUserProfile();
    const welcomeMsg = profile?.userName
      ? `Hey ${profile.userName}! ${WELCOME_MESSAGE}`
      : WELCOME_MESSAGE;

    // add luna's welcome message
    const welcomeMessage: DisplayMessage = {
      id: `welcome-${Date.now()}`,
      role: "assistant",
      content: welcomeMsg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, welcomeMessage]);
  };

  const handleSessionExpired = useCallback(async () => {
    if (DEV_MODE || hasLifetimeAccess()) return;

    endSession();
    setHasActiveSession(false);
    setShowPayment(true);
    await clearChatHistory();
    setMessages([]);
  }, []);

  const handleOnboardingComplete = async () => {
    const profile = await loadUserProfile();
    setUserProfile(profile);
    initializeChatWithProfile(profile);
    setShowOnboarding(false);

    // note: backend will be initialized after payment with wallet address

    if (DEV_MODE || profile?.hasLifetimeAccess) {
      setShowPayment(false);
      setHasActiveSession(true);
      startConversation();
    } else {
      const session = getSessionState();
      if (session.isActive) {
        setHasActiveSession(true);
        setShowPayment(false);
        startConversation();
      } else {
        setShowPayment(true);
      }
    }
  };

  const startRecordingTimer = () => {
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const handleVoiceTap = async () => {
    if (isRecording) return;
    const started = await startRecording();
    if (started) {
      setIsRecording(true);
      setIsRecordingPaused(false);
      startRecordingTimer();
    } else {
      showAlert({ title: "Permission Required", message: "Microphone access is needed to record voice messages.", icon: "warning" });
    }
  };

  const handleRecordingPauseResume = async () => {
    if (isRecordingPaused) {
      await resumeRecording();
      setIsRecordingPaused(false);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else {
      await pauseRecording();
      setIsRecordingPaused(true);
      stopRecordingTimer();
    }
  };

  const handleRecordingCancel = async () => {
    stopRecordingTimer();
    setIsRecording(false);
    setIsRecordingPaused(false);
    setRecordingSeconds(0);
    await cancelRecording();
  };

  const handleRecordingSend = async () => {
    stopRecordingTimer();
    setIsRecording(false);
    setIsRecordingPaused(false);
    const durationMs = recordingSeconds * 1000;
    setRecordingSeconds(0);

    const uri = await stopRecording();
    if (!uri) return;

    Keyboard.dismiss();

    // optimistic display: show the voice note bubble immediately
    const userMessage: DisplayMessage = {
      id: `user-voice-${Date.now()}`,
      role: "user",
      content: "",
      timestamp: new Date(),
      audioUri: uri,
      audioDurationMs: durationMs,
    };
    setMessages((prev) => [...prev, userMessage]);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playSound("send");

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    setIsLoading(true);
    setIsTyping(true);

    // background: transcribe the audio + ask Luna to reply with awareness
    // that this was a voice note (handled inside generateChatResponseWithVoice)
    const response = await generateChatResponseWithVoice(uri, durationMs);

    if (!isMountedRef.current) return;
    setIsLoading(false);
    setIsTyping(false);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSound("receive");

    const assistantMessage: DisplayMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const sendMessage = async () => {
    if (isLoading) return;
    // if there's a staged photo, send it (with whatever's in the input as the caption)
    if (pendingImageUri) {
      await sendImageMessage(pendingImageUri);
      return;
    }
    if (!input.trim()) return;

    const userText = input.trim();
    setInput("");
    Keyboard.dismiss();

    // add user message
    const userMessage: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // haptic + sound on send
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playSound("send");

    // scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // show typing indicator
    setIsLoading(true);
    setIsTyping(true);

    // get ai response
    const response = await generateChatResponse(userText);

    if (!isMountedRef.current) return;

    setIsLoading(false);
    setIsTyping(false);

    // haptic + sound on reply received
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSound("receive");

    // add assistant message
    const assistantMessage: DisplayMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    // scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // upgrade to lifetime from settings
  const handleUpgradeToLifetime = async (): Promise<boolean> => {
    const result = await initiateLifetimePayment();
    if (result.success && result.walletAddress) {
      await initializeBackend(result.walletAddress);
      await grantLifetimeAccess();
      setHasActiveSession(true);
      return true;
    }
    return false;
  };

  // logout - clear all data and show onboarding
  const handleLogout = async () => {
    console.log("[Chat] logging out...");
    // clear all data
    await clearUserProfile();
    await clearChatHistory();
    endSession();

    // reset state
    setMessages([]);
    setUserProfile(null);
    setHasActiveSession(false);
    setShowSettings(false);
    setShowOnboarding(true);
    console.log("[Chat] logout complete");
  };

  // restore subscription from firestore using wallet address
  const handleRestoreSubscription = async () => {
    setIsRestoringSubscription(true);

    // connect wallet to get wallet address
    const walletResult = await connectWallet();

    if (!walletResult.success || !walletResult.walletAddress) {
      setIsRestoringSubscription(false);
      showAlert({ title: "Wallet Connection Failed", message: walletResult.error || "Could not connect to wallet.", icon: "error" });
      return;
    }

    // check firestore for subscription using wallet address
    const restored = await restoreSubscriptionFromFirestore(
      walletResult.walletAddress,
    );

    setIsRestoringSubscription(false);

    if (restored) {
      // load old messages from firestore
      console.log("[Chat] restoring messages from firestore...");
      const firestoreMessages = await loadMessagesFromFirestore();

      if (firestoreMessages.length > 0) {
        // convert to display messages
        const displayMessages: DisplayMessage[] = firestoreMessages.map(
          (m, index) => ({
            id: `restored-${index}-${Date.now()}`,
            role: m.role,
            content: m.content,
            timestamp: new Date(),
          }),
        );
        setMessages(displayMessages);
        console.log("[Chat] restored", displayMessages.length, "messages");
        showAlert({ title: "Restored!", message: `${displayMessages.length} messages from your previous conversations have been restored.`, icon: "success" });
      } else {
        showAlert({ title: "Subscription Restored!", message: "You now have full access to Luna.", icon: "success" });
        startConversation();
      }

      setShowPayment(false);
      setHasActiveSession(true);
    } else {
      showAlert({
        title: "No Subscription Found",
        message: "We could not find an active subscription for this wallet. Please contact support if you believe this is an error.",
        icon: "info",
        buttons: [
          { text: "Contact Support", onPress: () => Linking.openURL("https://t.me/lunaaiseeker") },
          { text: "OK", style: "cancel" },
        ],
      });
    }
  };

  // pick image from library
  const pickImage = async () => {
    if (isLoading) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert({ title: "Permission Needed", message: "Please allow access to your photos to send images.", icon: "warning" });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      stageImageForCaption(result.assets[0].uri);
    }
  };

  // take photo with camera
  const takePhoto = async () => {
    if (isLoading) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showAlert({ title: "Permission Needed", message: "Please allow camera access to take photos.", icon: "warning" });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      stageImageForCaption(result.assets[0].uri);
    }
  };

  // stage a picked photo into the composer so the user can type an optional
  // caption before sending. focus the input + open keyboard so they can
  // start typing immediately, but don't auto-send.
  const stageImageForCaption = (uri: string) => {
    setPendingImageUri(uri);
    setShowEmojiPicker(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  // send image message
  const sendImageMessage = async (imageUri: string) => {
    Keyboard.dismiss();

    // clear staging state immediately so the preview disappears
    setPendingImageUri(null);

    // add user message with image (caption is whatever's currently in the input)
    const userMessage: DisplayMessage = {
      id: `user-img-${Date.now()}`,
      role: "user",
      content: input.trim() || "",
      timestamp: new Date(),
      imageUri: imageUri,
    };
    setMessages((prev) => [...prev, userMessage]);
    const userText = input.trim();
    setInput("");

    // haptic + sound on send
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playSound("send");

    // scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // show typing indicator
    setIsLoading(true);
    setIsTyping(true);

    // get ai response with image analysis
    const response = await generateChatResponseWithImage(
      imageUri,
      userText || undefined,
    );

    if (!isMountedRef.current) return;

    setIsLoading(false);
    setIsTyping(false);

    // haptic + sound on reply received
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSound("receive");

    // add assistant message
    const assistantMessage: DisplayMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    // scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // compute search matches
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [searchQuery, messages]);
  const clampedIndex = searchResults.length > 0
    ? Math.min(searchIndex, searchResults.length - 1)
    : 0;

  // render message bubble - instagram style
  const activeMatchId = searchResults[clampedIndex]?.id;

  const handleImagePress = useCallback((uri: string) => {
    setViewerImageUri(uri);
  }, []);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setInput((prev) => prev + emoji);
  }, []);

  // Coalesce streaming size-change events into one scroll per frame. Animated
  // scrolls during streaming pile up (each new chunk interrupts the prior
  // animation) — instant scroll + RAF throttle gives a smooth follow-the-tail.
  // Critically: only fire when the user is already at the bottom. If they've
  // scrolled up to read history, virtualization-driven size changes must NOT
  // yank them back down (that's the "cannot scroll up" bug).
  const scrollPendingRef = useRef(false);
  const isAtBottomRef = useRef(true);
  const [scrollDownVisible, setScrollDownVisible] = useState(false);
  const scrollDownOpacity = useRef(new Animated.Value(0)).current;

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      isAtBottomRef.current = distanceFromBottom < 80;
      // only show the floating jump-to-bottom button after the user has
      // scrolled meaningfully up — avoids flicker on tiny rubber-band bounces.
      const shouldShow = distanceFromBottom > 240;
      setScrollDownVisible((prev) => (prev !== shouldShow ? shouldShow : prev));
    },
    [],
  );

  // hide the pill in any state where the user is actively composing
  // (recording, emoji picker open, photo staged for caption) — those UI
  // states either own the bottom area or mean "scroll-to-bottom" isn't
  // what the user wants right now.
  const scrollDownShouldDisplay =
    scrollDownVisible && !showEmojiPicker && !isRecording && !pendingImageUri;

  // fade the scroll-down pill in/out when its visibility flips
  useEffect(() => {
    Animated.timing(scrollDownOpacity, {
      toValue: scrollDownShouldDisplay ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [scrollDownShouldDisplay]);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    isAtBottomRef.current = true;
    setScrollDownVisible(false);
  }, []);

  const handleListContentSizeChange = useCallback(() => {
    if (!isAtBottomRef.current) return;
    if (scrollPendingRef.current) return;
    scrollPendingRef.current = true;
    requestAnimationFrame(() => {
      scrollPendingRef.current = false;
      flatListRef.current?.scrollToEnd({ animated: false });
    });
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: DisplayMessage }) => (
      <MessageItem
        item={item}
        isActiveMatch={item.id === activeMatchId}
        searchQuery={searchQuery}
        lunaProfile={lunaProfile}
        onImagePress={handleImagePress}
      />
    ),
    [activeMatchId, searchQuery, lunaProfile, handleImagePress],
  );

  // onboarding screen
  if (showOnboarding) {
    return (
      <>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </>
    );
  }

  // payment screen
  if (showPayment) {
    return (
      <>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <PaymentModal
          visible={showPayment}
          isLoading={paymentLoading}
          onPay={handlePayment}
          onShowRefund={() => setShowRefundSheet(true)}
          onRestoreSubscription={handleRestoreSubscription}
          isRestoringSubscription={isRestoringSubscription}
          error={paymentError}
        />
        <RefundBottomSheet
          visible={showRefundSheet}
          onClose={() => setShowRefundSheet(false)}
        />
      </>
    );
  }

  const handleSearchNext = () => {
    if (searchResults.length === 0) return;
    const next = (clampedIndex + 1) % searchResults.length;
    setSearchIndex(next);
    const msgIndex = messages.findIndex((m) => m.id === searchResults[next].id);
    if (msgIndex !== -1) flatListRef.current?.scrollToIndex({ index: msgIndex, animated: true });
  };

  const handleSearchPrev = () => {
    if (searchResults.length === 0) return;
    const prev = (clampedIndex - 1 + searchResults.length) % searchResults.length;
    setSearchIndex(prev);
    const msgIndex = messages.findIndex((m) => m.id === searchResults[prev].id);
    if (msgIndex !== -1) flatListRef.current?.scrollToIndex({ index: msgIndex, animated: true });
  };

  return (
    <ThemeBackground theme={chatTheme} style={{ paddingTop: insets.top }}>
      <StatusBar barStyle="light-content" backgroundColor={chatTheme.bg} />

      {/* header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => setShowProfileModal(true)}
            activeOpacity={0.7}
            style={styles.headerLeftInner}
          >
            <AvatarPreview profile={lunaProfile} size={38} />
            <View>
              <Text style={styles.headerTitle}>{lunaProfile.name}</Text>
              {isTyping ? (
                <View style={styles.typingSubtitle}>
                  <Text style={styles.headerSubtitle}>typing</Text>
                  {[dot1, dot2, dot3].map((dot, i) => (
                    <Animated.View key={i} style={[styles.typingDot, { transform: [{ translateY: dot }] }]} />
                  ))}
                </View>
              ) : (
                <Text style={styles.headerSubtitle}>Active now</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => setShowMenu(true)}
          >
            <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* search bar — shown when search is active */}
      {showSearch && (
        <SearchBar
          value={searchQuery}
          onChange={(q) => { setSearchQuery(q); setSearchIndex(0); }}
          resultCount={searchResults.length}
          currentIndex={clampedIndex}
          onPrev={handleSearchPrev}
          onNext={handleSearchNext}
          onClose={() => { setShowSearch(false); setSearchQuery(""); }}
        />
      )}


      <View style={styles.keyboardAvoid}>
        {/* message list */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={messageKeyExtractor}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          updateCellsBatchingPeriod={50}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={handleListContentSizeChange}
          ListEmptyComponent={EmptyList}
          ListFooterComponent={
            isTyping ? (
              <TypingIndicator dots={[dot1, dot2, dot3]} lunaProfile={lunaProfile} />
            ) : null
          }
        />

        {/* floating "jump to latest" pill — appears when scrolled up,
            taps scroll back to the most recent message (WhatsApp pattern) */}
        <Animated.View
          pointerEvents={scrollDownShouldDisplay ? "box-none" : "none"}
          style={[
            styles.scrollDownBtnWrap,
            { opacity: scrollDownOpacity, bottom: 88 + insets.bottom },
          ]}
        >
          <TouchableOpacity
            onPress={scrollToBottom}
            style={styles.scrollDownBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        </Animated.View>

        {/* input section — fixed paddingBottom; the dynamic bottom region
            below this view (keyboard / picker / safe-area) is handled by
            the single Animated.View further down. */}
        <View style={[styles.inputContainer, { paddingBottom: 8 }]}>
          {/* staged photo preview (shown above the input row before send) */}
          {pendingImageUri && !isRecording && (
            <View style={styles.imagePreviewRow}>
              <View style={styles.imagePreviewWrap}>
                <Image
                  source={{ uri: pendingImageUri }}
                  style={styles.imagePreviewThumb}
                />
                <TouchableOpacity
                  onPress={() => setPendingImageUri(null)}
                  style={styles.imagePreviewClose}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.imagePreviewHint} numberOfLines={1}>
                Photo attached — add a caption below
              </Text>
            </View>
          )}

          {isRecording ? (
            /* recording bar */
            <View style={styles.recordingBar}>
              {/* trash / cancel */}
              <TouchableOpacity style={styles.recordingIconBtn} onPress={handleRecordingCancel}>
                <Ionicons name="trash-outline" size={22} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>

              {/* timer */}
              <Text style={styles.recordingTimer}>
                {`${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}`}
              </Text>

              {/* animated dots */}
              <View style={styles.recordingDots}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                  <View
                    key={i}
                    style={[styles.recordingDot, isRecordingPaused && styles.recordingDotPaused]}
                  />
                ))}
              </View>

              {/* pause / resume */}
              <TouchableOpacity style={styles.recordingIconBtn} onPress={handleRecordingPauseResume}>
                <Ionicons name={isRecordingPaused ? "play" : "pause"} size={22} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>

              {/* send */}
              <TouchableOpacity style={styles.recordingSendBtn} onPress={handleRecordingSend}>
                <Ionicons name="arrow-forward" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inputRow}>
              {/* emoji / keyboard toggle */}
              <TouchableOpacity
                style={styles.inputIconBtn}
                onPress={() => {
                  if (showEmojiPicker) {
                    // closing picker → opening keyboard.
                    // Pre-set keyboardHeight optimistically using the cached
                    // last-known value so the bottomSpace animation can begin
                    // immediately (in sync with the system keyboard rising).
                    setShowEmojiPicker(false);
                    if (lastKbHeight.current > 0) {
                      setKeyboardHeight(lastKbHeight.current);
                    }
                    inputRef.current?.focus();
                  } else {
                    // closing keyboard → opening picker.
                    // Eagerly clear keyboardHeight so the single bottomSpace
                    // animation runs once from kbHeight → PICKER_TOTAL.
                    setKeyboardHeight(0);
                    Keyboard.dismiss();
                    setShowEmojiPicker(true);
                  }
                }}
                disabled={isLoading}
              >
                <Ionicons
                  name={showEmojiPicker ? "keypad-outline" : "happy-outline"}
                  size={26}
                  color="rgba(255,255,255,0.6)"
                />
              </TouchableOpacity>

              {/* text input pill */}
              <View style={styles.inputPill}>
                <TextInput
                  ref={inputRef}
                  value={input}
                  onChangeText={setInput}
                  onFocus={() => setShowEmojiPicker(false)}
                  placeholder="Message..."
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  style={styles.input}
                  multiline
                  maxLength={500}
                  editable={!isLoading}
                />
                <View style={styles.pillActions}>
                  <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowImageSheet(true); }} disabled={isLoading} style={styles.pillIcon}>
                    <Ionicons name="attach-outline" size={22} color={isLoading ? "#444" : "rgba(255,255,255,0.5)"} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* right action: send OR mic OR transcribing spinner.
                  staged photo → send (even with empty caption) */}
              {input.trim() || pendingImageUri ? (
                <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={isLoading}>
                  <Ionicons name="send" size={19} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.sendBtn} onPress={handleVoiceTap} disabled={isLoading}>
                  <Ionicons name="mic" size={21} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* single animated bottom region: covers safe-area, keyboard, OR
            picker — whichever is active. Picker is only mounted while open
            so its dark drawer background never bleeds through during the
            idle/keyboard states (otherwise overflow-clipped top of the
            picker draws a visible grey strip behind the input bar). */}
        <Animated.View
          style={{
            height: bottomSpace,
            overflow: "hidden",
          }}
        >
          {showEmojiPicker && (
            <EmojiPicker
              visible={showEmojiPicker}
              onSelect={handleEmojiSelect}
            />
          )}
        </Animated.View>
      </View>

      {/* settings screen overlay */}
      {showSettings && (
        <View style={styles.settingsOverlay}>
          <SettingsScreen
            onClose={() => setShowSettings(false)}
            onShowRefundPolicy={() => {
              setShowSettings(false);
              setShowRefundSheet(true);
            }}
            onUpgradeToLifetime={handleUpgradeToLifetime}
            onLogout={handleLogout}
          />
        </View>
      )}

      {/* refund policy bottom sheet */}
      <RefundBottomSheet
        visible={showRefundSheet}
        onClose={() => setShowRefundSheet(false)}
      />

      {/* 3-dot dropdown menu */}
      <HeaderMenu
        visible={showMenu}
        isMuted={isMuted}
        menuTop={menuTop}
        onClose={() => setShowMenu(false)}
        onToggleMute={() => setIsMuted((v) => !v)}
        onSearch={() => setShowSearch(true)}
        onTheme={() => setShowThemePicker(true)}
        onSettings={() => setShowSettings(true)}
      />

      {/* chat theme picker */}
      <ThemePicker
        visible={showThemePicker}
        currentThemeId={chatTheme.id}
        onSelect={(t) => setChatTheme(t)}
        onClose={() => setShowThemePicker(false)}
      />

      {/* luna profile editor */}
      <LunaProfileModal
        visible={showProfileModal}
        profile={lunaProfile}
        onSave={(p) => setLunaProfile(p)}
        onClose={() => setShowProfileModal(false)}
        onPickFromGallery={pickLunaAvatarFromGallery}
      />

      {/* image source picker sheet */}
      <ImageSourceSheet
        visible={showImageSheet}
        onCamera={takePhoto}
        onGallery={pickImage}
        onClose={() => setShowImageSheet(false)}
      />

      {/* fullscreen image preview when tapping a chat photo */}
      <ImageViewerModal
        uri={viewerImageUri}
        onClose={() => setViewerImageUri(null)}
      />

      {/* global custom alert — replaces system Alert.alert */}
      <AlertProvider />
    </ThemeBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  headerLeft: {
    flex: 1,
  },
  headerLeftInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#262626",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 1,
  },
  typingSubtitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  headerIcon: {
    padding: 4,
  },
  // chat container
  chatContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 14,
  },
  // message rows - instagram style
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 2,
  },
  messageRowUser: {
    justifyContent: "flex-end",
    paddingLeft: 50,
  },
  messageRowAssistant: {
    justifyContent: "flex-start",
    paddingRight: 50,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: "#262626",
  },
  avatarWrap: {
    marginRight: 8,
  },
  // message bubbles - instagram style.
  // Width capping is owned by the bubbleColumn wrapper (one level up) — putting
  // maxWidth here too creates recursive percentage constraints that wrap short
  // messages character-by-character. The column's 85% cap propagates down.
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  userBubble: {
    backgroundColor: "#7C3AED",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "#262626",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageText: {
    color: "#fff",
  },
  assistantMessageText: {
    color: "#fff",
  },
  searchHighlight: {
    backgroundColor: "#FFD60A",
    color: "#000",
    borderRadius: 3,
  },
  searchHighlightActive: {
    backgroundColor: "#FF9500",
    color: "#000",
  },
  // wraps the bubble + timestamp in a column so the time sits below the bubble.
  // The 85% width cap lives ONLY here (not on messageBubble too) — stacking
  // both creates recursive percentage constraints that wrap short messages
  // character-by-character.
  bubbleColumnUser: {
    alignItems: "flex-end",
    maxWidth: "85%",
  },
  bubbleColumnAssistant: {
    alignItems: "flex-start",
    maxWidth: "85%",
  },
  // small time text under each message — WhatsApp style
  timestamp: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    marginTop: 3,
    marginHorizontal: 4,
  },
  timestampUser: {
    textAlign: "right",
  },
  timestampAssistant: {
    textAlign: "left",
  },
  // image in message
  imageBubble: {
    padding: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: "hidden",
  },
  // image gets explicit rounded corners matching its bubble shape so Android's
  // unreliable `overflow:hidden + borderRadius` clipping doesn't bleed past
  // the bubble edge
  messageImage: {
    width: 240,
    height: 300,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  messageImageUser: {
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 4,
  },
  messageImageAssistant: {
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 22,
  },
  imageCaption: {
    marginTop: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  // typing indicator
  typingContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 2,
    paddingRight: 50,
  },
  typingBubble: {
    backgroundColor: "#262626",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    borderBottomLeftRadius: 4,
  },
  typingDots: {
    flexDirection: "row",
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#aaaaaa",
  },
  // input area
  inputContainer: {
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  scrollDownBtnWrap: {
    position: "absolute",
    right: 12,
    zIndex: 5,
  },
  scrollDownBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(28,28,30,0.9)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  imagePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  imagePreviewWrap: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#1c1c1e",
  },
  imagePreviewThumb: {
    width: "100%",
    height: "100%",
  },
  imagePreviewClose: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreviewHint: {
    flex: 1,
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  inputIconBtn: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiIcon: {
    fontSize: 26,
  },
  inputPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#1c1c1e",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 44,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingVertical: 8,
    maxHeight: 100,
    minHeight: 36,
  },
  pillActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 2,
  },
  pillIcon: {
    padding: 6,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnRecording: {
    backgroundColor: "#e11d48",
  },
  recordingBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: 4,
    gap: 6,
  },
  recordingIconBtn: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingTimer: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    minWidth: 36,
  },
  recordingDots: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  recordingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  recordingDotPaused: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  recordingSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  // kept for any remaining references
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  inputIcon: {
    padding: 10,
  },
  inputActions: {
    flexDirection: "row",
  },
  sendTextButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendText: {
    color: "#7C3AED",
    fontSize: 16,
    fontWeight: "600",
  },
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
});
