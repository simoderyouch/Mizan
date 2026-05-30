import React, { useState } from "react";
import { Screen } from "../../../components/screen";
import {
  Button,
  Card,
  ErrorBanner,
  Field,
} from "../../../components/ui";
import { getApiErrorMessage, goalsApi } from "../../../lib/api";
import { styles } from "../styles";
import type { Nav } from "../types";

export function NewGoalScreen({ navigation }: { navigation: Nav }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("1");
  const [unit, setUnit] = useState("times");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const submit = async () => {
    const targetValue = Number(target);
    if (!title.trim() || !Number.isFinite(targetValue) || targetValue <= 0) {
      setError("Add a title and a target greater than zero.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await goalsApi.create({ title: title.trim(), target_value: targetValue, unit: unit.trim() || "times" });
      navigation.goBack();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not create goal."));
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Screen variant="stack">
      <ErrorBanner message={error} />
      <Card style={styles.gapCard}>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Read 20 pages" />
        <Field label="Target" keyboardType="numeric" value={target} onChangeText={setTarget} />
        <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="pages, minutes, times..." />
        <Button loading={loading} disabled={!title.trim() || !Number(target)} onPress={submit}>Create</Button>
      </Card>
    </Screen>
  );
}
