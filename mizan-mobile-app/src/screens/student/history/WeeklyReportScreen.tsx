import React from "react";
import { Text, View } from "react-native";
import { Screen } from "../../../components/screen";
import {
  Badge,
  Card,
  ErrorBanner,
  LoadingState,
  Metric,
  styles as uiStyles,
} from "../../../components/ui";
import { analyticsApi } from "../../../lib/api";
import type { WeeklyReport } from "../../../lib/types";
import { colors, spacing } from "../../../theme";
import { styles } from "../styles";
import { dateLabel } from "../utils";
import { useLoader } from "../hooks/useLoader";

function stressTone(level: string): "success" | "warning" | "danger" {
  if (level === "LOW") return "success";
  if (level === "MEDIUM") return "warning";
  return "danger";
}

export function WeeklyReportScreen() {
  const loader = useLoader<WeeklyReport>(() => analyticsApi.weeklyReport());

  if (loader.loading && !loader.data) return <Screen variant="stack"><LoadingState /></Screen>;

  const data = loader.data;

  return (
    <Screen variant="stack" refreshing={loader.loading} onRefresh={loader.load}>
      {data ? (
        <Text style={[uiStyles.muted, { marginBottom: spacing.sm }]}>
          {dateLabel(data.week_start)} → {dateLabel(data.week_end)}
        </Text>
      ) : null}
      <ErrorBanner message={loader.error} onRetry={loader.load} />

      {data ? (
        <Card style={[styles.gapCard, { backgroundColor: colors.primarySoft }]}>
          <Text style={[uiStyles.h2, { color: colors.primary }]}>Week summary</Text>
          <Text style={uiStyles.muted}>
            {data.total_checkins} check-ins · {data.goals_achieved} goals hit
          </Text>
        </Card>
      ) : null}

      <View style={styles.metricRow}>
        <Metric label="Avg. mood" value={data?.avg_mood.toFixed(1) ?? "-"} />
        <Metric label="Avg. sleep" value={data?.avg_sleep.toFixed(1) ?? "-"} tone="purple" />
      </View>
      <View style={styles.metricRow}>
        <Metric label="Check-ins" value={data?.total_checkins ?? 0} tone="success" />
        <Metric label="Goals achieved" value={data?.goals_achieved ?? 0} tone="warning" />
      </View>

      {data?.stress_level ? (
        <Card style={styles.gapCard}>
          <Text style={uiStyles.h2}>Stress level</Text>
          <Badge tone={stressTone(String(data.stress_level))}>
            {String(data.stress_level).toLowerCase()}
          </Badge>
        </Card>
      ) : null}

      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Mode distribution</Text>
        {data?.mode_distribution?.length ? data.mode_distribution.map((item) => (
          <View key={item.mode} style={styles.statRow}>
            <Text style={styles.listTitle}>{item.mode}</Text>
            <Text style={uiStyles.muted}>{item.total_minutes} min · {Math.round(item.percentage)}%</Text>
          </View>
        )) : (
          <Text style={uiStyles.muted}>No mode data yet.</Text>
        )}
      </Card>
    </Screen>
  );
}
