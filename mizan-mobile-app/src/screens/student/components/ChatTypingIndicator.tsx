import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { colors, radius, spacing } from "../../../theme";

function TypingDot({ delayMs }: { delayMs: number }) {
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(bounce, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 380,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(200 - delayMs / 3),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, delayMs]);

  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });

  return (
    <Animated.View
      style={[styles.dot, { opacity: 0.6, transform: [{ translateY }] }]}
      accessibilityElementsHidden
    />
  );
}

export function ChatTypingIndicator() {
  return (
    <View style={styles.row} accessibilityLabel="Mizan is thinking">
      <View style={styles.avatar}>
        <Sparkles color={colors.primary} size={16} />
      </View>
      <View style={styles.bubble}>
        <View style={styles.dotsRow}>
          <TypingDot delayMs={0} />
          <TypingDot delayMs={150} />
          <TypingDot delayMs={300} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-start",
    width: "100%",
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    marginTop: 2,
    width: 32,
  },
  bubble: {
    backgroundColor: colors.surfaceLow,
    borderColor: "rgba(194,198,211,0.35)",
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
    borderWidth: 1,
    maxWidth: "82%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dotsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    paddingVertical: 2,
  },
  dot: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
});
