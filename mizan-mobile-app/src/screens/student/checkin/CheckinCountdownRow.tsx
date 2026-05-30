import React from "react";
import { Text, View } from "react-native";
import { Clock3 } from "lucide-react-native";
import { colors, spacing } from "../../../theme";
import { formatCountdown } from "./checkinWindows";

export function CheckinCountdownRow({
  label,
  countdownMs,
  centered = false,
}: {
  label: string;
  countdownMs: number;
  centered?: boolean;
}) {
  return (
    <View
      style={{
        alignItems: centered ? "center" : "flex-start",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.xs,
        justifyContent: centered ? "center" : "flex-start",
        marginTop: centered ? 0 : spacing.sm,
      }}
    >
      <Clock3 color={colors.primary} size={16} />
      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{label}:</Text>
      <Text
        style={{
          color: colors.text,
          fontSize: 13,
          fontWeight: "800",
          letterSpacing: 0.4,
        }}
      >
        {formatCountdown(countdownMs)}
      </Text>
    </View>
  );
}
