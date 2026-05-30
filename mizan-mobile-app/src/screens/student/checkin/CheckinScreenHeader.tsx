import React from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowLeft, Moon, Sun } from "lucide-react-native";
import { useAuth } from "../../../context/AuthContext";
import { colors, spacing } from "../../../theme";
import { checkinStyles as s } from "./checkinStyles";

export type CheckinStep = "format" | "form" | "result";

export function CheckinScreenHeader({
  period,
  step,
  onBack,
  questionIndex = 0,
  questionTotal = 0,
}: {
  period: "MORNING" | "EVENING";
  step: CheckinStep;
  onBack: () => void;
  questionIndex?: number;
  questionTotal?: number;
}) {
  const { student } = useAuth();
  const isMorning = period === "MORNING";
  const Icon = isMorning ? Sun : Moon;
  const name = student?.first_name ?? "there";
  const progress = questionTotal > 0 ? (questionIndex + 1) / questionTotal : 0;

  return (
    <View style={{ marginBottom: step === "form" ? 0 : undefined }}>
      <Pressable onPress={onBack} hitSlop={10} style={({ pressed }) => [s.backRow, { opacity: pressed ? 0.65 : 1 }]}>
        <ArrowLeft color={colors.muted} size={18} />
        <Text style={s.backText}>Back</Text>
      </Pressable>

      {step === "format" ? (
        <View>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 6, marginBottom: spacing.xs }}>
            <Icon color={colors.primary} size={14} />
            <Text style={s.periodLabel}>{isMorning ? "Morning check-in" : "Evening check-in"}</Text>
          </View>
          <Text style={s.greeting}>
            {isMorning ? `Good morning, ${name}.` : `Good evening, ${name}.`}
          </Text>
          <Text style={s.stepHint}>Choose how you&apos;d like to reflect today.</Text>
        </View>
      ) : null}

      {step === "form" && questionTotal > 0 ? (
        <View>
          <Text style={s.progressMeta}>
            {isMorning ? "Morning" : "Evening"} · Question {questionIndex + 1} of {questionTotal}
          </Text>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${Math.max(8, progress * 100)}%` }]} />
          </View>
        </View>
      ) : null}

      {step === "result" ? (
        <View style={s.resultHero}>
          <View style={s.resultIcon}>
            <Icon color={colors.success} size={28} />
          </View>
          <Text style={s.resultTitle}>{isMorning ? "Morning complete" : "Evening complete"}</Text>
          <Text style={s.resultSub}>Here&apos;s what Mizan picked up from your check-in.</Text>
        </View>
      ) : null}
    </View>
  );
}
