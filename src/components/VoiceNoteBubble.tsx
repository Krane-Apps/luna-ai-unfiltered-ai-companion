// WhatsApp-style voice note bubble: play/pause button, fake waveform that
// fills as the audio plays, mm:ss duration. Tap toggles playback. Audio is
// loaded lazily on first play to keep memory usage low when many voice notes
// are visible in the list.

import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";

const formatTime = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

// pseudo-random but deterministic bar heights — looks waveform-y without
// needing real audio analysis
const BAR_COUNT = 28;
const BARS: number[] = (() => {
  const arr: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    // mix two sine waves for a non-uniform pattern
    const a = Math.sin(i * 0.6) * 0.5 + 0.5;
    const b = Math.sin(i * 1.7 + 0.4) * 0.5 + 0.5;
    arr.push(0.25 + (a * 0.6 + b * 0.4) * 0.75);
  }
  return arr;
})();

interface Props {
  audioUri: string;
  durationMs: number;
  isUser: boolean;
}

export const VoiceNoteBubble = React.memo(function VoiceNoteBubble({
  audioUri,
  durationMs,
  isUser,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [elapsedMs, setElapsedMs] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  // unload on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  const stopAndReset = async () => {
    try {
      await soundRef.current?.stopAsync();
      await soundRef.current?.setPositionAsync(0);
    } catch {}
    setIsPlaying(false);
    setProgress(0);
    setElapsedMs(0);
  };

  const togglePlay = async () => {
    try {
      // Pause path: simple, just pause and update state.
      if (isPlaying) {
        await soundRef.current?.pauseAsync();
        setIsPlaying(false);
        return;
      }

      // Switch the audio session into playback mode. After recording,
      // expo-av may still have allowsRecordingIOS:true set, which makes
      // pauseAsync/play callbacks unreliable. Force playback config.
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Resume path: existing sound, reset to start if it had finished.
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          const total = status.durationMillis || durationMs || 0;
          const atEnd =
            status.didJustFinish ||
            (total > 0 && (status.positionMillis ?? 0) >= total - 50);
          if (atEnd) await soundRef.current.setPositionAsync(0);
        }
        await soundRef.current.playAsync();
        setIsPlaying(true);
        return;
      }

      // First play: create the Sound and start tracking progress.
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          const total = status.durationMillis || durationMs || 1;
          const pos = status.positionMillis || 0;
          setProgress(Math.min(1, pos / total));
          setElapsedMs(Math.min(pos, total));

          // Robust end-of-clip detection. m4a recordings often lack reliable
          // duration metadata, so didJustFinish doesn't always fire — fall
          // back to comparing position against the recorded durationMs.
          const reachedEnd =
            status.didJustFinish ||
            (durationMs > 0 && pos >= durationMs);
          if (reachedEnd) stopAndReset();
        },
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (e) {
      console.warn("[VoiceNote] playback error:", e);
      setIsPlaying(false);
    }
  };

  const playedBars = progress * BAR_COUNT;
  const showElapsed = isPlaying || elapsedMs > 0;
  const timeText = showElapsed ? formatTime(elapsedMs) : formatTime(durationMs);

  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
      <TouchableOpacity
        onPress={togglePlay}
        style={styles.playBtn}
        activeOpacity={0.75}
        hitSlop={6}
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={18}
          color="#fff"
          style={!isPlaying ? { marginLeft: 2 } : undefined}
        />
      </TouchableOpacity>

      <View style={styles.waveform}>
        {BARS.map((amp, i) => {
          const isPlayed = i < playedBars;
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: 4 + amp * 18,
                  backgroundColor: isPlayed
                    ? "rgba(255,255,255,0.95)"
                    : "rgba(255,255,255,0.35)",
                },
              ]}
            />
          );
        })}
      </View>

      <Text style={styles.duration}>{timeText}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 22,
    minWidth: 220,
    gap: 10,
  },
  userBubble: {
    backgroundColor: "#7C3AED",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "#262626",
    borderBottomLeftRadius: 4,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  waveform: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 28,
  },
  bar: {
    width: 2,
    borderRadius: 1,
  },
  duration: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    minWidth: 30,
    textAlign: "right",
  },
});
