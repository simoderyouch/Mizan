import React from "react";
import { Text, View } from "react-native";
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
import { agentApi, getApiErrorMessage } from "../../../lib/api";
import type { AgentTestRun } from "../../../lib/types";
import { spacing } from "../../../theme";
import { styles } from "../styles";
import { useLoader } from "../hooks/useLoader";

export function AgentScenariosScreen() {
  const loader = useLoader<AgentTestRun[]>(() => agentApi.listTestRuns());
  const trigger = async () => {
    try {
      await agentApi.triggerTestRun({ event_type: "manual_mobile", note: "Triggered from React Native app" });
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not launch scenario."));
    }
  };
  if (loader.loading && !loader.data) return <Screen variant="stack"><LoadingState /></Screen>;
  return (
    <Screen variant="stack" refreshing={loader.loading} onRefresh={loader.load}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: spacing.sm }}>
        <Button onPress={trigger} style={{ minHeight: 40 }}>Test</Button>
      </View>
      <ErrorBanner message={loader.error} onRetry={loader.load} />
      {loader.data?.length ? loader.data.map((run) => (
        <Card key={run.id} style={styles.gapCard}>
          <View style={styles.spaceBetween}><Badge tone="purple">{run.trigger_type}</Badge><Badge>{run.status}</Badge></View>
          <Text style={uiStyles.muted}>{run.reasoning_summary ?? "No summary."}</Text>
          <Text style={uiStyles.muted}>{new Date(run.created_at).toLocaleString()}</Text>
        </Card>
      )) : <EmptyState title="No scenarios" />}
    </Screen>
  );
}
