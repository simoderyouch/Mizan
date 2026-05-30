import React from "react";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius, shadow, spacing } from "../theme";

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 360;
  return (
    <View style={styles.sectionTitle}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.h1, compact && styles.h1Compact]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Button({
  children,
  variant = "primary",
  loading,
  disabled,
  style,
  textStyle,
  ...props
}: Omit<PressableProps, "style"> & {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const content = React.Children.toArray(children)
    .filter((child) => child != null)
    .filter((child) => typeof child !== "string" || child.trim().length > 0)
    .map((child, index) => {
      if (typeof child === "string" || typeof child === "number") {
        return (
          <Text
            key={`button-text-${index}`}
            style={[
              styles.buttonText,
              (variant === "secondary" || variant === "ghost") && styles.buttonTextSecondary,
              textStyle,
            ]}
          >
            {child}
          </Text>
        );
      }
      return React.isValidElement(child)
        ? React.cloneElement(child, { key: child.key ?? `button-node-${index}` })
        : null;
    });

  const buttonStyle = [
    styles.button,
    variant === "primary" && styles.buttonPrimary,
    variant === "secondary" && styles.buttonSecondary,
    variant === "ghost" && styles.buttonGhost,
    variant === "danger" && styles.buttonDanger,
    (disabled || loading) && styles.disabled,
    style,
  ];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [buttonStyle, pressed && !disabled && !loading && styles.pressed]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? colors.onPrimary : colors.primary} />
      ) : (
        content
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string; style?: StyleProp<TextStyle> }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="rgba(110, 115, 125, 0.6)"
        style={[styles.input, style]}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function flattenTextChildren(children: React.ReactNode): string {
  if (children == null || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  return React.Children.toArray(children).map(flattenTextChildren).join("");
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning" | "primary" | "purple";
}) {
  return (
    <View
      style={[
        styles.badge,
        tone === "success" && styles.badgeSuccess,
        tone === "danger" && styles.badgeDanger,
        tone === "warning" && styles.badgeWarning,
        tone === "primary" && styles.badgePrimary,
        tone === "purple" && styles.badgePurple,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          tone === "success" && { color: colors.success },
          tone === "danger" && { color: colors.danger },
          tone === "warning" && { color: colors.warning },
          tone === "primary" && { color: colors.primary },
          tone === "purple" && { color: colors.accent },
        ]}
      >
        {flattenTextChildren(children)}
      </Text>
    </View>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <View style={styles.centerState}>
      <View style={styles.loaderMark}>
        <ActivityIndicator color={colors.primary} />
      </View>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <Card style={[styles.centerState, styles.emptyCard]}>
      <View style={styles.emptyMark} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
    </Card>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorBannerText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry}>
          <Text style={styles.retryText}>Réessayer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Metric({
  label,
  value,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  tone?: "primary" | "success" | "warning" | "purple";
}) {
  return (
    <View
      style={[
        styles.metric,
        tone === "success" && { backgroundColor: colors.successSoft },
        tone === "warning" && { backgroundColor: colors.warningSoft },
        tone === "purple" && { backgroundColor: colors.accentSoft },
      ]}
    >
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: "rgba(194, 198, 211, 0.18)",
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadow,
  },
  sectionTitle: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  h1: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 35,
  },
  h1Compact: {
    fontSize: 26,
    lineHeight: 31,
  },
  h2: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  h3: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    alignItems: "center",
    borderRadius: 999, // Pill shape for modern look
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.surfaceLow,
    borderColor: "rgba(194, 198, 211, 0.22)",
    borderWidth: 1,
  },
  buttonGhost: {
    backgroundColor: "transparent",
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  buttonTextSecondary: {
    color: colors.primary,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  input: {
    backgroundColor: colors.surfaceLow,
    borderColor: "rgba(194, 198, 211, 0.4)",
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceLow,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  badgePrimary: {
    backgroundColor: colors.primarySoft,
  },
  badgeSuccess: {
    backgroundColor: colors.successSoft,
  },
  badgeDanger: {
    backgroundColor: colors.dangerSoft,
  },
  badgeWarning: {
    backgroundColor: colors.warningSoft,
  },
  badgePurple: {
    backgroundColor: colors.accentSoft,
  },
  badgeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  centerState: {
    alignItems: "center",
    gap: spacing.md,
    justifyContent: "center",
    padding: spacing.xl,
  },
  loaderMark: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  emptyCard: {
    borderStyle: "dashed",
    shadowOpacity: 0,
  },
  emptyMark: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 12,
    width: 48,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  errorBanner: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  errorBannerText: {
    color: colors.danger,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  retryText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  metric: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(194, 198, 211, 0.18)",
    borderRadius: radius.xl,
    borderWidth: 1,
    flex: 1,
    minHeight: 82,
    padding: spacing.md,
  },
  metricValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
});
