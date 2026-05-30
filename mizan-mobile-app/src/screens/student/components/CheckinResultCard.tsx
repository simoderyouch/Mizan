import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Target } from "lucide-react-native";
import { Button } from "../../../components/ui";
import { colors, spacing } from "../../../theme";
import { checkinStyles as s } from "../checkin/checkinStyles";

type Props = {
  summary: string;
  planTasks: string[];
  tasksCreated: string;
  taskLoading: boolean;
  onCreateTasks: (selected: string[]) => void;
};

export function CheckinResultCard({
  summary,
  planTasks,
  tasksCreated,
  taskLoading,
  onCreateTasks,
}: Props) {
  const [selection, setSelection] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    planTasks.forEach((_, idx) => {
      initial[idx] = true;
    });
    return initial;
  });

  if (!summary && !planTasks.length) return null;

  const selectedCount = planTasks.filter((_, idx) => selection[idx] ?? true).length;

  return (
    <View style={{ gap: spacing.md }}>
      {summary ? (
        <View style={s.summaryBlock}>
          <Text style={s.summaryLabel}>Summary</Text>
          <Text style={s.summaryText}>{summary}</Text>
        </View>
      ) : null}

      {planTasks.length ? (
        <View style={s.surface}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
            <Target color={colors.primary} size={18} />
            <Text style={{ color: colors.text, flex: 1, fontSize: 16, fontWeight: "700" }}>
              Suggested tasks
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>
              {selectedCount}/{planTasks.length}
            </Text>
          </View>

          <View style={s.optionList}>
            {planTasks.map((item, idx) => {
              const active = selection[idx] ?? true;
              return (
                <Pressable
                  key={`${item}-${idx}`}
                  onPress={() => setSelection((prev) => ({ ...prev, [idx]: !active }))}
                  style={[s.optionTile, active && s.optionTileActive]}
                >
                  <Text style={[s.optionTileText, active && s.optionTileTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>

          {tasksCreated ? (
            <Text style={{ color: colors.success, fontSize: 14, fontWeight: "700", marginTop: spacing.md }}>
              {tasksCreated}
            </Text>
          ) : (
            <Button
              disabled={selectedCount === 0}
              loading={taskLoading}
              onPress={() => onCreateTasks(planTasks.filter((_, idx) => selection[idx] ?? true))}
              style={{ marginTop: spacing.md }}
              variant="secondary"
            >
              Add {selectedCount} task{selectedCount === 1 ? "" : "s"} to today
            </Button>
          )}
        </View>
      ) : null}
    </View>
  );
}
