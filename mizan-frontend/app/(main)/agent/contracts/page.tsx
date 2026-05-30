"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ListChecks } from "lucide-react";

import { CommitmentCard } from "@/components/agent/commitment-card";
import {
  COMMITMENTS_LABEL,
  COMMITMENT_PAGE_LIMITS,
  DECLINE_REASONS,
  pinCommitment,
  sortByDueAt,
  splitClosedContracts,
} from "@/lib/agent-commitments";
import { agentApi, getApiErrorMessage } from "@/lib/api";
import type { AgentActionContract } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const { pending: PENDING_LIMIT, accepted: ACCEPTED_LIMIT, closedPerStatus, historyShowInitial, missedShowInitial } =
  COMMITMENT_PAGE_LIMITS;

function ShowMoreButton({
  hidden,
  label,
  onClick,
}: {
  hidden: number;
  label: string;
  onClick: () => void;
}) {
  if (hidden <= 0) return null;
  return (
    <Button variant="ghost" size="sm" className="w-full text-xs text-on-surface-variant" onClick={onClick}>
      {label} ({hidden} more)
    </Button>
  );
}

function ContractsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const { toast } = useToast();

  const [pending, setPending] = useState<AgentActionContract[]>([]);
  const [accepted, setAccepted] = useState<AgentActionContract[]>([]);
  const [closed, setClosed] = useState<AgentActionContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [closedLoading, setClosedLoading] = useState(false);
  const [closedLoaded, setClosedLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<AgentActionContract | null>(null);
  const [declineReason, setDeclineReason] = useState<string>(DECLINE_REASONS[0].id);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [missedOpen, setMissedOpen] = useState(false);
  const [showAllPending, setShowAllPending] = useState(false);
  const [showAllAccepted, setShowAllAccepted] = useState(false);
  const [historyVisible, setHistoryVisible] = useState<number>(historyShowInitial);
  const [missedVisible, setMissedVisible] = useState<number>(missedShowInitial);
  const scrolledRef = useRef(false);

  const loadActive = useCallback(async () => {
    const [pendingRes, acceptedRes] = await Promise.all([
      agentApi.listContracts({ status: "pending", limit: PENDING_LIMIT }),
      agentApi.listContracts({ status: "accepted", limit: ACCEPTED_LIMIT }),
    ]);
    setPending(sortByDueAt(pendingRes));
    setAccepted(sortByDueAt(acceptedRes));
  }, []);

  const loadClosed = useCallback(async () => {
    setClosedLoading(true);
    try {
      const [completed, declined, expired] = await Promise.all([
        agentApi.listContracts({ status: "completed", limit: closedPerStatus }),
        agentApi.listContracts({ status: "declined", limit: closedPerStatus }),
        agentApi.listContracts({ status: "expired", limit: closedPerStatus }),
      ]);
      setClosed([...completed, ...declined, ...expired]);
      setClosedLoaded(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load commitment history."));
    } finally {
      setClosedLoading(false);
    }
  }, []);

  const loadAll = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) setLoading(true);
        setError("");
        await loadActive();
        if (closedLoaded) await loadClosed();
      } catch (err) {
        setError(getApiErrorMessage(err, "Could not load AI commitments."));
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [loadActive, loadClosed, closedLoaded]
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const { missed: missedClosed, rest: restClosed } = useMemo(() => splitClosedContracts(closed), [closed]);

  const activeCount = pending.length + accepted.length;
  const hasAnyActive = activeCount > 0;

  const pendingSlice = showAllPending ? pending : pending.slice(0, PENDING_LIMIT);
  const acceptedSlice = showAllAccepted ? accepted : accepted.slice(0, ACCEPTED_LIMIT);

  const missedSlice = missedClosed.slice(0, missedVisible);
  const restSlice = restClosed.slice(0, historyVisible);

  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    if (!closedLoaded) await loadClosed();
  }, [closedLoaded, loadClosed]);

  useEffect(() => {
    if (!highlightId || loading) return;
    const inActive = [...pending, ...accepted].some((c) => c.id === highlightId);
    if (!inActive && !historyOpen) {
      void openHistory();
    }
  }, [highlightId, loading, pending, accepted, historyOpen, openHistory]);

  useEffect(() => {
    if (!highlightId || !closedLoaded) return;
    if (missedClosed.some((c) => c.id === highlightId)) setMissedOpen(true);
  }, [highlightId, closedLoaded, missedClosed]);

  useEffect(() => {
    if (!highlightId || scrolledRef.current || loading) return;
    const el = document.getElementById(`commitment-${highlightId}`);
    if (!el) return;
    scrolledRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, loading, pending, accepted, closed, historyOpen]);

  const respond = async (contract: AgentActionContract, accepted: boolean, reason?: string) => {
    try {
      setBusyId(contract.id);
      await agentApi.respondContract(contract.id, accepted, { declineReason: reason });
      if (accepted) {
        pinCommitment({
          contractId: contract.id,
          taskId: contract.task_id,
          title: contract.task_title ?? contract.contract_text,
          pinnedAt: new Date().toISOString(),
        });
        toast({
          title: "Added to your focus",
          description: contract.task_title ?? "Commitment accepted — find it on your dashboard Today.",
        });
      }
      await loadActive();
      if (closedLoaded) await loadClosed();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not update this commitment."));
    } finally {
      setBusyId(null);
      setDeclineTarget(null);
    }
  };

  const complete = async (contract: AgentActionContract, fromPending = false) => {
    try {
      setBusyId(contract.id);
      await agentApi.completeContract(contract.id, { fromPending });
      await loadActive();
      if (closedLoaded) await loadClosed();
      toast({ title: "Commitment complete", description: "Nice work closing the loop." });
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not complete this commitment."));
    } finally {
      setBusyId(null);
    }
  };

  const submitDecline = () => {
    if (!declineTarget) return;
    void respond(declineTarget, false, declineReason);
  };

  const toggleHistory = () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    void openHistory();
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-3xl mx-auto pb-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{COMMITMENTS_LABEL}</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              When Mizan suggests a focus block or recovery step, confirm it here (usually within 10–20 minutes).
            </p>
          </div>
          {hasAnyActive ? <Badge variant="secondary">{activeCount} active</Badge> : null}
        </div>

        {error ? (
          <Card className="!rounded-lg">
            <CardContent className="!p-4 flex justify-between gap-3">
              <p className="text-sm text-red-600">{error}</p>
              <Button variant="secondary" size="sm" onClick={() => void loadAll()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!hasAnyActive && !closedLoaded ? (
          <Card className="!rounded-lg">
            <CardContent className="!p-8 text-center">
              <ListChecks className="h-10 w-10 text-primary/40 mx-auto mb-3" />
              <p className="text-sm font-semibold">No active commitments</p>
              <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto">
                They appear when Mizan creates a task from check-in, chat, voice, or wellbeing scans. You will get a
                notification with a link back here.
              </p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => router.push("/agent/chat")}>
                Open Mizan AI
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {pending.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-violet-800">
              Needs response ({pending.length})
            </h2>
            <div className="space-y-2">
              {pendingSlice.map((contract) => (
                <CommitmentCard
                  key={contract.id}
                  contract={contract}
                  highlighted={highlightId === contract.id}
                  busy={busyId === contract.id}
                  onAccept={() => void respond(contract, true)}
                  onDecline={() => {
                    setDeclineTarget(contract);
                    setDeclineReason(DECLINE_REASONS[0].id);
                  }}
                  onCompleteAnyway={() => void complete(contract, true)}
                />
              ))}
            </div>
            <ShowMoreButton
              hidden={showAllPending ? 0 : Math.max(0, pending.length - pendingSlice.length)}
              label="Show all pending"
              onClick={() => {
                setShowAllPending(true);
                if (pending.length >= PENDING_LIMIT) {
                  void agentApi.listContracts({ status: "pending", limit: 40 }).then((rows) => {
                    setPending(sortByDueAt(rows));
                  });
                }
              }}
            />
            {showAllPending && pending.length > PENDING_LIMIT ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setShowAllPending(false)}
              >
                Show fewer
              </Button>
            ) : null}
          </section>
        ) : null}

        {accepted.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-primary">
              In progress ({accepted.length})
            </h2>
            <div className="space-y-2">
              {acceptedSlice.map((contract) => (
                <CommitmentCard
                  key={contract.id}
                  contract={contract}
                  highlighted={highlightId === contract.id}
                  busy={busyId === contract.id}
                  onComplete={() => void complete(contract)}
                />
              ))}
            </div>
            <ShowMoreButton
              hidden={showAllAccepted ? 0 : Math.max(0, accepted.length - acceptedSlice.length)}
              label="Show all in progress"
              onClick={() => {
                setShowAllAccepted(true);
                if (accepted.length >= ACCEPTED_LIMIT) {
                  void agentApi.listContracts({ status: "accepted", limit: 40 }).then((rows) => {
                    setAccepted(sortByDueAt(rows));
                  });
                }
              }}
            />
            {showAllAccepted && accepted.length > ACCEPTED_LIMIT ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setShowAllAccepted(false)}
              >
                Show fewer
              </Button>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-lg border border-outline-variant/15 bg-surface-container/30">
          <button
            type="button"
            onClick={toggleHistory}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-surface-container/50 transition-colors rounded-lg"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
              History
              {closedLoaded && closed.length > 0 ? (
                <span className="font-normal normal-case ml-1.5 text-on-surface-variant/80">
                  · {closed.length} total
                  {missedClosed.length > 0 ? ` · ${missedClosed.length} missed` : ""}
                </span>
              ) : null}
            </span>
            <ChevronDown
              className={cn("h-4 w-4 text-on-surface-variant transition-transform", historyOpen && "rotate-180")}
            />
          </button>

          {historyOpen ? (
            <div className="px-3 pb-3 space-y-3 border-t border-outline-variant/10">
              {closedLoading ? (
                <p className="text-xs text-on-surface-variant py-2">Loading history…</p>
              ) : closed.length === 0 ? (
                <p className="text-xs text-on-surface-variant py-2">No past commitments yet.</p>
              ) : (
                <>
                  {missedClosed.length > 0 ? (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => setMissedOpen((v) => !v)}
                        className="text-[10px] font-bold uppercase tracking-wide text-amber-800 hover:text-amber-900"
                      >
                        Missed ({missedClosed.length}) {missedOpen ? "▾" : "▸"}
                      </button>
                      {missedOpen ? (
                        <div className="space-y-1">
                          {missedSlice.map((contract) => (
                            <CommitmentCard
                              key={contract.id}
                              variant="compact"
                              contract={contract}
                              highlighted={highlightId === contract.id}
                            />
                          ))}
                          <ShowMoreButton
                            hidden={missedClosed.length - missedSlice.length}
                            label="Show more missed"
                            onClick={() => setMissedVisible((n) => n + missedShowInitial)}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {restClosed.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                        Completed & declined ({restClosed.length})
                      </p>
                      <div className="space-y-1">
                        {restSlice.map((contract) => (
                          <CommitmentCard
                            key={contract.id}
                            variant="compact"
                            contract={contract}
                            highlighted={highlightId === contract.id}
                          />
                        ))}
                        <ShowMoreButton
                          hidden={restClosed.length - restSlice.length}
                          label="Show more history"
                          onClick={() => setHistoryVisible((n) => n + historyShowInitial)}
                        />
                      </div>
                    </div>
                  ) : null}

                  {closed.length >= closedPerStatus * 3 ? (
                    <p className="text-[10px] text-on-surface-variant pt-1">
                      Showing recent history only. Older items stay in your record but are not listed here.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </section>

        <Dialog open={!!declineTarget} onOpenChange={(open) => !open && setDeclineTarget(null)}>
          <DialogContent className="max-w-md rounded-lg">
            <DialogHeader>
              <DialogTitle>Decline commitment</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-on-surface-variant">Help Mizan adapt — why is this not right now?</p>
            <div className="grid gap-2 py-2">
              {DECLINE_REASONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 rounded-md border border-outline-variant/20 px-3 py-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="decline-reason"
                    checked={declineReason === opt.id}
                    onChange={() => setDeclineReason(opt.id)}
                    className="accent-primary"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeclineTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={busyId === declineTarget?.id} onClick={submitDecline}>
                Decline
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default function AgentContractsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-on-surface-variant">Loading…</div>}>
      <ContractsPageContent />
    </Suspense>
  );
}
