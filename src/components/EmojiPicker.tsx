import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Dimensions,
  TextInput,
  ScrollView,
} from "react-native";

const CATEGORIES: { icon: string; label: string; emojis: string[] }[] = [
  {
    icon: "🕐",
    label: "Recent",
    emojis: ["😘","❤️","😍","🔥","😂","💕","🥺","😊","💋","🤍"],
  },
  {
    icon: "😊",
    label: "Smileys",
    emojis: [
      "😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊",
      "😋","😎","😍","🥰","😘","🥲","😐","😑","😶","🙄",
      "😏","😣","😥","😮","🤐","😯","😪","😫","🥱","😴",
      "😌","😛","😜","😝","🤤","😒","😓","😔","😕","🙃",
      "🤑","😲","🙁","😖","😞","😟","😤","😢","😭","😦",
      "😧","😨","😩","🤯","😬","😰","😱","🥵","🥶","😳",
      "🤪","😵","🤠","🥳","😎","🤓","🧐","😈","👿","💀",
    ],
  },
  {
    icon: "❤️",
    label: "Love",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
      "❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️",
      "✨","💫","⭐","🌟","🔥","💥","❄️","🌈","🎉","🎊",
    ],
  },
  {
    icon: "🤚",
    label: "Gestures",
    emojis: [
      "👋","🤚","🖐️","✋","🤙","💪","🦾","🖖","👌","🤌",
      "🤏","✌️","🤞","🤟","🤘","👈","👉","👆","🖕","👇",
      "☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶",
      "🤲","🤝","🙏","💅","🫦","💋","👄","👀","😈","🫀",
    ],
  },
  {
    icon: "🌹",
    label: "Nature",
    emojis: [
      "🌹","🌸","🌺","🌻","🌼","💐","🍀","🌿","🍃","🌱",
      "🌲","🌳","🌴","🌵","🎋","🎍","🍄","🐚","🪸","🌊",
      "🔮","⚡","🌙","⭐","☀️","🌤️","⛅","🌦️","🌈","❄️",
    ],
  },
  {
    icon: "🍑",
    label: "Food",
    emojis: [
      "🍑","🍒","🍓","🍉","🍇","🍊","🍋","🍌","🍍","🥭",
      "🍎","🍐","🫐","🥝","🍅","🍆","🥑","🌶️","🧁","🍰",
      "🎂","🍫","🍬","🍭","🍦","🍧","🍨","☕","🧋","🍺",
    ],
  },
];

const NUM_COLS = 8;
const SCREEN_W = Dimensions.get("window").width;
const EMOJI_SIZE = Math.floor((SCREEN_W - 24) / NUM_COLS);

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

export const EmojiPicker = ({ visible, onClose, onSelect }: Props) => {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState("");

  const emojis = search.trim()
    ? CATEGORIES.flatMap((c) => c.emojis).filter((e) =>
        e.includes(search)
      )
    : CATEGORIES[activeCategory].emojis;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        {/* drag handle */}
        <View style={styles.handle} />

        {/* search bar */}
        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search emoji..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={styles.searchInput}
          />
        </View>

        {/* category tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
          contentContainerStyle={styles.tabsContent}
        >
          {CATEGORIES.map((cat, i) => (
            <TouchableOpacity
              key={cat.label}
              onPress={() => { setActiveCategory(i); setSearch(""); }}
              style={[styles.tab, activeCategory === i && styles.tabActive]}
            >
              <Text style={styles.tabIcon}>{cat.icon}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* divider */}
        <View style={styles.divider} />

        {/* emoji grid */}
        <FlatList
          data={emojis}
          keyExtractor={(item, i) => `${item}-${i}`}
          numColumns={NUM_COLS}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.emojiCell, { width: EMOJI_SIZE, height: EMOJI_SIZE }]}
              onPress={() => onSelect(item)}
            >
              <Text style={styles.emoji}>{item}</Text>
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
          key={`grid-${NUM_COLS}`}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 24,
    maxHeight: 380,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "#3a3a3c",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  searchRow: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: "#2c2c2e",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 14,
  },
  tabs: {
    maxHeight: 44,
  },
  tabsContent: {
    paddingHorizontal: 8,
    gap: 4,
  },
  tab: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: "#3a3a3c",
  },
  tabIcon: {
    fontSize: 22,
  },
  divider: {
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginTop: 6,
    marginBottom: 4,
  },
  grid: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  emojiCell: {
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 28,
  },
});
