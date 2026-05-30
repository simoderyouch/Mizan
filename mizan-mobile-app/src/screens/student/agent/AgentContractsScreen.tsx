import React, { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Screen } from "../../../components/screen";
import {
  Button,
  EmptyState,
  ErrorBanner,
  LoadingState,
  styles as uiStyles,
} from "../../../components/ui";
import { agentApi, getApiErrorMessage } from "../../../lib/api";
import {
  clearPinnedCommitment,
  COMMITMENT_PAGE_LIMITS,
  DECLINE_REASONS,
  pinCommitment,
  readPinnedCommitment,
  sortByCreatedDesc,
  sortByDueAt,
  splitClosedContracts,
} from "../../../lib/agent-commitments";
import type { AgentActionContract } from "../../../lib/types";
import { colors, spacing } from "../../../theme";
import { styles } from "../styles";
import { useLoader } from "../hooks/useLoader";
import { CommitmentCard } from "../components/CommitmentCard";

type Tab = "pending" | "accepted" | "history";

export function AgentContractsScreen() {
  const [tab, setTab] = useState<Tab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<AgentActionContract | null>(null);
  const [declineReason, setDeclineReason] = useState<string>(DECLINE_REASONS[0].id);

  const loadAll = useCallback(async () => {
    const [pending, accepted, completed, declined, expired] = await Promise.all([
      agentApi.listContracts({ status: "pending", limit: COMMITMENT_PAGE_LIMITS.pending }),
      agentApi.listContracts({ status: "accepted", limit: COMMITMENT_PAGE_LIMITS.accepted }),
      agentApi.listContracts({ status: "completed", limit: COMMITMENT_PAGE_LIMITS.closedPerStatus }),
      agentApi.listContracts({ status: "declined", limit: COMMITMENT_PAGE_LIMITS.closedPerStatus }),
      agentApi.listContracts({ status: "expired", limit: COMMITMENT_PAGE_LIMITS.closedPerStatus }),
    ]);
    return { pending, accepted, history: [...completed, ...declined, ...expired] };
  }, []);

  const loader = useLoader(loadAll);

  const refresh = () => void loader.load();

  const respond = async (contract: AgentActionContract, accepted: boolean, reason?: string) => {
    setBusyId(contract.id);
    try {
      const updated = await agentApi.respondContract(contract.id, accepted, {
        declineReason: reason,
      });
      if (accepted) {
        await pinCommitment({
          contractId: updated.id,
          taskId: updated.task_id,
          title: updated.contract_text,
          pinnedAt: new Date().toISOString(),
        });
      } else {
        const pinned = await readPinnedCommitment();
        if (pinned?.contractId === contract.id) await clearPinnedCommitment();
      }
      setDeclineTarget(null);
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not respond to the contract."));
    } finally {
      setBusyId(null);
    }
  };

  const complete = async (contract: AgentActionContract) => {
    setBusyId(contract.id);
    try {
      await agentApi.completeContract(contract.id);
      const pinned = await readPinnedCommitment();
      if (pinned?.contractId === contract.id) await clearPinnedCommitment();
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not complete the contract."));
    } finally {
      setBusyId(null);
    }
  };

  const data = loader.data;
  const pending = sortByDueAt(data?.pending ?? []);
  const accepted = sortByDueAt(data?.accepted ?? []);
  const { missed, rest } = splitClosedContracts(data?.history ?? []);
  const closed = sortByCreatedDesc([...missed, ...rest]);

  const list =
    tab === "pending" ? pending : tab === "accepted" ? accepted : closed;

  if (loader.loading && !loader.data) {
    return (
      <Screen variant="stack">
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen variant="stack" refreshing={loader.loading} onRefresh={refresh}>
      <ErrorBanner message={loader.error} onRetry={refresh} />

      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
        {(["pending", "accepted", "history"] as Tab[]).map((value) => (
          <Pressable
            key={value}
            onPress={() => setTab(value)}
            style={[styles.choice, tab === value && styles.choiceActive, { flex: 1 }]}
          >
            <Text style={[styles.choiceText, tab === value && styles.choiceTextActive, { textAlign: "center", textTransform: "capitalize" }]}>
              {value}
            </Text>
          </Pressable>
        ))}
      </View>

      {list.length ? (
        list.map((contract) => (
          <CommitmentCard
            key={contract.id}
            contract={contract}
            busy={busyId === contract.id}
            onAccept={contract.status === "pending" ? () => respond(contract, true) : undefined}
            onDecline={contract.status === "pending" ? () => setDeclineTarget(contract) : undefined}
            onComplete={contract.status === "accepted" ? () => complete(contract) : undefined}
          />
        ))
      ) : (
        <EmptyState title="No contracts" subtitle="Mizan will propose commitments when relevant." />
      )}

      <Modal visible={!!declineTarget} transparent animationType="fade" onRequestClose={() => setDeclineTarget(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: spacing.lg }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, gap: spacing.md }}>
            <Text style={uiStyles.h2}>Decline commitment</Text>
            <Text style={uiStyles.muted}>Help Mizan understand why this isn't the right step.</Text>
            <ScrollView style={{ maxHeight: 200 }}>
              {DECLINE_REASONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => setDeclineReason(opt.id)}
                  style={[styles.choice, declineReason === opt.id && styles.choiceActive, { marginBottom: spacing.sm }]}
                >
                  <Text style={[styles.choiceText, declineReason === opt.id && styles.choiceTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.metricRow}>
              <Button variant="ghost" onPress={() => setDeclineTarget(null)} style={{ flex: 1 }}>Cancel</Button>
              <Button
                variant="danger"
                loading={busyId === declineTarget?.id}
                onPress={() => declineTarget && respond(declineTarget, false, declineReason)}
                style={{ flex: 1 }}
              >
                Decline
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
