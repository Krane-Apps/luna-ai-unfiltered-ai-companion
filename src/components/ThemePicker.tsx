import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ImageBackground,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SW, height: SH } = Dimensions.get("window");
const CARD_W = (SW - 48) / 3 - 6;

export interface ChatTheme {
  id: string;
  label: string;
  bg: string;           // fallback solid colour
  wallpaper?: string;   // remote image URI
  bg2?: string;         // gradient overlay tint (no pattern)
  category: "dark" | "love" | "aesthetic";
}

// ─── Wallpaper image sources ──────────────────────────────────────────────────
// Unsplash source URLs — permanent, free, no auth needed
const U = (id: string, w = 800, h = 1400) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80`;

const W = {
  // Love / romantic
  pinkHearts:   U("1518199266791-5375a83190b7"),   // pink bokeh hearts
  bokehPink:    U("1474552226712-ac0f0961a954"),   // pink light bokeh
  purpleHearts: U("1511739001486-6bfe10ce785f"),   // purple bokeh
  bokehPurple:  U("1528360983277-13d401cdc186"),   // deep purple bokeh
  redHearts:    U("1583939003579-730e3918a45a"),   // red roses/hearts
  roses:        U("1455659817273-f96807779a8a"),   // dark red roses
  // Aesthetic
  lofi:         U("1519681393784-d120267933ba"),   // lofi city night
  galaxy:       U("1534796636912-3b584963e26b"),   // galaxy
  aurora:       U("1531366936337-7c912a4589a7"),   // northern lights
  ocean:        U("1505118380757-91f5f5632de0"),   // dark ocean
  forest:       U("1448375240586-882707db888b"),   // dark forest
  coffee:       U("1495474472287-4d71bcdd2085"),   // cozy coffee dark
};

export const THEMES: ChatTheme[] = [
  // ── Dark / Plain ────────────────────────────────────────────────
  { id: "default",   label: "Default",       bg: "#000000",              category: "dark" },
  { id: "charcoal",  label: "Charcoal",      bg: "#111111", bg2:"#1c1c1e", category: "dark" },
  { id: "midnight",  label: "Midnight",      bg: "#000814", bg2:"#001233", category: "dark" },
  { id: "purple_plain", label: "Purple",     bg: "#0d0014", bg2:"#1a0030", category: "dark" },

  // ── Love / Romantic ─────────────────────────────────────────────
  { id: "sweetheart",label: "Sweetheart",    bg: "#8B0037", wallpaper: W.pinkHearts,   category: "love" },
  { id: "love",      label: "Love",          bg: "#3D0050", wallpaper: W.bokehPurple,  category: "love" },
  { id: "flirt",     label: "Flirt",         bg: "#4a0030", wallpaper: W.purpleHearts, category: "love" },
  { id: "passion",   label: "Passion",       bg: "#5c0020", wallpaper: W.redHearts,    category: "love" },
  { id: "roses",     label: "Roses",         bg: "#1a000a", wallpaper: W.roses,        category: "love" },
  { id: "bokeh",     label: "Bokeh",         bg: "#2d0040", wallpaper: W.bokehPink,    category: "love" },

  // ── Aesthetic ───────────────────────────────────────────────────
  { id: "lofi",      label: "Lo-Fi",         bg: "#0d0830", wallpaper: W.lofi,         category: "aesthetic" },
  { id: "galaxy",    label: "Galaxy",        bg: "#030010", wallpaper: W.galaxy,       category: "aesthetic" },
  { id: "aurora",    label: "Aurora",        bg: "#001a10", wallpaper: W.aurora,       category: "aesthetic" },
  { id: "ocean",     label: "Ocean",         bg: "#000d1a", wallpaper: W.ocean,        category: "aesthetic" },
  { id: "forest",    label: "Forest",        bg: "#040d07", wallpaper: W.forest,       category: "aesthetic" },
  { id: "coffee",    label: "Coffee",        bg: "#1a0d00", wallpaper: W.coffee,       category: "aesthetic" },
];

const CATEGORIES: { key: ChatTheme["category"]; label: string }[] = [
  { key: "dark",      label: "Dark" },
  { key: "love",      label: "Love" },
  { key: "aesthetic", label: "Aesthetic" },
];

interface Props {
  visible: boolean;
  currentThemeId: string;
  onSelect: (theme: ChatTheme) => void;
  onClose: () => void;
}

export const ThemePicker = ({ visible, currentThemeId, onSelect, onClose }: Props) => {
  const translateY = useRef(new Animated.Value(SH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<ChatTheme["category"]>("love");

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, tension: 180, friction: 22, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SH, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted && !visible) return null;

  const filtered = THEMES.filter(t => t.category === activeCategory);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Chat Theme</Text>

        {/* category tabs */}
        <View style={styles.tabs}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.tab, activeCategory === cat.key && styles.tabActive]}
              onPress={() => setActiveCategory(cat.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, activeCategory === cat.key && styles.tabTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
        >
          {filtered.map(theme => {
            const isActive = theme.id === currentThemeId;
            return (
              <TouchableOpacity
                key={theme.id}
                style={styles.cardWrap}
                onPress={() => { onSelect(theme); onClose(); }}
                activeOpacity={0.8}
              >
                <View style={[styles.card, isActive && styles.cardActive]}>
                  {theme.wallpaper ? (
                    <ImageBackground
                      source={{ uri: theme.wallpaper }}
                      style={styles.cardBg}
                      imageStyle={{ borderRadius: 12 }}
                      resizeMode="cover"
                    >
                      {/* dim overlay for better bubble visibility */}
                      <View style={styles.dimOverlay} />
                      <Bubbles />
                    </ImageBackground>
                  ) : (
                    <View style={[styles.cardBg, { backgroundColor: theme.bg2 ?? theme.bg }]}>
                      {theme.bg2 && (
                        <View
                          pointerEvents="none"
                          style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.bg2, opacity: 0.5, borderRadius: 12 }]}
                        />
                      )}
                      <Bubbles />
                    </View>
                  )}
                  {isActive && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={13} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
                  {theme.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const Bubbles = () => (
  <View style={styles.bubblesOverlay}>
    <View style={styles.bubbleRight} />
    <View style={styles.bubbleLeft} />
    <View style={[styles.bubbleRight, { width: 36, opacity: 0.5 }]} />
  </View>
);

// ── Full-screen wallpaper wrapper used in ChatScreen ──────────────────────────
export const ThemeBackground = ({
  theme,
  children,
  style,
}: {
  theme: ChatTheme;
  children: React.ReactNode;
  style?: object;
}) => {
  if (theme.wallpaper) {
    return (
      <ImageBackground
        source={{ uri: theme.wallpaper }}
        style={[{ flex: 1 }, style]}
        resizeMode="cover"
      >
        {/* subtle dark overlay so text/bubbles remain readable */}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.30)" }]}
        />
        {children}
      </ImageBackground>
    );
  }
  return (
    <View style={[{ flex: 1, backgroundColor: theme.bg }, style]}>
      {theme.bg2 && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.bg2, opacity: 0.45 }]}
        />
      )}
      {children}
    </View>
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
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: SH * 0.80,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#3a3a3c",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  title: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 14,
  },
  // category tabs
  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#1c1c1e",
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#7C3AED",
  },
  tabText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#fff",
  },
  // grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    gap: 10,
    paddingBottom: 44,
  },
  cardWrap: {
    width: CARD_W,
    alignItems: "center",
    gap: 6,
  },
  card: {
    width: CARD_W,
    height: CARD_W * 1.55,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2.5,
    borderColor: "transparent",
  },
  cardActive: {
    borderColor: "#7C3AED",
  },
  cardBg: {
    flex: 1,
    justifyContent: "flex-end",
    borderRadius: 12,
    overflow: "hidden",
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  bubblesOverlay: {
    padding: 8,
    gap: 5,
  },
  bubbleRight: {
    alignSelf: "flex-end",
    width: 48,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(124,58,237,0.9)",
  },
  bubbleLeft: {
    alignSelf: "flex-start",
    width: 38,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  checkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  label: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    textAlign: "center",
  },
  labelActive: {
    color: "#7C3AED",
    fontWeight: "700",
  },
});
