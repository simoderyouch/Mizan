"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { agentApi, getApiErrorMessage } from "@/lib/api";
import type { AgentActionContract } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateShort, formatTime } from "@/lib/utils";

export default function AgentContractsPage() {
  const [contracts, setContracts] = useState<AgentActionContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadContracts = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError("");
      const data = await agentApi.listContracts({ limit: 60 });
      setContracts(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load your action contracts."));
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    void loadContracts();
  }, []);

  const respond = async (contractId: string, accepted: boolean) => {
    try {
      setBusyId(contractId);
      await agentApi.respondContract(contractId, accepted);
      await loadContracts(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not update this contract."));
    } finally {
      setBusyId(null);
    }
  };

  const complete = async (contractId: string) => {
    try {
      setBusyId(contractId);
      await agentApi.completeContract(contractId);
      await loadContracts(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not complete this contract."));
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = useMemo(
    () => contracts.filter((item) => item.status === "pending" || item.status === "accepted").length,
    [contracts]
  );

  if (loading) return <div className="text-sm text-on-surface-variant">Loading action contracts...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Agent Actions</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Confirm and complete your autonomous commitments.
          </p>
        </div>
        <Badge variant="secondary">{pendingCount} active</Badge>
      </div>

      {error ? (
        <Card>
          <CardContent className="!p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void loadContracts()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {contracts.length === 0 ? (
        <Card>
          <CardContent className="!p-6 text-sm text-on-surface-variant">
            No contracts yet. Autonomous actions will appear here after runs.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contracts.map((contract) => (
            <Card key={contract.id}>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={contract.status === "completed" ? "secondary" : "outline"}>{contract.status}</Badge>
                  <p className="text-xs uppercase text-on-surface-variant">{contract.adaptive_level}</p>
                </div>

                <p className="text-sm">{contract.contract_text}</p>

                <p className="text-xs text-on-surface-variant">
                  Due {formatDateShort(contract.due_at)} • {formatTime(contract.due_at)}
                </p>

                {contract.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void respond(contract.id, true)}
                      disabled={busyId === contract.id}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void respond(contract.id, false)}
                      disabled={busyId === contract.id}
                    >
                      Decline
                    </Button>
                  </div>
                ) : null}

                {contract.status === "accepted" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void complete(contract.id)}
                      disabled={busyId === contract.id}
                    >
                      Mark complete
                    </Button>
                    <Link href="/tasks">
                      <Button size="sm" variant="ghost">
                        Open tasks
                      </Button>
                    </Link>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
