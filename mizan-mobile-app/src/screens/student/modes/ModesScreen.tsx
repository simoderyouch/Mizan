import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Screen } from "../../../components/screen";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  LoadingState,
  styles as uiStyles,
} from "../../../components/ui";
import { getApiErrorMessage, modesApi } from "../../../lib/api";
import type { Mode, ModeStats } from "../../../lib/types";
import { styles } from "../styles";
import { modeOptions } from "../constants";
import { useLoader } from "../hooks/useLoader";
import { useLiveNow } from "../hooks/useLiveNow";
import { formatModeElapsed } from "../utils";

export function ModesScreen() {
  const loader = useLoader<ModeStats>(() => modesApi.stats());
  const [busy, setBusy] = useState(false);
  const now = useLiveNow();
  const current = loader.data?.current_session ?? null;

  const elapsed = current?.started_at ? formatModeElapsed(current.started_at, now) : null;

  const setMode = async (mode: Mode) => {
    setBusy(true);
    try {
      await modesApi.start(mode);
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not start mode."));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await modesApi.stop();
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not stop mode."));
    } finally {
      setBusy(false);
    }
  };

  if (loader.loading && !loader.data) return <Screen variant="stack"><LoadingState /></Screen>;

  return (
    <Screen variant="stack" refreshing={loader.loading} onRefresh={loader.load}>
      <ErrorBanner message={loader.error} onRetry={loader.load} />
      {current ? (
        <Card style={styles.gapCard}>
          <Badge tone="success">Active</Badge>
          <Text style={styles.modeActiveTitle}>{current.mode}</Text>
          {elapsed ? (
            <Text style={[uiStyles.muted, { fontSize: 28, fontWeight: "900", fontVariant: ["tabular-nums"] }]}>
              {elapsed}
            </Text>
          ) : null}
          <Button loading={busy} variant="danger" onPress={stop}>Stop</Button>
        </Card>
      ) : null}
      <View style={styles.modeGrid}>
        {modeOptions.map((mode) => (
          <Pressable key={mode} onPress={() => setMode(mode)} style={styles.modeTile}>
            <Text style={styles.modeTileText}>{mode}</Text>
          </Pressable>
        ))}
      </View>
      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>This week</Text>
        {(loader.data?.this_week ?? []).map((item) => (
          <View key={item.mode} style={styles.statRow}>
            <Text style={styles.listTitle}>{item.mode}</Text>
            <Text style={uiStyles.muted}>{item.total_minutes} min · {item.percentage}%</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
