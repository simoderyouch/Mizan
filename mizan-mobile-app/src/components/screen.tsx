import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { Edge, SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";

export type ScreenVariant = "default" | "tab" | "stack" | "stackBare";

export function Screen({
  children,
  scroll = true,
  padded = true,
  variant = "default",
  style,
  refreshing = false,
  onRefresh,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  variant?: ScreenVariant;
  style?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  // Tab / stackBare: no native header — need top inset for the status bar.
  // stack: native header already handles top inset.
  const edges: Edge[] =
    variant === "stack" ? ["left", "right", "bottom"] : ["top", "left", "right"];

  const contentStyle = [
    padded && styles.content,
    (variant === "stack" || variant === "stackBare") && styles.contentStack,
    style,
  ];
  return (
    <SafeAreaView edges={edges} style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[contentStyle, styles.scrollBottom]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
              ) : undefined
            }
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, contentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  contentStack: {
    paddingTop: spacing.sm,
  },
  scrollBottom: {
    paddingBottom: spacing.xl,
  },
});
