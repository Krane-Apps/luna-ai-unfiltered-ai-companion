import { View, TextInput, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  value: string;
  onChange: (v: string) => void;
  resultCount: number;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export const SearchBar = ({
  value,
  onChange,
  resultCount,
  currentIndex,
  onPrev,
  onNext,
  onClose,
}: Props) => {
  return (
    <View style={styles.container}>
      <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.5)" style={styles.icon} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search messages..."
        placeholderTextColor="rgba(255,255,255,0.35)"
        style={styles.input}
        autoFocus
      />
      {value.length > 0 && (
        <>
          <Text style={styles.count}>
            {resultCount === 0 ? "No results" : `${currentIndex + 1}/${resultCount}`}
          </Text>
          <TouchableOpacity onPress={onPrev} style={styles.navBtn} disabled={resultCount === 0}>
            <Ionicons name="chevron-up" size={18} color={resultCount === 0 ? "#555" : "#fff"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onNext} style={styles.navBtn} disabled={resultCount === 0}>
            <Ionicons name="chevron-down" size={18} color={resultCount === 0 ? "#555" : "#fff"} />
          </TouchableOpacity>
        </>
      )}
      <TouchableOpacity onPress={onClose} style={styles.navBtn}>
        <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1c1e",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
    gap: 6,
  },
  icon: {
    marginRight: 2,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingVertical: 4,
  },
  count: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    minWidth: 60,
    textAlign: "center",
  },
  navBtn: {
    padding: 4,
  },
});
