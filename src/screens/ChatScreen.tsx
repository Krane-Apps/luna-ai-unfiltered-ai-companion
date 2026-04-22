// chat screen with chatgpt-style message interface

import { useState, useRef, useEffect, useCallback } from "react";
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
  KeyboardAvoidingView,
  Alert,
  Image,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { PaymentModal } from "../components/PaymentModal";
import { SessionTimer } from "../components/SessionTimer";
import { TwitterShareBanner } from "../components/TwitterShareBanner";
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

  const flatListRef = useRef<FlatList>(null);
  const isMountedRef = useRef(true);
  const insets = useSafeAreaInsets();

  // track mounted state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
    if (hasLifetimeAccess()) return;

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

    if (profile?.hasLifetimeAccess) {
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
      Alert.alert(
        "Wallet Connection Failed",
        walletResult.error || "Could not connect to wallet",
      );
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
        Alert.alert(
          "Success",
          `Restored ${displayMessages.length} messages from your previous conversations!`,
        );
      } else {
        Alert.alert("Success", "Your subscription has been restored!");
        startConversation();
      }

      setShowPayment(false);
      setHasActiveSession(true);
    } else {
      Alert.alert(
        "No Subscription Found",
        "We could not find an active subscription for this wallet. Please contact support if you believe this is an error.",
        [
          {
            text: "Contact Support",
            onPress: () => Linking.openURL("https://t.me/lunaaiseeker"),
          },
          { text: "OK" },
        ],
      );
    }
  };

  // pick image from library
  const pickImage = async () => {
    if (isLoading) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow access to your photos to send images.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
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
      Alert.alert(
        "Permission needed",
        "Please allow camera access to take photos.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
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

  // render message bubble - instagram style
  const renderMessage = ({ item }: { item: DisplayMessage }) => {
    const isUser = item.role === "user";
    const hasImage = !!item.imageUri;
    // hide the image analysis text from user messages
    const displayContent =
      isUser && item.content.startsWith("[User sent an image")
        ? ""
        : item.content;

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAssistant,
        ]}
      >
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
          {displayContent.length > 0 && (
            <Text
              style={[
                styles.messageText,
                isUser ? styles.userMessageText : styles.assistantMessageText,
                hasImage && styles.imageCaption,
              ]}
            >
              {displayContent}
            </Text>
          )}
        </View>
      </View>
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* header - instagram style (outside KeyboardAvoidingView) */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.headerAvatar}
          />
          <View>
            <Text style={styles.headerTitle}>Luna</Text>
            <Text style={styles.headerSubtitle}>
              {isTyping ? "typing..." : "Active now"}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {hasActiveSession && !hasLifetimeAccess() && (
            <SessionTimer onSessionExpired={handleSessionExpired} />
          )}
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => setShowSettings(true)}
          >
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* twitter share banner */}
      {!hasLifetimeAccess() && (
        <TwitterShareBanner
          onLifetimeGranted={() => setHasActiveSession(true)}
        />
      )}

      {/* keyboard avoiding view wraps only the chat content */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 60 : 20}
      >
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
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
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
                    <View style={[styles.dot, styles.dot1]} />
                    <View style={[styles.dot, styles.dot2]} />
                    <View style={[styles.dot, styles.dot3]} />
                  </View>
                </View>
              </View>
            ) : null
          }
        />

        {/* input section - instagram style */}
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom }]}>
          <View style={styles.inputWrapper}>
            <TouchableOpacity
              style={styles.inputIcon}
              onPress={takePhoto}
              disabled={isLoading}
            >
              <Ionicons
                name="camera-outline"
                size={24}
                color={isLoading ? "#666" : "#fff"}
              />
            </TouchableOpacity>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Message..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={styles.input}
              multiline
              maxLength={500}
              editable={!isLoading}
              onSubmitEditing={sendMessage}
            />
            {input.trim() ? (
              <TouchableOpacity
                style={styles.sendTextButton}
                onPress={sendMessage}
                disabled={isLoading}
              >
                <Text style={styles.sendText}>Send</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.inputActions}>
                <TouchableOpacity
                  style={styles.inputIcon}
                  onPress={pickImage}
                  disabled={isLoading}
                >
                  <Ionicons
                    name="image-outline"
                    size={24}
                    color={isLoading ? "#666" : "#fff"}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  keyboardAvoid: {
    flex: 1,
  },
  // header - instagram style
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#000",
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255, 255, 255, 0.15)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#8E8E93",
  },
  dot1: {
    opacity: 1,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 0.4,
  },
  // input area - instagram style
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "#000",
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255, 255, 255, 0.15)",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#262626",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 4,
  },
  inputIcon: {
    padding: 10,
  },
  inputActions: {
    flexDirection: "row",
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 4,
    maxHeight: 100,
    minHeight: 44,
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
