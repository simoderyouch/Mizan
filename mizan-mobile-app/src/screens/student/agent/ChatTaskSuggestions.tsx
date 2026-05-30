import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ChevronDown, ChevronUp, EyeOff, ListPlus } from "lucide-react-native";
import { Button, styles as uiStyles } from "../../../components/ui";
import type { ChatTaskSuggestion } from "../../../lib/types";
import { colors, radius, spacing } from "../../../theme";

type Props = {
  suggestions: ChatTaskSuggestion[];
  selected: Record<number, boolean>;
  collapsed: boolean;
  hidden: boolean;
  creating: boolean;
  onToggleSelected: (idx: number, checked: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onCreate: () => void;
  onCollapse: (collapsed: boolean) => void;
  onHide: () => void;
  onShow: () => void;
};

export function ChatTaskSuggestions({
  suggestions,
  selected,
  collapsed,
  hidden,
  creating,
  onToggleSelected,
  onSelectAll,
  onClearSelection,
  onCreate,
  onCollapse,
  onHide,
  onShow,
}: Props) {
  if (!suggestions.length) return null;

  const selectedCount = suggestions.filter((_, idx) => selected[idx] ?? true).length;

  if (hidden) {
    return (
      <Pressable onPress={onShow} style={styles.hiddenRow}>
        <ListPlus color={colors.primary} size={16} />
        <Text style={styles.hiddenText}>Show {suggestions.length} suggested tasks</Text>
      </Pressable>
    );
  }

  if (collapsed) {
    return (
      <Pressable onPress={() => onCollapse(false)} style={styles.collapsedRow}>
        <ListPlus color={colors.primary} size={16} />
        <Text style={styles.collapsedText}>
          {selectedCount}/{suggestions.length} tasks selected
        </Text>
        <ChevronDown color={colors.muted} size={16} />
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          Suggested tasks · {selectedCount}/{suggestions.length}
        </Text>
        <View style={styles.cardActions}>
          <Pressable onPress={() => onCollapse(true)} hitSlop={8} style={styles.iconBtn}>
            <ChevronUp color={colors.muted} size={18} />
          </Pressable>
          <Pressable onPress={onHide} hitSlop={8} style={styles.iconBtn}>
            <EyeOff color={colors.muted} size={18} />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.list} nestedScrollEnabled>
        {suggestions.map((suggestion, idx) => {
          const checked = selected[idx] ?? true;
          return (
            <Pressable
              key={`${suggestion.title}-${idx}`}
              onPress={() => onToggleSelected(idx, !checked)}
              style={styles.listItem}
            >
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{suggestion.title}</Text>
                {suggestion.description ? (
                  <Text style={uiStyles.muted} numberOfLines={2}>
                    {suggestion.description}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Button variant="secondary" onPress={onSelectAll} style={styles.footerBtn}>
          All
        </Button>
        <Button variant="ghost" onPress={onClearSelection} style={styles.footerBtn}>
          None
        </Button>
        <Button
          loading={creating}
          disabled={creating || selectedCount === 0}
          onPress={onCreate}
          style={[styles.footerBtn, { flex: 1 }]}
        >
          Add to tasks
        </Button>
      </View>
    </View>
  );
}

const styles = {
  hiddenRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(194,198,211,0.2)",
    marginBottom: spacing.sm,
  },
  hiddenText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700" as const,
  },
  collapsedRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  collapsedText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600" as const,
  },
  card: {
    backgroundColor: "rgba(139,92,246,0.08)",
    borderColor: "rgba(139,92,246,0.25)",
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    color: "#4c1d95",
    fontSize: 14,
    fontWeight: "800" as const,
  },
  cardActions: {
    flexDirection: "row" as const,
    gap: spacing.xs,
  },
  iconBtn: {
    padding: 4,
  },
  list: {
    maxHeight: 180,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderColor: "rgba(139,92,246,0.2)",
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  listItem: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomColor: "rgba(139,92,246,0.12)",
    borderBottomWidth: 1,
  },
  checkbox: {
    alignItems: "center" as const,
    borderColor: colors.outline,
    borderRadius: 4,
    borderWidth: 2,
    height: 20,
    justifyContent: "center" as const,
    marginTop: 2,
    width: 20,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: "900" as const,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600" as const,
    marginBottom: 2,
  },
  footer: {
    flexDirection: "row" as const,
    gap: spacing.sm,
  },
  footerBtn: {
    minHeight: 40,
  },
};
