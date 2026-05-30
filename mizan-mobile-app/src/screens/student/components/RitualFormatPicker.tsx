import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ChevronRight, Mic, Zap } from "lucide-react-native";
import { colors } from "../../../theme";
import { checkinStyles as s } from "../checkin/checkinStyles";

export function RitualFormatPicker({
  onVoice,
  onQuiz,
  quizLoading = false,
}: {
  onVoice: () => void;
  onQuiz: () => void;
  quizLoading?: boolean;
}) {
  return (
    <View style={s.surface}>
      <View style={s.formatGroup}>
        <FormatRow
          disabled={quizLoading}
          icon={<Mic color={colors.primary} size={22} />}
          onPress={onVoice}
          showBorder
          subtitle="Speak naturally — Mizan listens and saves your answers."
          title="Voice conversation"
        />
        <FormatRow
          disabled={quizLoading}
          icon={
            quizLoading ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Zap color={colors.primary} size={22} />
            )
          }
          onPress={onQuiz}
          subtitle={quizLoading ? "Generating your questions…" : "Short personalized quiz based on your week."}
          title="Dynamic quiz"
        />
      </View>
    </View>
  );
}

function FormatRow({
  onPress,
  disabled,
  icon,
  title,
  subtitle,
  showBorder,
}: {
  onPress: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  showBorder?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.formatRow,
        showBorder && s.formatRowBorder,
        { opacity: disabled ? 0.55 : pressed ? 0.88 : 1 },
      ]}
    >
      <View style={s.formatIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.formatTitle}>{title}</Text>
        <Text style={s.formatSub}>{subtitle}</Text>
      </View>
      {!disabled ? <ChevronRight color={colors.outline} size={20} /> : null}
    </Pressable>
  );
}
