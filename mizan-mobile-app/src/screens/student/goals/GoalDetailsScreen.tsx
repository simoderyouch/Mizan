import React, { useState } from "react";
import { Text, View } from "react-native";
import { Target, Trash2 } from "lucide-react-native";
import { Screen } from "../../../components/screen";
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  LoadingState,
  styles as uiStyles,
} from "../../../components/ui";
import { getApiErrorMessage, goalsApi } from "../../../lib/api";
import type { GoalWithProgress } from "../../../lib/types";
import { colors, spacing } from "../../../theme";
import { styles } from "../styles";
import type { Nav } from "../types";
import { dateLabel } from "../utils";
import { useLoader } from "../hooks/useLoader";

export function GoalDetailsScreen({ route, navigation }: { route: { params: { goalId: string } }; navigation: Nav }) {
  const loader = useLoader<GoalWithProgress>(() => goalsApi.getById(route.params.goalId));
  const [value, setValue] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  
  if (loader.loading && !loader.data) return <Screen variant="stack"><LoadingState /></Screen>;
  const goal = loader.data;
  
  const log = async () => {
    if (!goal) return;
    const progressValue = Number(value);
    if (!Number.isFinite(progressValue) || progressValue <= 0) {
      loader.setError("Value must be greater than zero.");
      return;
    }
    setSaving(true);
    try {
      await goalsApi.logProgress({ goal_id: goal.id, value: progressValue, note: note.trim() || undefined });
      setNote("");
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not add progress."));
    } finally {
      setSaving(false);
    }
  };
  
  const deactivate = async () => {
    if (!goal) return;
    setDeactivating(true);
    try {
      await goalsApi.deactivate(goal.id);
      navigation.goBack();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not deactivate goal."));
    } finally {
      setDeactivating(false);
    }
  };
  
  return (
    <Screen variant="stack" refreshing={loader.loading} onRefresh={loader.load}>
      <Text style={[uiStyles.muted, { marginBottom: spacing.sm }]}>
        {goal?.completion_percentage ?? 0}% completed
      </Text>
      <ErrorBanner message={loader.error} onRetry={loader.load} />
      <Card style={styles.gapCard}>
        <Text style={styles.bigMetric}>{goal?.total_progress ?? 0} / {goal?.target_value ?? 0} {goal?.unit}</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(goal?.completion_percentage ?? 0, 100)}%` }]} /></View>
      </Card>
      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Add progress</Text>
        <Field label="Value" keyboardType="numeric" value={value} onChangeText={setValue} />
        <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />
        <Button loading={saving} onPress={log}>Save</Button>
      </Card>
      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>History</Text>
        {goal?.progress_history.length ? goal.progress_history.slice(0, 10).map((entry) => (
          <View key={entry.id} style={styles.listRow}>
            <Target color={colors.primary} size={18} />
            <Text style={uiStyles.muted}>{dateLabel(entry.date)} · {entry.value} {goal.unit}</Text>
          </View>
        )) : <Text style={uiStyles.muted}>No progress recorded yet.</Text>}
      </Card>
      <Button loading={deactivating} variant="danger" onPress={deactivate}>
        <Trash2 color={colors.onPrimary} size={18} />
        Deactivate goal
      </Button>
    </Screen>
  );
}
