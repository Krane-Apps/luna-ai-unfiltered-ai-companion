import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Switch,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const MENU_WIDTH = 230;

interface Props {
  visible: boolean;
  isMuted: boolean;
  menuTop: number; // pixels from top of screen where menu should start
  onClose: () => void;
  onToggleMute: () => void;
  onSearch: () => void;
  onTheme: () => void;
  onSettings: () => void;
}

export const HeaderMenu = ({
  visible,
  isMuted,
  menuTop,
  onClose,
  onToggleMute,
  onSearch,
  onTheme,
  onSettings,
}: Props) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 220, friction: 18, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 130, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.88, duration: 130, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.menu,
          { top: menuTop, opacity, transform: [{ scale }, { translateX: 6 }] },
        ]}
        pointerEvents="box-none"
      >
        {/* mute notifications */}
        <TouchableOpacity style={styles.row} onPress={onToggleMute} activeOpacity={0.7}>
          <Ionicons
            name={isMuted ? "notifications-off-outline" : "notifications-outline"}
            size={19}
            color={isMuted ? "#9CA3AF" : "#fff"}
          />
          <Text style={[styles.label, isMuted && styles.labelMuted]}>Mute notifications</Text>
          <Switch
            value={isMuted}
            onValueChange={onToggleMute}
            trackColor={{ false: "#3a3a3c", true: "#7C3AED" }}
            thumbColor="#fff"
            style={styles.switch}
          />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* search */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => { onClose(); setTimeout(onSearch, 160); }}
          activeOpacity={0.7}
        >
          <Ionicons name="search-outline" size={19} color="#fff" />
          <Text style={styles.label}>Search messages</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* chat theme */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => { onClose(); setTimeout(onTheme, 160); }}
          activeOpacity={0.7}
        >
          <Ionicons name="color-palette-outline" size={19} color="#fff" />
          <Text style={styles.label}>Chat theme</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* settings */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => { onClose(); setTimeout(onSettings, 160); }}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={19} color="#fff" />
          <Text style={styles.label}>Settings</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    right: 12,
    width: MENU_WIDTH,
    backgroundColor: "#1c1c1e",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 24,
    overflow: "hidden",
    // transform origin top-right approximated via translateX
    transformOrigin: "top right",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 13,
  },
  label: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  labelMuted: {
    color: "#9CA3AF",
  },
  switch: {
    transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginHorizontal: 16,
  },
});
