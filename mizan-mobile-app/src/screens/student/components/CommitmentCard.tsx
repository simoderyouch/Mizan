import React from "react";
import { Text, View } from "react-native";
import { Button, Badge, Card, styles as uiStyles } from "../../../components/ui";
import type { AgentActionContract } from "../../../lib/types";
import { ADAPTIVE_LEVEL_HELP } from "../../../lib/agent-commitments";
import { colors } from "../../../theme";
import { styles } from "../styles";
import { formatCountdown, formatRespondBy, msUntil } from "../../../lib/agent-commitments";

type Props = {
  contract: AgentActionContract;
  busy?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onComplete?: () => void;
  highlighted?: boolean;
};

export function CommitmentCard({
  contract,
  busy,
  onAccept,
  onDecline,
  onComplete,
  highlighted,
}: Props) {
  const levelHelp = ADAPTIVE_LEVEL_HELP[contract.adaptive_level] ?? contract.adaptive_level;
  const countdown = formatCountdown(msUntil(contract.due_at));

  return (
    <Card
      style={[
        styles.gapCard,
        highlighted && { borderColor: colors.primary, borderWidth: 2 },
        contract.status === "declined" && { opacity: 0.75 },
      ]}
    >
      <View style={styles.spaceBetween}>
        <Badge tone="primary">{contract.adaptive_level}</Badge>
        <Badge>{contract.status}</Badge>
      </View>
      <Text style={uiStyles.h3}>{contract.contract_text}</Text>
      <Text style={uiStyles.muted}>{levelHelp}</Text>
      {contract.status === "pending" ? (
        <Text style={[uiStyles.muted, { fontSize: 12 }]}>
          Respond by {formatRespondBy(contract.due_at)} · {countdown}
        </Text>
      ) : null}
      {contract.decline_reason ? (
        <Text style={[uiStyles.muted, { fontSize: 11 }]}>
          Declined: {contract.decline_reason.replace(/_/g, " ")}
        </Text>
      ) : null}
      {contract.status === "pending" && onAccept && onDecline ? (
        <View style={styles.metricRow}>
          <Button variant="secondary" loading={busy} onPress={onDecline} style={{ flex: 1 }}>
            Decline
          </Button>
          <Button loading={busy} onPress={onAccept} style={{ flex: 1 }}>
            Accept
          </Button>
        </View>
      ) : null}
      {contract.status === "accepted" && onComplete ? (
        <Button loading={busy} onPress={onComplete}>Mark complete</Button>
      ) : null}
    </Card>
  );
}
