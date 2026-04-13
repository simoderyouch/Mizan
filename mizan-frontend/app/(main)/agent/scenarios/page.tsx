"use client";

import { useEffect, useState } from "react";
import { agentApi, getApiErrorMessage } from "@/lib/api";
import type { AgentTestRun } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateShort, formatTime } from "@/lib/utils";

const SCENARIOS = [
  {
    event_type: "FORCE_HIGH_STRESS_EXAM_CRUNCH",
    title: "High stress: exam crunch",
    description: "Simulates high exam pressure and triggers reset + protected exam sprint.",
  },
  {
    event_type: "FORCE_HIGH_STRESS_BURNOUT_RISK",
    title: "High stress: burnout risk",
    description: "Simulates sustained distress and forces escalation wellbeing flow.",
  },
  {
    event_type: "FORCE_HIGH_STRESS_OVERDUE_SPIRAL",
    title: "High stress: overdue spiral",
    description: "Simulates overdue-task spiral and forces workload stabilization mode switch.",
  },
  {
    event_type: "FORCE_AFTER_LUNCH_RESET",
    title: "After-lunch reset",
    description: "Simulates post-lunch energy drop and triggers reset + focus action.",
  },
  {
    event_type: "FORCE_MODE_SWITCH",
    title: "Mode switch",
    description: "Forces a suggested mode with focus task generation.",
  },
  {
    event_type: "FORCE_RESOURCE_NUDGE",
    title: "Resource nudge",
    description: "Forces targeted wellbeing resource recommendation.",
  },
  {
    event_type: "FORCE_ESCALATION",
    title: "Escalation",
    description: "Forces high-priority support escalation flow.",
  },
  {
    event_type: "FORCE_CHECKIN_REMINDER",
    title: "Check-in reminder",
    description: "Forces a reminder-style intervention notification.",
  },
];

export default function AgentScenariosPage() {
  const [runs, setRuns] = useState<AgentTestRun[]>([]);
  const [busyScenario, setBusyScenario] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRuns = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const allRuns = await agentApi.listTestRuns(50);
      setRuns(allRuns.filter((item) => item.trigger_type.startsWith("MANUAL_FORCE_")));
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load scenario runs."));
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    void loadRuns();
  }, []);

  const runScenario = async (eventType: string) => {
    try {
      setBusyScenario(eventType);
      setError("");
      await agentApi.triggerTestRun({
        event_type: eventType,
        note: "scenario-lab manual trigger",
      });
      await loadRuns(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not trigger this scenario."));
    } finally {
      setBusyScenario(null);
    }
  };

  if (loading) return <div className="text-sm text-on-surface-variant">Loading scenario lab...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Scenario Lab</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Run 5 autonomous scenarios and inspect outcomes in real frontend.
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="!p-4">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SCENARIOS.map((scenario) => (
          <Card key={scenario.event_type}>
            <CardContent className="space-y-3">
              <h2 className="font-semibold">{scenario.title}</h2>
              <p className="text-xs text-on-surface-variant">{scenario.description}</p>
              <Button
                size="sm"
                onClick={() => void runScenario(scenario.event_type)}
                disabled={busyScenario === scenario.event_type}
              >
                {busyScenario === scenario.event_type ? "Running..." : "Run scenario"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Scenario Results</h2>
            <Badge variant="secondary">{runs.length}</Badge>
          </div>
          {runs.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No scenario runs yet.</p>
          ) : (
            <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
              {runs.map((run) => (
                <div key={run.id} className="rounded-lg border border-outline-variant/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{run.trigger_type}</p>
                    <Badge variant={run.status === "success" ? "secondary" : "outline"}>{run.status}</Badge>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {formatDateShort(run.created_at)} • {formatTime(run.created_at)}
                  </p>
                  {run.decisions[0]?.result ? (
                    <pre className="text-[11px] whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(run.decisions[0].result, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
