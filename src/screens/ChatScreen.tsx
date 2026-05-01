// chat screen with chatgpt-style message interface

import React, { useState, useRef, useEffect, useCallback } from "react";
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
  Pressable,
  ActivityIndicator,
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
import { startRecording, stopRecording, transcribeAudio } from "../services/voice";
import { setNotificationsMuted } from "../services/notifications";
import { PaymentModal } from "../components/PaymentModal";
import { RefundBottomSheet } from "../components/RefundBottomSheet";
import { OnboardingScreen } from "./OnboardingScreen";
import { SettingsScreen } from "./SettingsScreen";
import {
  generateChatResponse,
  generateChatResponseWithImage,
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
}

const AnimatedBubble = ({
  isUser,
  children,
}: {
  isUser: boolean;
  children: React.ReactNode;
}) => {
  const translateX = useRef(new Animated.Value(isUser ? 60 : -60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
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
  const [isTranscribing, setIsTranscribing] = useState(false);
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

  const flatListRef = useRef<FlatList>(null);
  const isMountedRef = useRef(true);
  const insets = useSafeAreaInsets();
  const menuTop = insets.top + 62;
  const androidKbHeight = useRef(new Animated.Value(0)).current;
  const [kbOpen, setKbOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setKbOpen(true);
      Animated.timing(androidKbHeight, {
        toValue: e.endCoordinates.height,
        duration: 0,
        useNativeDriver: false,
      }).start();
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKbOpen(false);
      Animated.timing(androidKbHeight, {
        toValue: 0,
        duration: 0,
        useNativeDriver: false,
      }).start();
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
      const profile = await loadUserProfile();
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

  const handleVoicePressIn = async () => {
    const started = await startRecording();
    if (started) setIsRecording(true);
    else showAlert({ title: "Permission Required", message: "Microphone access is needed to record voice messages.", icon: "warning" });
  };

  const handleVoicePressOut = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setIsTranscribing(true);
    const uri = await stopRecording();
    if (uri) {
      const text = await transcribeAudio(uri);
      if (text) setInput((prev) => (prev ? prev + " " + text : text));
      else showAlert({ title: "Could not transcribe", message: "Please try again.", icon: "error" });
    }
    setIsTranscribing(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

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
      await sendImageMessage(result.assets[0].uri);
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
      await sendImageMessage(result.assets[0].uri);
    }
  };

  // send image message
  const sendImageMessage = async (imageUri: string) => {
    Keyboard.dismiss();

    // add user message with image
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
  const searchResults = searchQuery.trim()
    ? messages.filter((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];
  const clampedIndex = searchResults.length > 0
    ? Math.min(searchIndex, searchResults.length - 1)
    : 0;

  // render message bubble - instagram style
  const activeMatchId = searchResults[clampedIndex]?.id;

  const renderMessage = ({ item }: { item: DisplayMessage }) => {
    const isUser = item.role === "user";
    const hasImage = !!item.imageUri;
    const displayContent =
      isUser && item.content.startsWith("[User sent an image")
        ? ""
        : item.content;

    const isActiveMatch = item.id === activeMatchId;
    const textStyle = [
      styles.messageText,
      isUser ? styles.userMessageText : styles.assistantMessageText,
      hasImage && styles.imageCaption,
    ];

    // render with highlighted search matches
    const renderContent = () => {
      if (!searchQuery.trim() || displayContent.length === 0) {
        return <Text style={textStyle}>{displayContent}</Text>;
      }
      const query = searchQuery.trim();
      const parts = displayContent.split(new RegExp(`(${query})`, "gi"));
      return (
        <Text style={textStyle}>
          {parts.map((part, i) => {
            const isMatch = part.toLowerCase() === query.toLowerCase();
            if (!isMatch) return part;
            return (
              <Text
                key={i}
                style={[
                  styles.searchHighlight,
                  isActiveMatch && styles.searchHighlightActive,
                ]}
              >
                {part}
              </Text>
            );
          })}
        </Text>
      );
    };

    return (
      <AnimatedBubble isUser={isUser}>
        {!isUser && (
          <Image
            source={require("../../assets/icon.png")}
            style={styles.avatar}
          />
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
            hasImage && styles.imageBubble,
          ]}
        >
          {hasImage && (
            <Image
              source={{ uri: item.imageUri }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          )}
          {displayContent.length > 0 && renderContent()}
        </View>
      </AnimatedBubble>
    );
  };

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


      <Animated.View style={[styles.keyboardAvoid, { paddingBottom: Platform.OS === "android" ? androidKbHeight : 0 }]}>
        {/* message list */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Start chatting with Luna!</Text>
            </View>
          }
          ListFooterComponent={
            isTyping ? (
              <View style={styles.typingContainer}>
                <Image
                  source={require("../../assets/icon.png")}
                  style={styles.avatar}
                />
                <View style={styles.typingBubble}>
                  <View style={styles.typingDots}>
                    {[dot1, dot2, dot3].map((dot, i) => (
                      <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: dot }] }]} />
                    ))}
                  </View>
                </View>
              </View>
            ) : null
          }
        />

        {/* input section */}
        <View style={[styles.inputContainer, { paddingBottom: kbOpen ? 8 : Math.max(insets.bottom, 12) }]}>
          <View style={styles.inputRow}>
            {/* emoji / keyboard toggle */}
            <TouchableOpacity
              style={styles.inputIconBtn}
              onPress={() => {
                if (showEmojiPicker) { setShowEmojiPicker(false); }
                else { Keyboard.dismiss(); setShowEmojiPicker(true); }
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
                value={input}
                onChangeText={setInput}
                onFocus={() => setShowEmojiPicker(false)}
                placeholder="Message..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={styles.input}
                multiline
                maxLength={500}
                editable={!isLoading && !isRecording}
              />
              <View style={styles.pillActions}>
                <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowImageSheet(true); }} disabled={isLoading} style={styles.pillIcon}>
                  <Ionicons name="attach-outline" size={22} color={isLoading ? "#444" : "rgba(255,255,255,0.5)"} />
                </TouchableOpacity>
              </View>
            </View>

            {/* right action: send OR mic */}
            {input.trim() ? (
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={sendMessage}
                disabled={isLoading}
              >
                <Ionicons name="send" size={19} color="#fff" />
              </TouchableOpacity>
            ) : isTranscribing ? (
              <View style={styles.sendBtn}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : (
              <Pressable
                style={[styles.sendBtn, isRecording && styles.sendBtnRecording]}
                onPressIn={handleVoicePressIn}
                onPressOut={handleVoicePressOut}
                disabled={isLoading}
              >
                <Ionicons name={isRecording ? "radio-button-on" : "mic"} size={21} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>
      </Animated.View>

      {/* emoji picker sheet */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelect={(emoji) => setInput((prev) => prev + emoji)}
      />

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
  // message bubbles - instagram style
  messageBubble: {
    maxWidth: "85%",
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
  // image in message
  imageBubble: {
    padding: 4,
    overflow: "hidden",
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 18,
  },
  imageCaption: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 4,
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
