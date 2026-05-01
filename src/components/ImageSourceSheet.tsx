import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SH } = Dimensions.get("window");

interface Props {
  visible: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onClose: () => void;
}

export const ImageSourceSheet = ({ visible, onCamera, onGallery, onClose }: Props) => {
  const translateY = useRef(new Animated.Value(SH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, tension: 160, friction: 20, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SH, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setMounted(false);
        const action = pendingActionRef.current;
        if (action) {
          pendingActionRef.current = null;
          // wait one frame after the modal unmounts so the native picker UI
          // doesn't race the exit animation
          requestAnimationFrame(action);
        }
      });
    }
  }, [visible]);

  if (!mounted && !visible) return null;

  const handleOption = (fn: () => void) => {
    pendingActionRef.current = fn;
    onClose();
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }], paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Send an Image</Text>

        <View style={styles.options}>
          <TouchableOpacity style={styles.option} onPress={() => handleOption(onCamera)} activeOpacity={0.75}>
            <View style={[styles.iconCircle, { backgroundColor: "#7C3AED" }]}>
              <Ionicons name="camera" size={26} color="#fff" />
            </View>
            <Text style={styles.optionLabel}>Camera</Text>
            <Text style={styles.optionSub}>Take a new photo</Text>
          </TouchableOpacity>

          <View style={styles.dividerV} />

          <TouchableOpacity style={styles.option} onPress={() => handleOption(onGallery)} activeOpacity={0.75}>
            <View style={[styles.iconCircle, { backgroundColor: "#DB2777" }]}>
              <Ionicons name="images" size={26} color="#fff" />
            </View>
            <Text style={styles.optionLabel}>Gallery</Text>
            <Text style={styles.optionSub}>Choose from library</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#141414",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#3a3a3c",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  title: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  options: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 0,
    marginBottom: 24,
  },
  dividerV: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: 8,
  },
  option: {
    flex: 1,
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
    backgroundColor: "#1c1c1e",
    borderRadius: 20,
    marginHorizontal: 6,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  optionSub: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: "#1c1c1e",
    borderRadius: 16,
    marginBottom: 4,
  },
  cancelText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    fontWeight: "600",
  },
});
