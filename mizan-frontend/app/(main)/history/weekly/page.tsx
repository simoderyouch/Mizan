"use client";

import { useEffect, useState } from "react";
import { analyticsApi, getApiErrorMessage } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { WeeklyReport } from "@/lib/types";
import { modeLabel, formatDate } from "@/lib/utils";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function WeeklyReportPage() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await analyticsApi.weeklyReport();
      setReport(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Unable to load weekly report."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="page-enter max-w-2xl mx-auto text-center py-12">
        <p className="text-on-surface-variant mb-4">No report available this week.</p>
        <Link href="/history"><Button variant="secondary">Back</Button></Link>
      </div>
    );
  }

  return (
    <div className="page-enter max-w-3xl mx-auto space-y-6 px-1">
      <Link href="/history" className="inline-flex items-center text-sm text-on-surface-variant hover:text-primary">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to history
      </Link>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Weekly report</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          {formatDate(report.week_start)} — {formatDate(report.week_end)}
        </p>
      </div>

      {error && (
        <Card>
          <CardContent className="!p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void fetchReport()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="sanctuary-card-subtle text-center !p-4">
          <span className="label-sanctuary">Avg mood</span>
          <p className="text-2xl font-bold text-primary mt-1">{report.avg_mood.toFixed(1)}</p>
        </div>
        <div className="sanctuary-card-subtle text-center !p-4">
          <span className="label-sanctuary">Avg sleep</span>
          <p className="text-2xl font-bold text-primary mt-1">{report.avg_sleep.toFixed(1)}h</p>
        </div>
        <div className="sanctuary-card-subtle text-center !p-4">
          <span className="label-sanctuary">Check-ins</span>
          <p className="text-2xl font-bold text-primary mt-1">{report.total_checkins}</p>
        </div>
        <div className="sanctuary-card-subtle text-center !p-4">
          <span className="label-sanctuary">Goals</span>
          <p className="text-2xl font-bold text-primary mt-1">{report.goals_achieved}</p>
        </div>
      </div>

      {/* Stress level */}
      <Card>
        <CardContent>
          <h3 className="font-bold mb-3">Stress level</h3>
          <Badge variant={
            report.stress_level === "LOW" ? "success" :
            report.stress_level === "MEDIUM" ? "warning" : "destructive"
          }>
            {report.stress_level === "LOW" ? "Low — Stable" :
             report.stress_level === "MEDIUM" ? "Medium — Balanced" :
              "High — Take care of yourself"}
          </Badge>
        </CardContent>
      </Card>

      {/* Mode distribution */}
      {report.mode_distribution.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="font-bold mb-4">Mode distribution</h3>
            <div className="space-y-3">
              {report.mode_distribution.map((md) => (
                <div key={md.mode}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{modeLabel(md.mode)}</span>
                    <span className="text-sm text-on-surface-variant">{Math.round(md.percentage)}%</span>
                  </div>
                  <Progress value={md.percentage} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
