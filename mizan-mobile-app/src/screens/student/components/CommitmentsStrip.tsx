import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { AgentActionContract } from "../../../lib/types";
import { COMMITMENTS_LABEL } from "../../../lib/agent-commitments";
import { colors, radius, spacing } from "../../../theme";

type Props = {
  contracts: AgentActionContract[];
  busyId?: string | null;
  onAccept?: (contract: AgentActionContract) => void;
  onOpen?: () => void;
};

export function CommitmentsStrip({ contracts, busyId, onAccept, onOpen }: Props) {
  const pending = contracts.filter((c) => c.status === "pending");
  const accepted = contracts.filter((c) => c.status === "accepted");
  const waiting = pending.length + accepted.length;
  if (waiting === 0) return null;

  const singlePending = pending.length === 1 ? pending[0] : null;

  return (
    <View style={s.wrap}>
      <View style={s.topRow}>
        <Text style={s.label}>
          {COMMITMENTS_LABEL} · {waiting} waiting
        </Text>
        {onOpen ? (
          <Pressable hitSlop={8} onPress={onOpen}>
            <Text style={s.link}>{singlePending ? "Respond →" : "Open →"}</Text>
          </Pressable>
        ) : null}
      </View>

      {singlePending ? (
        <View style={s.singleRow}>
          <Text style={s.quote} numberOfLines={2}>
            {singlePending.contract_text}
          </Text>
          {onAccept ? (
            <Pressable
              disabled={busyId === singlePending.id}
              onPress={() => onAccept(singlePending)}
              style={({ pressed }) => [
                s.acceptBtn,
                (pressed || busyId === singlePending.id) && s.acceptBtnPressed,
              ]}
            >
              {busyId === singlePending.id ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text style={s.acceptText}>Accept</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={s.list}>
          {pending.slice(0, 2).map((contract) => (
            <Text key={contract.id} style={s.listItem} numberOfLines={1}>
              {contract.contract_text}
            </Text>
          ))}
          {pending.length === 0 && accepted[0] ? (
            <Text style={s.listItem} numberOfLines={1}>
              {accepted[0].contract_text}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: colors.accentSoft,
    borderColor: "rgba(64,144,255,0.18)",
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: colors.primaryDark,
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  link: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  singleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  quote: {
    borderLeftColor: "rgba(0,92,174,0.35)",
    borderLeftWidth: 2,
    color: colors.text,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    paddingLeft: spacing.sm,
  },
  acceptBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 32,
    minWidth: 72,
    paddingHorizontal: spacing.md,
  },
  acceptBtnPressed: {
    opacity: 0.85,
  },
  acceptText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  list: {
    gap: spacing.xs,
  },
  listItem: {
    borderLeftColor: "rgba(0,92,174,0.35)",
    borderLeftWidth: 2,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: spacing.sm,
  },
});
