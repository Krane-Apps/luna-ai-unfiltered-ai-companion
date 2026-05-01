import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
} from "react-native";

const { width: SW } = Dimensions.get("window");

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onClose: () => void;
}

export const AppAlert = ({
  visible,
  title,
  message,
  buttons = [{ text: "OK" }],
  onClose,
}: Props) => {
  const scale = useRef(new Animated.Value(1.06)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 300, friction: 24, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.96, duration: 130, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 130, useNativeDriver: true }),
      ]).start(() => {
        setMounted(false);
        scale.setValue(1.06);
      });
    }
  }, [visible]);

  if (!mounted && !visible) return null;

  const hasCancel = buttons.some(b => b.style === "cancel");
  const primaryBtns = buttons.filter(b => b.style !== "cancel");
  const cancelBtn = buttons.find(b => b.style === "cancel");

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      <View style={styles.centeredView} pointerEvents="box-none">
        <Animated.View style={[styles.dialog, { opacity, transform: [{ scale }] }]}>
          {/* text content */}
          <View style={styles.body}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>

          {/* button area */}
          <View style={styles.btnArea}>
            {/* primary / destructive buttons stacked */}
            {primaryBtns.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.btn,
                  btn.style === "destructive" ? styles.btnDestructive : styles.btnPrimary,
                  i > 0 && { marginTop: 8 },
                ]}
                onPress={() => { btn.onPress?.(); onClose(); }}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.btnText,
                  btn.style === "destructive" ? styles.btnTextDestructive : styles.btnTextPrimary,
                ]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}

            {/* cancel always last, ghost style */}
            {cancelBtn && (
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel]}
                onPress={() => { cancelBtn.onPress?.(); onClose(); }}
                activeOpacity={0.6}
              >
                <Text style={styles.btnTextCancel}>{cancelBtn.text}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ── Imperative singleton ──────────────────────────────────────────────────────
interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  icon?: string; // kept for API compat, ignored visually
}

type Listener = (cfg: AlertConfig | null) => void;
let _listener: Listener | null = null;

export const showAlert = (config: AlertConfig) => _listener?.(config);

export const AlertProvider = () => {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    _listener = (cfg) => {
      if (cfg) { setConfig(cfg); setVisible(true); }
    };
    return () => { _listener = null; };
  }, []);

  if (!config) return null;
  return (
    <AppAlert
      visible={visible}
      title={config.title}
      message={config.message}
      buttons={config.buttons}
      onClose={() => setVisible(false)}
    />
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  centeredView: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  dialog: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 32,
    elevation: 30,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    gap: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  message: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  btnArea: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 0,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  btnPrimary: {
    backgroundColor: "#7C3AED",
  },
  btnDestructive: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  btnCancel: {
    backgroundColor: "transparent",
  },
  btnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  btnTextPrimary: {
    color: "#fff",
  },
  btnTextDestructive: {
    color: "#EF4444",
  },
  btnTextCancel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 15,
    fontWeight: "500",
  },
});
