"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HelpCircle, Sparkles } from "lucide-react";

import {
  ADAPTIVE_LEVEL_HELP,
  formatCountdown,
  formatRespondBy,
  msUntil,
} from "@/lib/agent-commitments";
import type { AgentActionContract } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type CommitmentCardProps = {
  contract: AgentActionContract;
  variant?: "full" | "compact";
  highlighted?: boolean;
  busy?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onComplete?: () => void;
  onCompleteAnyway?: () => void;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Needs response",
  accepted: "In progress",
  completed: "Completed",
  declined: "Declined",
  expired: "Missed",
};

export function CommitmentCard({
  contract,
  variant = "full",
  highlighted = false,
  busy = false,
  onAccept,
  onDecline,
  onComplete,
  onCompleteAnyway,
}: CommitmentCardProps) {
  const [countdown, setCountdown] = useState(() => formatCountdown(msUntil(contract.due_at)));

  if (variant === "compact") {
    const when = contract.completed_at ?? contract.responded_at ?? contract.due_at;
    const whenLabel = new Date(when).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    return (
      <article
        id={`commitment-${contract.id}`}
        className={cn(
          "flex items-center gap-2.5 rounded-md border px-3 py-2 transition-all",
          highlighted && "ring-2 ring-primary/40 border-primary/30",
          contract.status === "expired" && "border-amber-200/50 bg-amber-50/35",
          contract.status !== "expired" && "border-outline-variant/15 bg-surface-container/35"
        )}
      >
        <Badge
          variant={contract.status === "expired" ? "warning" : "secondary"}
          className="shrink-0 text-[9px] px-2 py-0.5"
        >
          {STATUS_LABEL[contract.status] ?? contract.status}
        </Badge>
        <p className="text-xs font-medium text-on-surface line-clamp-1 flex-1 min-w-0">
          {contract.contract_text}
        </p>
        <span className="text-[10px] text-on-surface-variant shrink-0 tabular-nums">{whenLabel}</span>
      </article>
    );
  }

  useEffect(() => {
    if (contract.status !== "pending") return;
    const tick = () => setCountdown(formatCountdown(msUntil(contract.due_at)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [contract.due_at, contract.status]);

  const levelHelp =
    ADAPTIVE_LEVEL_HELP[contract.adaptive_level] ?? ADAPTIVE_LEVEL_HELP.standard;

  return (
    <article
      id={`commitment-${contract.id}`}
      className={cn(
        "rounded-lg border px-4 py-3 transition-all",
        highlighted && "ring-2 ring-primary/50 border-primary/40",
        contract.status === "expired" && "border-amber-200/80 bg-amber-50/50",
        contract.status === "pending" && !highlighted && "border-violet-200/60 bg-violet-50/40",
        contract.status === "accepted" && "border-primary/25 bg-primary/5",
        contract.status === "completed" && "border-outline-variant/20 bg-surface-container/40 opacity-90",
        contract.status === "declined" && "border-outline-variant/15 bg-surface-container/30 opacity-75"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              contract.status === "expired"
                ? "warning"
                : contract.status === "pending"
                  ? "default"
                  : "secondary"
            }
            className="text-[10px]"
          >
            {STATUS_LABEL[contract.status] ?? contract.status}
          </Badge>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-on-surface-variant"
                >
                  {contract.adaptive_level}
                  <HelpCircle className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Mizan sized this commitment for you: {levelHelp}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {contract.trigger_label ? (
          <span className="text-[10px] text-on-surface-variant flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" />
            {contract.trigger_label}
          </span>
        ) : null}
      </div>

      <p className="text-sm font-semibold leading-snug text-on-surface">{contract.contract_text}</p>

      {contract.task_title ? (
        <p className="text-xs text-on-surface-variant mt-1.5">
          Linked task: <span className="font-medium text-on-surface">{contract.task_title}</span>
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
        {contract.status === "pending" ? (
          <span className="font-semibold text-violet-800">
            Respond by {formatRespondBy(contract.due_at)} · {countdown}
          </span>
        ) : (
          <span>Respond by {formatRespondBy(contract.due_at)}</span>
        )}
        {contract.task_id ? (
          <Link href={`/tasks?highlight=${contract.task_id}`} className="font-semibold text-primary hover:underline">
            View task →
          </Link>
        ) : null}
      </div>

      {contract.status === "pending" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={onAccept}>
            Accept
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={onDecline}>
            Decline
          </Button>
          {onCompleteAnyway ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={onCompleteAnyway}>
              I did it anyway
            </Button>
          ) : null}
        </div>
      ) : null}

      {contract.status === "accepted" ? (
        <div className="mt-3">
          <Button size="sm" variant="secondary" disabled={busy} onClick={onComplete}>
            Mark complete
          </Button>
        </div>
      ) : null}

      {contract.status === "expired" ? (
        <p className="mt-2 text-[11px] text-amber-800/90">Response window passed — Mizan may suggest a new step later.</p>
      ) : null}

      {contract.decline_reason ? (
        <p className="mt-2 text-[11px] text-on-surface-variant">Declined: {contract.decline_reason.replace(/_/g, " ")}</p>
      ) : null}
    </article>
  );
}
