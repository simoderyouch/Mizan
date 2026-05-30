import React from "react";
import { Pressable, Text, View } from "react-native";
import { Plus } from "lucide-react-native";
import { Screen } from "../../../components/screen";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  styles as uiStyles,
} from "../../../components/ui";
import { goalsApi } from "../../../lib/api";
import type { Goal, GoalTodaySummary } from "../../../lib/types";
import { colors, spacing } from "../../../theme";
import { styles } from "../styles";
import type { Nav } from "../types";
import { useLoader } from "../hooks/useLoader";

export function GoalsScreen({ navigation }: { navigation: Nav }) {
  const loader = useLoader<Goal[]>(() => goalsApi.list());
  const todayLoader = useLoader<GoalTodaySummary[]>(() => goalsApi.today());
  
  if ((loader.loading && !loader.data) || (todayLoader.loading && !todayLoader.data)) return <Screen variant="stack"><LoadingState /></Screen>;
  const summaries = new Map((todayLoader.data ?? []).map((item) => [item.goal_id, item]));
  
  return (
    <Screen variant="stack" refreshing={loader.loading || todayLoader.loading} onRefresh={() => { void loader.load(); void todayLoader.load(); }}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: spacing.sm }}>
        <Button onPress={() => navigation.navigate("NewGoal")} style={{ minHeight: 40 }}>
          <Plus color={colors.onPrimary} size={18} />
        </Button>
      </View>
      <ErrorBanner message={loader.error || todayLoader.error} onRetry={() => { void loader.load(); void todayLoader.load(); }} />
      {loader.data?.length ? loader.data.map((goal) => {
        const summary = summaries.get(goal.id);
        return (
          <Pressable key={goal.id} onPress={() => navigation.navigate("GoalDetails", { goalId: goal.id })}>
            <Card style={styles.gapCard}>
              <View style={styles.spaceBetween}>
                <Text style={uiStyles.h2}>{goal.title}</Text>
                <Badge tone={summary?.achieved ? "success" : "primary"}>{summary?.completion_percentage ?? 0}%</Badge>
              </View>
              <Text style={uiStyles.muted}>
                Today: {summary?.today_value ?? 0} / {goal.target_value} {goal.unit}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(summary?.completion_percentage ?? 0, 100)}%` }]} />
              </View>
            </Card>
          </Pressable>
        );
      }) : <EmptyState title="No active goals" subtitle="Create a simple goal to get started." />}
    </Screen>
  );
}
