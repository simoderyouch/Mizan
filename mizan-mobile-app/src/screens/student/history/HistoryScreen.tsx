import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Screen } from "../../../components/screen";
import {
  Badge,
  Card,
  ErrorBanner,
  LoadingState,
  Metric,
  styles as uiStyles,
} from "../../../components/ui";
import { analyticsApi, checkinsApi } from "../../../lib/api";
import type { CheckinHistoryResponse, MoodGraphPoint } from "../../../lib/types";
import { colors, spacing } from "../../../theme";
import { styles } from "../styles";
import { dateLabel } from "../utils";
import { useLoader } from "../hooks/useLoader";

const PERIODS = [7, 14, 30] as const;

export function HistoryScreen() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(14);
  const loader = useLoader<CheckinHistoryResponse>(() => checkinsApi.history(days), [days]);
  const [moodPoints, setMoodPoints] = useState<MoodGraphPoint[]>([]);
  const [modeStats, setModeStats] = useState<Array<{ mode: string; total_minutes: number; percentage: number }>>([]);

  useEffect(() => {
    void Promise.all([
      analyticsApi.mood(days).then(setMoodPoints).catch(() => setMoodPoints([])),
      analyticsApi.modes(days).then(setModeStats).catch(() => setModeStats([])),
    ]);
  }, [days]);

  if (loader.loading && !loader.data) return <Screen variant="stack"><LoadingState /></Screen>;

  const timeline = [...(loader.data?.morning_checkins ?? []), ...(loader.data?.evening_checkins ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Screen variant="stack" refreshing={loader.loading} onRefresh={loader.load}>
      <Text style={[uiStyles.muted, { marginBottom: spacing.sm }]}>Last {days} days</Text>
      <ErrorBanner message={loader.error} onRetry={loader.load} />

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {PERIODS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setDays(p)}
            style={[styles.choice, days === p && styles.choiceActive, { flex: 1 }]}
          >
            <Text style={[styles.choiceText, days === p && styles.choiceTextActive, { textAlign: "center" }]}>
              {p}d
            </Text>
          </Pressable>
        ))}
      </View>

      <Card style={styles.gapCard}>
        <View style={styles.metricRow}>
          <Metric label="Morning mood" value={loader.data?.averages.morning_mood.toFixed(1) ?? "-"} />
          <Metric label="Sleep" value={loader.data?.averages.sleep_hours.toFixed(1) ?? "-"} tone="purple" />
        </View>
        <View style={styles.metricRow}>
          <Metric label="Check-ins" value={timeline.length} tone="success" />
          <Metric label="Evening mood" value={loader.data?.averages.evening_mood?.toFixed(1) ?? "-"} tone="warning" />
        </View>
      </Card>

      {moodPoints.length > 0 ? (
        <Card style={styles.gapCard}>
          <Text style={uiStyles.h2}>Mood rhythm</Text>
          <View style={styles.barRow}>
            {moodPoints.slice(-14).map((point) => {
              const score = Number(point.mood_score) || 3;
              const activeHeight = Math.max(12, score * 17);
              const barColor = score >= 4 ? colors.success : score === 3 ? colors.primary : colors.warning;
              return (
                <View key={point.date} style={styles.barWrap}>
                  <View style={styles.barTrack}>
                    <View style={[styles.bar, { height: activeHeight, backgroundColor: barColor }]} />
                  </View>
                  <Text style={styles.barLabel}>{point.date.slice(-2)}</Text>
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

      {modeStats.length > 0 ? (
        <Card style={styles.gapCard}>
          <Text style={uiStyles.h2}>Focus modes</Text>
          {modeStats.map((item) => (
            <View key={item.mode} style={styles.statRow}>
              <Text style={styles.listTitle}>{item.mode}</Text>
              <Text style={uiStyles.muted}>{item.total_minutes} min · {Math.round(item.percentage)}%</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {timeline.slice(0, 20).map((item) => (
        <Card key={item.id} style={styles.gapCard}>
          <View style={styles.spaceBetween}>
            <Text style={uiStyles.h3}>{dateLabel(item.date)}</Text>
            <Badge tone="primary">{item.mood_score}/5</Badge>
          </View>
          <Text style={uiStyles.muted}>{item.executive_summary ?? "No summary available."}</Text>
          {item.detected_risks?.length ? (
            <Text style={[uiStyles.muted, { color: colors.warning, marginTop: 4 }]}>
              Risks: {item.detected_risks.join(", ")}
            </Text>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
