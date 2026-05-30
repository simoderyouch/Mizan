import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CheckCircle2, Heart, Mic, Moon, Sparkles, Sun } from "lucide-react-native";
import { Screen } from "../../../components/screen";
import { Badge, Card, ErrorBanner, LoadingState, styles as uiStyles } from "../../../components/ui";
import { analyticsApi, checkinsApi } from "../../../lib/api";
import { colors, radius, spacing } from "../../../theme";
import { useLoader } from "../hooks/useLoader";
import { useCheckinWindows } from "../hooks/useCheckinWindows";
import { styles } from "../styles";
import type { Nav } from "../types";
import { CheckinCountdownRow } from "./CheckinCountdownRow";

export function CheckinHubScreen({ navigation }: { navigation: Nav }) {
  const { data, loading, error, load } = useLoader(() => checkinsApi.morningBriefing());
  const dashboard = useLoader(() => analyticsApi.dashboard());
  const [dashboardSynced, setDashboardSynced] = useState(false);

  useEffect(() => {
    void dashboard.load().then(() => setDashboardSynced(true));
  }, []);

  const morningDone =
    dashboard.data?.has_morning_checkin ?? data?.checkin_status?.has_morning_today ?? false;
  const eveningDone =
    dashboard.data?.has_evening_checkin ?? data?.checkin_status?.has_evening_today ?? false;
  const completedCount = Number(morningDone) + Number(eveningDone);
  const allDone = completedCount === 2;
  const nextRitual = !morningDone ? "morning" : !eveningDone ? "evening" : null;

  const { morningWindow, eveningWindow } = useCheckinWindows(morningDone, eveningDone);

  if ((loading && !data) || (!dashboardSynced && dashboard.loading)) {
    return (
      <Screen variant="tab">
        <LoadingState label="Loading wellbeing..." />
      </Screen>
    );
  }

  return (
    <Screen
      variant="tab"
      refreshing={loading || dashboard.loading}
      onRefresh={() => {
        void load();
        void dashboard.load();
      }}
    >
      <ErrorBanner message={error || dashboard.error} onRetry={() => { void load(); void dashboard.load(); }} />

      <View style={hero.wrap}>
        <View style={hero.badge}>
          <Heart color={colors.primary} size={12} />
          <Text style={hero.badgeText}>Daily wellbeing</Text>
        </View>

        <Text style={hero.title}>
          {allDone
            ? "You're balanced for today"
            : nextRitual === "morning"
              ? "Start your morning ritual"
              : "How was your day?"}
        </Text>
        <Text style={hero.sub}>
          {allDone
            ? "Both rituals are done. Your weekly insights stay fresh when you show up each day."
            : nextRitual === "morning"
              ? "A quick voice or quiz check-in sets your mood, sleep, and focus."
              : "Close the loop with an evening review — voice or quiz."}
        </Text>

        <View style={hero.pills}>
          <RitualPill done={morningDone} label="Morning" icon={Sun} />
          <RitualPill done={eveningDone} label="Evening" icon={Moon} />
        </View>

        <View style={hero.progressCard}>
          <Text style={hero.progressLabel}>Today&apos;s rituals</Text>
          <View style={hero.progressRow}>
            <RitualStep done={morningDone} icon={Sun} />
            <View style={[hero.progressLine, (morningDone || eveningDone) && hero.progressLineActive]} />
            <RitualStep done={eveningDone} icon={Moon} />
          </View>
          <Text style={hero.progressMeta}>
            {allDone ? (
              <Text style={{ color: colors.success, fontWeight: "700" }}>Both complete</Text>
            ) : (
              <Text>
                <Text style={{ color: colors.primary, fontWeight: "800" }}>{completedCount}</Text>
                <Text style={{ color: colors.muted }}> of 2 done</Text>
              </Text>
            )}
          </Text>
        </View>

        {!allDone ? (
          <>
            <Pressable
              onPress={() =>
                navigation.navigate(nextRitual === "evening" ? "EveningCheckin" : "MorningCheckin")
              }
              style={({ pressed }) => [hero.primaryBtn, pressed && { opacity: 0.92 }]}
            >
              {nextRitual === "morning" ? (
                <Sun color={colors.onPrimary} size={18} />
              ) : (
                <Moon color={colors.onPrimary} size={18} />
              )}
              <Text style={hero.primaryBtnText}>
                {nextRitual === "morning" ? "Morning check-in" : "Evening check-in"}
              </Text>
            </Pressable>

            <View style={hero.modeGrid}>
              <Pressable
                onPress={() =>
                  navigation.navigate("VoiceCheckin", {
                    period: nextRitual === "evening" ? "EVENING" : "MORNING",
                  })
                }
                style={({ pressed }) => [hero.modeCard, pressed && { opacity: 0.9 }]}
              >
                <View style={hero.modeIcon}>
                  <Mic color={colors.primary} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={hero.modeTitle}>Voice mode</Text>
                  <Text style={hero.modeSub}>Hands-free, AI-guided</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() =>
                  navigation.navigate(nextRitual === "evening" ? "EveningCheckin" : "MorningCheckin")
                }
                style={({ pressed }) => [hero.modeCard, pressed && { opacity: 0.9 }]}
              >
                <View style={hero.modeIcon}>
                  <Sparkles color={colors.primary} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={hero.modeTitle}>Quiz mode</Text>
                  <Text style={hero.modeSub}>Quick adaptive questions</Text>
                </View>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.ritualPath}>
        <Pressable
          onPress={() => navigation.navigate("MorningCheckin")}
          style={({ pressed }) => [
            styles.ritualStepCard,
            morningDone && styles.ritualStepCardDone,
            pressed && styles.voicePressed,
          ]}
        >
          <View style={[styles.ritualStepIcon, morningDone && styles.ritualStepIconDone]}>
            {morningDone ? (
              <CheckCircle2 color={colors.success} size={20} />
            ) : (
              <Sun color={colors.primary} size={20} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ritualStepTitle}>Morning</Text>
            <Text style={styles.ritualStepSub}>Sleep, mood, and today&apos;s focus.</Text>
            <CheckinCountdownRow label={morningWindow.countdownLabel} countdownMs={morningWindow.countdownMs} />
          </View>
          <Badge tone={morningWindow.canStart ? "primary" : morningDone ? "success" : "neutral"}>
            {morningWindow.status}
          </Badge>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("EveningCheckin")}
          style={({ pressed }) => [
            styles.ritualStepCard,
            eveningDone && styles.ritualStepCardDone,
            pressed && styles.voicePressed,
          ]}
        >
          <View style={[styles.ritualStepIcon, eveningDone && styles.ritualStepIconDone]}>
            {eveningDone ? (
              <CheckCircle2 color={colors.success} size={20} />
            ) : (
              <Moon color={colors.primary} size={20} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ritualStepTitle}>Evening</Text>
            <Text style={styles.ritualStepSub}>Review, plan completed, recovery.</Text>
            <CheckinCountdownRow label={eveningWindow.countdownLabel} countdownMs={eveningWindow.countdownMs} />
          </View>
          <Badge tone={eveningWindow.canStart ? "primary" : eveningDone ? "success" : "neutral"}>
            {eveningWindow.status}
          </Badge>
        </Pressable>
      </View>

      {data?.priority_items.length ? (
        <Card style={styles.ritualInsightCard}>
          <Text style={uiStyles.h2}>Today&apos;s focus</Text>
          {data.priority_items.map((item, index) => (
            <View key={item} style={styles.ritualPriorityRow}>
              <Text style={styles.ritualPriorityIndex}>{index + 1}</Text>
              <Text style={styles.ritualPriorityText}>{item}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function RitualPill({
  done,
  label,
  icon: Icon,
}: {
  done: boolean;
  label: string;
  icon: typeof Sun;
}) {
  return (
    <View style={[hero.pill, done && hero.pillDone]}>
      <Icon color={done ? colors.success : colors.primary} size={14} />
      <Text style={hero.pillText}>
        {label} {done ? "· done" : "· pending"}
      </Text>
    </View>
  );
}

function RitualStep({ done, icon: Icon }: { done: boolean; icon: typeof Sun }) {
  return (
    <View style={[hero.stepCircle, done && hero.stepCircleDone]}>
      <Icon color={done ? colors.onPrimary : colors.muted} size={16} />
    </View>
  );
}

const hero = {
  wrap: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(0,92,174,0.12)",
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  badge: {
    alignItems: "center" as const,
    alignSelf: "flex-start" as const,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderColor: "rgba(0,92,174,0.15)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row" as const,
    gap: 6,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800" as const,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800" as const,
    lineHeight: 28,
  },
  sub: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  pills: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pill: {
    alignItems: "center" as const,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderColor: "rgba(194,198,211,0.4)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row" as const,
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  pillDone: {
    backgroundColor: colors.successSoft,
    borderColor: "rgba(5,150,105,0.25)",
  },
  pillText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700" as const,
  },
  progressCard: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  progressLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    textTransform: "uppercase" as const,
  },
  progressRow: {
    alignItems: "center" as const,
    flexDirection: "row" as const,
    gap: spacing.sm,
  },
  progressLine: {
    backgroundColor: "rgba(194,198,211,0.35)",
    flex: 1,
    height: 2,
    borderRadius: 999,
  },
  progressLineActive: {
    backgroundColor: colors.primary,
  },
  progressMeta: {
    marginTop: spacing.sm,
    textAlign: "center" as const,
    fontSize: 12,
  },
  primaryBtn: {
    alignItems: "center" as const,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    flexDirection: "row" as const,
    gap: spacing.sm,
    justifyContent: "center" as const,
    marginTop: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: "800" as const,
  },
  modeGrid: {
    flexDirection: "row" as const,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modeCard: {
    backgroundColor: "rgba(255,255,255,0.65)",
    borderColor: "rgba(255,255,255,0.8)",
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row" as const,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  modeIcon: {
    alignItems: "center" as const,
    backgroundColor: "rgba(0,92,174,0.1)",
    borderRadius: radius.md,
    height: 40,
    justifyContent: "center" as const,
    width: 40,
  },
  modeTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800" as const,
  },
  modeSub: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  stepCircle: {
    alignItems: "center" as const,
    borderColor: "rgba(194,198,211,0.5)",
    borderRadius: 999,
    borderWidth: 2,
    height: 36,
    justifyContent: "center" as const,
    width: 36,
  },
  stepCircleDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
};
