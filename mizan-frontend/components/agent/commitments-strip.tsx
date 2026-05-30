"use client";

import Link from "next/link";

import type { AgentActionContract } from "@/lib/types";
import { COMMITMENTS_LABEL } from "@/lib/agent-commitments";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CommitmentsStripProps = {
  contracts: AgentActionContract[];
  busyId?: string | null;
  onAccept?: (contract: AgentActionContract) => void;
  className?: string;
};

export function CommitmentsStrip({ contracts, busyId, onAccept, className }: CommitmentsStripProps) {
  const pending = contracts.filter((c) => c.status === "pending");
  const accepted = contracts.filter((c) => c.status === "accepted");
  const waiting = pending.length + accepted.length;

  if (waiting === 0) return null;

  const singlePending = pending.length === 1 ? pending[0] : null;

  return (
    <div
      className={cn(
        "rounded-lg border border-violet-200/70 bg-violet-50/60 px-3 py-2.5 sm:px-4",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-violet-800">
          {COMMITMENTS_LABEL} · {waiting} waiting
        </p>
        <Link
          href="/agent/contracts"
          className="text-[11px] font-semibold text-violet-700 hover:text-violet-900 shrink-0"
        >
          {singlePending ? "Respond →" : "Open →"}
        </Link>
      </div>

      {singlePending ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <p className="text-xs text-violet-950/85 line-clamp-2 flex-1 pl-2 border-l-2 border-violet-300/90">
            {singlePending.contract_text}
          </p>
          {onAccept ? (
            <Button
              size="sm"
              className="h-8 shrink-0"
              disabled={busyId === singlePending.id}
              onClick={() => onAccept(singlePending)}
            >
              Accept
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-1">
          {pending.slice(0, 2).map((c) => (
            <li
              key={c.id}
              className="text-xs text-violet-950/85 line-clamp-1 pl-2 border-l-2 border-violet-300/90"
            >
              {c.contract_text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
