"use client";

import { FormEvent, useEffect, useState } from "react";
import { agentApi, getApiErrorMessage, notificationsApi } from "@/lib/api";
import type { AgentActionContract, AgentTestRun, Notification } from "@/lib/types";
import { formatDateShort, formatTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AgentTestPage() {
  const [runs, setRuns] = useState<AgentTestRun[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [contracts, setContracts] = useState<AgentActionContract[]>([]);
  const [eventType, setEventType] = useState("JURY_DEMO");
  const [note, setNote] = useState("manual jury demo trigger");
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [processingFollowups, setProcessingFollowups] = useState(false);
  const [error, setError] = useState("");
  const scenarioOptions = [
    { value: "JURY_DEMO", label: "Context-driven (JURY_DEMO)" },
    { value: "FORCE_AFTER_LUNCH_RESET", label: "Force after-lunch reset scenario" },
    { value: "FORCE_HIGH_STRESS_EXAM_CRUNCH", label: "Force high stress: exam crunch" },
    { value: "FORCE_HIGH_STRESS_BURNOUT_RISK", label: "Force high stress: burnout risk" },
    { value: "FORCE_HIGH_STRESS_OVERDUE_SPIRAL", label: "Force high stress: overdue spiral" },
    { value: "FORCE_MODE_SWITCH", label: "Force mode switch action" },
    { value: "FORCE_RESOURCE_NUDGE", label: "Force resource nudge action" },
    { value: "FORCE_ESCALATION", label: "Force escalation action" },
    { value: "FORCE_CHECKIN_REMINDER", label: "Force check-in reminder action" },
  ];

  const loadData = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError("");
      const [runsRes, notifRes, contractsRes] = await Promise.all([
        agentApi.listTestRuns(30),
        notificationsApi.list({ limit: 30 }),
        agentApi.listContracts({ limit: 30 }),
      ]);
      setRuns(runsRes);
      setNotifications(notifRes);
      setContracts(contractsRes);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load agent test dashboard."));
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const respondToContract = async (contractId: string, accepted: boolean) => {
    try {
      setError("");
      await agentApi.respondContract(contractId, accepted);
      await loadData(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not update contract."));
    }
  };

  const completeContract = async (contractId: string) => {
    try {
      setError("");
      await agentApi.completeContract(contractId);
      await loadData(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not complete contract."));
    }
  };

  const processFollowups = async () => {
    try {
      setProcessingFollowups(true);
      setError("");
      await agentApi.processFollowupsForTest();
      await loadData(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not process follow-ups."));
    } finally {
      setProcessingFollowups(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const triggerRun = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setTriggering(true);
      setError("");
      await agentApi.triggerTestRun({ event_type: eventType, note });
      await loadData(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not trigger a demo run."));
    } finally {
      setTriggering(false);
    }
  };

  if (loading) return <div className="text-sm text-on-surface-variant">Loading agent demo dashboard...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Agent Demo / Jury Test</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Trigger autonomous runs and inspect actions/results in real time.
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="!p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void loadData()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-lg font-semibold">Trigger manual agent run</h2>
          <form onSubmit={triggerRun} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3">
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value.toUpperCase())}
              className="h-10 rounded-md border border-outline-variant bg-surface px-3 text-sm"
            >
              {scenarioOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-10 rounded-md border border-outline-variant bg-surface px-3 text-sm"
              placeholder="Optional note"
            />
            <Button type="submit" disabled={triggering}>
              {triggering ? "Triggering..." : "Trigger run"}
            </Button>
          </form>
          <p className="text-xs text-on-surface-variant">
            Use FORCE scenarios for guaranteed jury-visible actions even when student context is calm.
          </p>
          <div>
            <Button variant="secondary" onClick={() => void processFollowups()} disabled={processingFollowups}>
              {processingFollowups ? "Processing..." : "Process due follow-ups now"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Agent Runs</h2>
              <Badge variant="secondary">{runs.length}</Badge>
            </div>
            <div className="space-y-3 max-h-[34rem] overflow-y-auto pr-1">
              {runs.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No runs yet.</p>
              ) : (
                runs.map((run) => (
                  <div key={run.id} className="rounded-lg border border-outline-variant/20 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{run.trigger_type}</p>
                      <Badge variant={run.status === "success" ? "secondary" : "outline"}>{run.status}</Badge>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {formatDateShort(run.created_at)} • {formatTime(run.created_at)}
                    </p>
                    {run.reasoning_summary ? (
                      <p className="text-xs text-on-surface-variant">{run.reasoning_summary}</p>
                    ) : null}
                    <div className="space-y-2">
                      {run.decisions.map((decision) => (
                        <div key={decision.id} className="rounded border border-outline-variant/10 bg-surface-container/30 p-2">
                          <p className="text-xs font-medium">{decision.action}</p>
                          {decision.thought ? <p className="text-xs text-on-surface-variant mt-1">{decision.thought}</p> : null}
                          {decision.result ? (
                            <pre className="mt-2 text-[11px] overflow-x-auto whitespace-pre-wrap">{JSON.stringify(decision.result, null, 2)}</pre>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Notifications</h2>
              <Badge variant="secondary">{notifications.length}</Badge>
            </div>
            <div className="space-y-3 max-h-[34rem] overflow-y-auto pr-1">
              {notifications.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No notifications yet.</p>
              ) : (
                notifications.map((item) => (
                  <div key={item.id} className="rounded-lg border border-outline-variant/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <Badge variant={item.is_read ? "outline" : "secondary"}>{item.type}</Badge>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1">{item.body}</p>
                    <p className="text-[11px] text-on-surface-variant mt-2">
                      {formatDateShort(item.created_at)} • {formatTime(item.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Action Contracts</h2>
              <Badge variant="secondary">{contracts.length}</Badge>
            </div>
            <div className="space-y-3 max-h-[34rem] overflow-y-auto pr-1">
              {contracts.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No contracts yet.</p>
              ) : (
                contracts.map((contract) => (
                  <div key={contract.id} className="rounded-lg border border-outline-variant/20 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase">{contract.adaptive_level}</p>
                      <Badge variant={contract.status === "completed" ? "secondary" : "outline"}>{contract.status}</Badge>
                    </div>
                    <p className="text-xs">{contract.contract_text}</p>
                    <p className="text-[11px] text-on-surface-variant">
                      Due: {formatDateShort(contract.due_at)} • {formatTime(contract.due_at)}
                    </p>
                    {contract.status === "pending" ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void respondToContract(contract.id, true)}>
                          Accept
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void respondToContract(contract.id, false)}>
                          Decline
                        </Button>
                      </div>
                    ) : null}
                    {contract.status === "accepted" ? (
                      <Button size="sm" variant="secondary" onClick={() => void completeContract(contract.id)}>
                        Mark complete
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
