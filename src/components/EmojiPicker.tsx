import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  FlatList,
  StyleSheet,
  Dimensions,
  TextInput,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

const CATEGORIES: { icon: string; label: string; emojis: string[] }[] = [
  {
    icon: "🕐",
    label: "Recent",
    emojis: [
      "😘","❤️","😍","🔥","😂","💕","🥺","😊","💋","🤍",
      "🥰","😏","😈","🫦","💖","✨","🌹","🥵","💦","👀",
    ],
  },
  {
    icon: "💋",
    label: "Flirty",
    emojis: [
      "😘","😍","🥰","😏","😉","💋","😈","😻","🥺","👀",
      "🫦","💕","💞","💖","💘","😚","🥲","🫶","🤭","🥹",
      "😋","🥵","🤤","🩷","🌹","🍓","🌸","✨","🦋","💌",
      "💝","💗","😅","😝","🤪","🤗","🫣","☺️","💐","💟",
      "💜","🌷","🥀","🌺","🌻","💫","⭐","🌟","💥","🎀",
    ],
  },
  {
    icon: "❤️",
    label: "Love",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","🩷",
      "🩵","❤️‍🔥","❤️‍🩹","💔","❣️","💕","💞","💓","💗","💖",
      "💘","💝","💟","💌","💋","💍","💎","💐","🌹","🌷",
      "🌸","🌺","🌻","🌼","🥀","🪷","🏵️","🦋","🕊️","🌟",
      "✨","💫","⭐","🌠","🌈","🎀","🎁","🎈","🎆","🎇",
      "💑","💏","👩‍❤️‍👨","👨‍❤️‍👨","👩‍❤️‍👩","👰","🤵","💒","🪩","🥂",
    ],
  },
  {
    icon: "🔥",
    label: "Spicy",
    emojis: [
      "🔥","🍑","🍆","💦","👅","👀","😈","🥵","😏","🤤",
      "🍒","🍌","🥒","🍯","🍪","🍫","🌶️","💯","🥴","😵",
      "😜","🤭","🫦","💋","👄","💢","🥺","🍦","🩷","👇",
      "✊","🤞","🍩","🍓","🍷","🥃","🍸","🍹","🥂","🛏️",
      "👠","👗","🩱","🧴","🪞","🔞","🫶","🤘","🖤","💜",
    ],
  },
  {
    icon: "😊",
    label: "Smileys",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃",
      "🫠","😉","😊","😇","🥰","😍","🤩","😘","😗","☺️",
      "😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗",
      "🤭","🫢","🫣","🤫","🤔","🫡","🤐","🤨","😐","😑",
      "😶","🫥","😏","😒","🙄","😬","🤥","😌","😔","😪",
      "🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶",
      "🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕",
      "🫤","😟","🙁","☹️","😮","😯","😲","😳","🥺","🥹",
      "😦","😧","😨","😰","😥","😢","😭","😱","😖","😣",
      "😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈",
      "👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾",
      "🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾",
    ],
  },
  {
    icon: "🤚",
    label: "People",
    emojis: [
      "👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞",
      "🫰","🤟","🤘","🤙","🫵","🫱","🫲","🫸","🫷","🫳",
      "🫴","👈","👉","👆","🖕","👇","☝️","👍","👎","✊",
      "👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏",
      "✍️","💅","🤳","💪","🦾","🦵","🦿","🦶","👂","🦻",
      "👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄",
      "🫦","💋","🧑","👶","👦","👧","🧒","👨","👩","🧔",
      "👱","👴","👵","🙍","🙎","🙅","🙆","💁","🙋","🧏",
      "🙇","🤦","🤷","💆","💇","🚶","🏃","💃","🕺","👯",
      "🧖","🛀","🛌","👫","👭","👬","💏","💑","👪","🗣️",
    ],
  },
  {
    icon: "🐻",
    label: "Animals",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨",
      "🐯","🦁","🐮","🐷","🐽","🐸","🐵","🙈","🙉","🙊",
      "🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉",
      "🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌",
      "🐞","🐜","🪰","🪲","🪳","🦟","🦗","🕷️","🕸️","🦂",
      "🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀",
      "🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆",
      "🦓","🦍","🦧","🦣","🐘","🦛","🦏","🐪","🐫","🦒",
      "🦘","🦬","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙",
      "🐐","🦌","🐕","🐩","🦮","🐕‍🦺","🐈","🐈‍⬛","🪶","🐓",
      "🦃","🦤","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨",
      "🦡","🦫","🦦","🦥","🐁","🐀","🐿️","🦔","🐉","🐲",
    ],
  },
  {
    icon: "🍕",
    label: "Food",
    emojis: [
      "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐",
      "🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑",
      "🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅",
      "🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳",
      "🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔",
      "🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗",
      "🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟",
      "🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡",
      "🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬",
      "🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","🫖",
      "☕","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷",
      "🥃","🍸","🍹","🧉","🍾","🧊","🥄","🍴","🍽️","🥡",
    ],
  },
  {
    icon: "⚽",
    label: "Activity",
    emojis: [
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱",
      "🪀","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳",
      "🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷",
      "⛸️","🥌","🎿","⛷️","🏂","🪂","🏋️","🤼","🤸","⛹️",
      "🤺","🤾","🏌️","🏇","🧘","🏄","🏊","🤽","🚣","🧗",
      "🚵","🚴","🏆","🥇","🥈","🥉","🏅","🎖️","🏵️","🎫",
      "🎟️","🎪","🤹","🎭","🩰","🎨","🎬","🎤","🎧","🎼",
      "🎹","🥁","🪘","🎷","🎺","🎸","🪕","🎻","🎲","♟️",
      "🎯","🎳","🎮","🎰","🧩","🪅","🪩","🪄","🎀","🎁",
    ],
  },
  {
    icon: "✈️",
    label: "Travel",
    emojis: [
      "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐",
      "🛻","🚚","🚛","🚜","🛴","🚲","🛵","🏍️","🛺","🚨",
      "🚔","🚍","🚘","🚖","🚡","🚠","🚟","🚃","🚋","🚞",
      "🚝","🚄","🚅","🚈","🚂","🚆","🚇","🚊","🚉","✈️",
      "🛫","🛬","🛩️","💺","🛰️","🚀","🛸","🚁","🛶","⛵",
      "🚤","🛥️","🛳️","⛴️","🚢","⚓","⛽","🚧","🚦","🚥",
      "🗺️","🗿","🗽","🗼","🏰","🏯","🏟️","🎡","🎢","🎠",
      "⛲","⛱️","🏖️","🏝️","🏜️","🌋","⛰️","🏔️","🗻","🏕️",
      "⛺","🏠","🏡","🏘️","🏚️","🏗️","🏭","🏢","🏬","🏨",
      "🏪","🏫","🏩","💒","🏛️","⛪","🕌","🕍","🕋","⛩️",
      "🌅","🌄","🌠","🎇","🎆","🌇","🌆","🏙️","🌃","🌌",
    ],
  },
  {
    icon: "💡",
    label: "Objects",
    emojis: [
      "⌚","📱","📲","💻","⌨️","🖥️","🖨️","🖱️","🕹️","💽",
      "💾","💿","📀","📼","📷","📸","📹","🎥","📽️","🎞️",
      "📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️","🧭",
      "⏱️","⏲️","⏰","🕰️","⌛","⏳","📡","🔋","🔌","💡",
      "🔦","🕯️","🧯","🛢️","💸","💵","💴","💶","💷","🪙",
      "💰","💳","🧾","💎","⚖️","🪜","🧰","🔧","🔨","🛠️",
      "⛏️","🪚","🔩","⚙️","🧱","⛓️","🧲","🔫","💣","🧨",
      "🪓","🔪","🗡️","⚔️","🛡️","🚬","⚰️","⚱️","🏺","🔮",
      "📿","🧿","💈","⚗️","🔭","🔬","💊","💉","🩸","🧬",
      "🌡️","🧹","🧺","🧻","🚽","🚿","🛁","🧼","🪒","🧽",
      "🛎️","🔑","🗝️","🚪","🛋️","🛏️","🧸","🖼️","🛍️","🛒",
      "🎁","🎈","🎀","🪅","🎊","🎉","✉️","📩","📨","📧",
      "📥","📤","📦","🏷️","📜","📃","📄","📊","📈","📉",
      "📋","📁","📂","📒","📕","📗","📘","📙","📚","📖",
      "🔖","🔗","📎","📐","📏","📌","📍","✂️","🖊️","✒️",
      "🖌️","🖍️","📝","✏️","🔍","🔎","🔏","🔐","🔒","🔓",
    ],
  },
  {
    icon: "🔣",
    label: "Symbols",
    emojis: [
      "💯","💢","💥","💫","💦","💨","🕳️","💬","💭","🗯️",
      "♨️","🛑","⛔","📛","🚫","✅","❌","⭕","❎","✔️",
      "❇️","✳️","✴️","❓","❔","❕","❗","‼️","⁉️","〰️",
      "💱","💲","♻️","⚜️","🔱","⚠️","🚸","🆘","☢️","☣️",
      "🅰️","🅱️","🆎","🅾️","🆑","🆒","🆓","🆕","🆖","🆗",
      "🆙","🆚","ℹ️","Ⓜ️","🅿️","🈁","🈂️","🈷️","🈶","🈯",
      "🉐","🈹","🈚","🈲","🉑","🈸","🈴","🈳","㊗️","㊙️",
      "🈺","🈵","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪",
      "🟤","🟥","🟧","🟨","🟩","🟦","🟪","⬛","⬜","🟫",
      "🔶","🔷","🔸","🔹","🔺","🔻","💠","🔘","🔳","🔲",
      "♠️","♣️","♥️","♦️","🃏","🎴","🀄","♈","♉","♊",
      "♋","♌","♍","♎","♏","♐","♑","♒","♓","⛎",
      "🆔","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","☯️","☦️",
      "🛐","➕","➖","➗","✖️","🟰","♾️","™️","©️","®️",
    ],
  },
];

