import type { AgentActionContract } from "@/lib/types";

export const COMMITMENTS_LABEL = "AI commitments";

export const ADAPTIVE_LEVEL_HELP: Record<string, string> = {
  standard: "Standard — about 20 minutes to respond; full-sized step.",
  gentle: "Gentle — about 15 minutes to respond; lighter scope.",
  micro: "Micro — about 10 minutes to respond; smallest possible step.",
};

export const DECLINE_REASONS = [
  { id: "too_much", label: "Too much right now" },
  { id: "wrong_time", label: "Wrong timing" },
  { id: "not_relevant", label: "Not relevant" },
] as const;

export type PinnedCommitment = {
  contractId: string;
  taskId?: string | null;
  title: string;
  pinnedAt: string;
};

const PIN_KEY = "mizan:pinned-commitment";

export function pinCommitment(payload: PinnedCommitment) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PIN_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("mizan:commitment:pinned", { detail: payload }));
}

export function readPinnedCommitment(): PinnedCommitment | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PinnedCommitment;
  } catch {
    return null;
  }
}

export function clearPinnedCommitment() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PIN_KEY);
  window.dispatchEvent(new CustomEvent("mizan:commitment:pinned", { detail: null }));
}

export function isActiveCommitment(contract: AgentActionContract) {
  return contract.status === "pending" || contract.status === "accepted";
}

export function sortByDueAt(contracts: AgentActionContract[]) {
  return [...contracts].sort((a, b) => a.due_at.localeCompare(b.due_at));
}

export function sortByCreatedDesc(contracts: AgentActionContract[]) {
  return [...contracts].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Keeps the commitments page fast when history grows large. */
export const COMMITMENT_PAGE_LIMITS = {
  pending: 12,
  accepted: 12,
  closedPerStatus: 15,
  historyShowInitial: 8,
  missedShowInitial: 4,
} as const;

export function splitClosedContracts(contracts: AgentActionContract[]) {
  const missed = sortByCreatedDesc(contracts.filter((c) => c.status === "expired"));
  const rest = sortByCreatedDesc(
    contracts.filter((c) => c.status === "completed" || c.status === "declined")
  );
  return { missed, rest };
}

export function msUntil(iso: string) {
  return new Date(iso).getTime() - Date.now();
}

export function formatRespondBy(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function formatCountdown(ms: number) {
  if (ms <= 0) return "Respond now";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s left` : `${s}s left`;
}

export function notificationCommitmentHref(payload: Record<string, unknown> | null | undefined) {
  if (!payload) return null;
  if (typeof payload.href === "string") return payload.href;
  if (typeof payload.contract_id === "string") {
    return `/agent/contracts?highlight=${payload.contract_id}`;
  }
  return null;
}
