import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Loader2, Mic, Volume2 } from "lucide-react-native";
import { colors } from "../../../theme";

const OUTER = 240;
const INNER = 188;
const ICON = 48;

export function VoiceCompanionOrb({
  isRecording,
  isProcessing,
  isPlaying,
}: {
  isRecording: boolean;
  isProcessing: boolean;
  isPlaying: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const shouldPulse = isRecording || isPlaying;

  useEffect(() => {
    if (!shouldPulse) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: isRecording ? 900 : 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: isRecording ? 900 : 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, shouldPulse, isRecording]);

  useEffect(() => {
    if (!isProcessing) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isProcessing, spin]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const glowColor = isRecording
    ? "rgba(248,113,113,0.22)"
    : isPlaying
      ? "rgba(0,92,174,0.25)"
      : isProcessing
        ? "rgba(0,92,174,0.15)"
        : "rgba(0,92,174,0.1)";

  const innerBorder = isRecording ? "rgba(252,165,165,0.8)" : "rgba(0,92,174,0.2)";
  const innerBg = isRecording ? "#FEF2F2" : colors.surface;
  const iconColor = isRecording ? colors.danger : colors.primary;

  return (
    <View style={styles.wrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: glowColor,
            opacity: shouldPulse ? glowOpacity : 1,
          },
        ]}
      />
      <View style={[styles.inner, { backgroundColor: innerBg, borderColor: innerBorder }]}>
        {isProcessing ? (
          <Animated.View style={{ transform: [{ rotate: spinDeg }] }}>
            <Loader2 color={colors.primary} size={ICON} />
          </Animated.View>
        ) : isPlaying ? (
          <Volume2 color={colors.primary} size={ICON} />
        ) : (
          <Mic color={iconColor} size={ICON} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    height: OUTER,
    justifyContent: "center",
    width: OUTER,
  },
  glow: {
    borderRadius: 999,
    bottom: 12,
    left: 12,
    position: "absolute",
    right: 12,
    top: 12,
  },
  inner: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 2,
    height: INNER,
    justifyContent: "center",
    width: INNER,
  },
});
