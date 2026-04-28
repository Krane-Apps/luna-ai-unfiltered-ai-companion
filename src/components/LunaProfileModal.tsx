import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SW, height: SH } = Dimensions.get("window");

export interface LunaProfile {
  name: string;
  avatarUri: string | null;
  presetIndex: number | null;
}

export const PRESET_AVATARS: { bg: string; emoji: string; label: string }[] = [
  { bg: "#7C3AED", emoji: "🌙", label: "Moon" },
  { bg: "#DB2777", emoji: "💋", label: "Kiss" },
  { bg: "#0EA5E9", emoji: "❄️", label: "Ice" },
  { bg: "#D97706", emoji: "🔥", label: "Fire" },
  { bg: "#10B981", emoji: "🌿", label: "Nature" },
  { bg: "#6366F1", emoji: "✨", label: "Stars" },
  { bg: "#EC4899", emoji: "🌸", label: "Blossom" },
  { bg: "#8B5CF6", emoji: "👑", label: "Queen" },
];

interface Props {
  visible: boolean;
  profile: LunaProfile;
  onSave: (profile: LunaProfile) => void;
  onClose: () => void;
  onPickFromGallery: (onResult: (uri: string) => void) => void;
}

export const LunaProfileModal = ({
  visible,
  profile,
  onSave,
  onClose,
  onPickFromGallery,
}: Props) => {
  const [draft, setDraft] = useState<LunaProfile>(profile);
  const [nameFocused, setNameFocused] = useState(false);
  const translateY = useRef(new Animated.Value(SH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(profile);
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, tension: 180, friction: 22, useNativeDriver: true }),
      ]).start();
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SH, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        Animated.timing(keyboardOffset, {
          toValue: -e.endCoordinates.height,
          duration: Platform.OS === "ios" ? e.duration : 180,
          useNativeDriver: true,
        }).start();
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      (e) => {
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: Platform.OS === "ios" ? e.duration : 160,
          useNativeDriver: true,
        }).start();
      }
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  const handleSave = () => {
    if (draft.name.trim().length === 0) return;
    onSave({ ...draft, name: draft.name.trim() });
    onClose();
  };

  if (!mounted && !visible) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); onClose(); }}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: Animated.add(translateY, keyboardOffset) }] }]}
      >
        {/* drag handle */}
        <View style={styles.handle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {/* big avatar + edit button */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarRing}>
              <AvatarPreview profile={draft} size={96} />
            </View>
            <TouchableOpacity
              style={styles.editAvatarBtn}
              activeOpacity={0.8}
              onPress={() => onPickFromGallery((uri) => {
                setDraft(d => ({ ...d, avatarUri: uri, presetIndex: null }));
              })}
            >
              <Ionicons name="camera" size={14} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.avatarHint}>Tap avatar or choose below</Text>

          {/* preset chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            keyboardShouldPersistTaps="handled"
          >
            {/* default chip */}
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.chipWrap}
              onPress={() => setDraft(d => ({ ...d, presetIndex: null, avatarUri: null }))}
            >
              <View style={[
                styles.chip,
                draft.presetIndex === null && draft.avatarUri === null && styles.chipActive,
              ]}>
                <Image source={require("../../assets/icon.png")} style={styles.chipImg} />
                {draft.presetIndex === null && draft.avatarUri === null && (
                  <View style={styles.chipCheck}>
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={styles.chipLabel}>Default</Text>
            </TouchableOpacity>

            {/* gallery chip */}
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.chipWrap}
              onPress={() => onPickFromGallery((uri) => {
                setDraft(d => ({ ...d, avatarUri: uri, presetIndex: null }));
              })}
            >
              <View style={[
                styles.chip,
                draft.avatarUri !== null && styles.chipActive,
              ]}>
                {draft.avatarUri ? (
                  <Image source={{ uri: draft.avatarUri }} style={styles.chipImg} />
                ) : (
                  <View style={[styles.chipEmoji, { backgroundColor: "#2c2c2e" }]}>
                    <Ionicons name="images-outline" size={20} color="rgba(255,255,255,0.7)" />
                  </View>
                )}
                {draft.avatarUri && (
                  <View style={styles.chipCheck}>
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={styles.chipLabel}>Gallery</Text>
            </TouchableOpacity>

            {/* preset emoji chips */}
            {PRESET_AVATARS.map((p, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.75}
                style={styles.chipWrap}
                onPress={() => setDraft(d => ({ ...d, presetIndex: i, avatarUri: null }))}
              >
                <View style={[styles.chip, draft.presetIndex === i && styles.chipActive]}>
                  <View style={[styles.chipEmoji, { backgroundColor: p.bg }]}>
                    <Text style={styles.chipEmojiText}>{p.emoji}</Text>
                  </View>
                  {draft.presetIndex === i && (
                    <View style={styles.chipCheck}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={styles.chipLabel}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* divider */}
          <View style={styles.divider} />

          {/* name field */}
          <Text style={styles.fieldLabel}>Display Name</Text>
          <View style={[styles.inputWrap, nameFocused && styles.inputWrapFocused]}>
            <Ionicons name="person-outline" size={16} color={nameFocused ? "#7C3AED" : "rgba(255,255,255,0.35)"} style={{ marginRight: 10 }} />
            <TextInput
              value={draft.name}
              onChangeText={name => setDraft(d => ({ ...d, name }))}
              placeholder="Name your companion..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              style={styles.nameInput}
              maxLength={24}
              returnKeyType="done"
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              onSubmitEditing={handleSave}
            />
            {draft.name.length > 0 && (
              <Text style={styles.charCount}>{draft.name.length}/24</Text>
            )}
          </View>

          {/* save */}
          <TouchableOpacity
            style={[styles.saveBtn, draft.name.trim().length === 0 && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={draft.name.trim().length === 0}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

export const AvatarPreview = ({
  profile,
  size = 36,
}: {
  profile: LunaProfile;
  size?: number;
}) => {
  const radius = size / 2;
  if (profile.avatarUri) {
    return (
      <Image
        source={{ uri: profile.avatarUri }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: "#262626" }}
      />
    );
  }
  if (profile.presetIndex !== null && PRESET_AVATARS[profile.presetIndex]) {
    const p = PRESET_AVATARS[profile.presetIndex];
    return (
      <View style={{
        width: size, height: size, borderRadius: radius,
        backgroundColor: p.bg, alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ fontSize: size * 0.45 }}>{p.emoji}</Text>
      </View>
    );
  }
  return (
    <Image
      source={require("../../assets/icon.png")}
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: "#262626" }}
    />
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#141414",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SH * 0.85,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#3a3a3c",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 8,
  },
  // avatar section
  avatarSection: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 6,
  },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    padding: 4,
    borderWidth: 2,
    borderColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  editAvatarBtn: {
    position: "absolute",
    bottom: 0,
    right: SW / 2 - 70,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#141414",
  },
  avatarHint: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
  },
  // preset chips
  chipsRow: {
    gap: 12,
    paddingBottom: 4,
  },
  chipWrap: {
    alignItems: "center",
    gap: 6,
  },
  chip: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  chipActive: {
    borderColor: "#7C3AED",
  },
  chipImg: {
    width: "100%",
    height: "100%",
  },
  chipEmoji: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipEmojiText: {
    fontSize: 22,
  },
  chipCheck: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#141414",
  },
  chipLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
  },
  // divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 24,
  },
  // name field
  fieldLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1c1e",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.07)",
    marginBottom: 24,
  },
  inputWrapFocused: {
    borderColor: "#7C3AED",
  },
  nameInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    padding: 0,
  },
  charCount: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 12,
    marginLeft: 8,
  },
  // save button
  saveBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    opacity: 0.35,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