const NUM_COLS = 8;
const SCREEN_W = Dimensions.get("window").width;
const EMOJI_SIZE = Math.floor((SCREEN_W - 24) / NUM_COLS);
const SHEET_HEIGHT = 380;
const TAB_SIZE = 38;
const TAB_GAP = 4;
const TAB_STRIDE = TAB_SIZE + TAB_GAP;

const emojiKeyExtractor = (item: string, i: number) => `${item}-${i}`;

interface Props {
  visible: boolean;
  onSelect: (emoji: string) => void;
}

const EmojiCell = React.memo(function EmojiCell({
  emoji,
  size,
  onPress,
}: {
  emoji: string;
  size: number;
  onPress: (e: string) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.72,
      useNativeDriver: true,
      friction: 5,
      tension: 220,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 3,
      tension: 180,
    }).start();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress(emoji);
      }}
      style={[styles.emojiCell, { width: size, height: size }]}
    >
      <Animated.Text style={[styles.emoji, { transform: [{ scale }] }]}>
        {emoji}
      </Animated.Text>
    </Pressable>
  );
});

export const EmojiPicker = ({ visible, onSelect }: Props) => {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState("");

  const fullHeight = SHEET_HEIGHT + Math.max(insets.bottom, 0);
  const heightAnim = useRef(new Animated.Value(visible ? fullHeight : 0)).current;
  const contentOpacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const indicatorX = useRef(new Animated.Value(0)).current;
  const gridOpacity = useRef(new Animated.Value(1)).current;
  const gridTranslate = useRef(new Animated.Value(0)).current;
  const tabsScrollRef = useRef<ScrollView>(null);
  const gridListRef = useRef<FlatList>(null);

  // animate the picker drawer in/out — input stays put, picker takes the keyboard's space
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(heightAnim, {
          toValue: fullHeight,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 200,
          delay: 60,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: false,
        }),
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [visible, fullHeight]);

  // grid swap animation when category changes
  useEffect(() => {
    gridOpacity.setValue(0);
    gridTranslate.setValue(10);
    Animated.parallel([
      Animated.timing(gridOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(gridTranslate, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeCategory, search]);

  const handleCategoryChange = (i: number) => {
    if (i === activeCategory && !search) return;
    Haptics.selectionAsync().catch(() => {});
    setActiveCategory(i);
    setSearch("");
    Animated.spring(indicatorX, {
      toValue: i * TAB_STRIDE,
      useNativeDriver: true,
      friction: 9,
      tension: 95,
    }).start();
    // keep the tapped tab in view
    const targetX = Math.max(
      0,
      i * TAB_STRIDE - SCREEN_W / 2 + TAB_SIZE / 2 + 8,
    );
    tabsScrollRef.current?.scrollTo({ x: targetX, animated: true });
    // jump back to the top of the grid
    gridListRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const emojis = search.trim()
    ? CATEGORIES.flatMap((c) => c.emojis).filter((e) => e.includes(search))
    : CATEGORIES[activeCategory].emojis;

  const renderEmoji = useCallback(
    ({ item }: { item: string }) => (
      <EmojiCell emoji={item} size={EMOJI_SIZE} onPress={onSelect} />
    ),
    [onSelect],
  );

  return (
    <Animated.View
      style={[styles.drawer, { height: heightAnim }]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Animated.View
        style={[
          styles.drawerInner,
          { paddingBottom: Math.max(insets.bottom, 8), opacity: contentOpacity },
        ]}
      >
        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search emoji..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={styles.searchInput}
          />
        </View>

        <ScrollView
          ref={tabsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
          contentContainerStyle={styles.tabsContent}
        >
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                width: TAB_SIZE,
                height: TAB_SIZE,
                transform: [{ translateX: indicatorX }],
                opacity: search ? 0 : 1,
              },
            ]}
          />
          {CATEGORIES.map((cat, i) => (
            <TouchableOpacity
              key={cat.label}
              onPress={() => handleCategoryChange(i)}
              style={styles.tab}
              activeOpacity={0.7}
            >
              <Text style={styles.tabIcon}>{cat.icon}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.divider} />

        <Animated.View
          style={{
            flex: 1,
            opacity: gridOpacity,
            transform: [{ translateY: gridTranslate }],
          }}
        >
          <FlatList
            ref={gridListRef}
            data={emojis}
            keyExtractor={emojiKeyExtractor}
            numColumns={NUM_COLS}
            renderItem={renderEmoji}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.grid}
            key={`grid-${NUM_COLS}`}
            removeClippedSubviews
            initialNumToRender={64}
            maxToRenderPerBatch={32}
            windowSize={5}
            updateCellsBatchingPeriod={50}
          />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  drawer: {
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.85)",
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  drawerInner: {
    flex: 1,
    paddingTop: 8,
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
    gap: TAB_GAP,
    alignItems: "center",
  },
  tabIndicator: {
    position: "absolute",
    left: 8,
    top: 0,
    borderRadius: 8,
    backgroundColor: "#3a3a3c",
  },
  tab: {
    width: TAB_SIZE,
    height: TAB_SIZE,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
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
