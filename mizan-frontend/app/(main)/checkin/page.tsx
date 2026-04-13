"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, Moon, Sun } from "lucide-react";

import { analyticsApi, getApiErrorMessage } from "@/lib/api";
import type { StudentDashboard } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const MORNING_START_HOUR = 8;
const EVENING_START_HOUR = 20;

function nextAt(hour: number, now: Date): Date {
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${m}m ${s}s`;
}

export default function CheckinHubPage() {
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await analyticsApi.dashboard();
        setDashboard(data);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, "Unable to load check-in status."));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const morningState = useMemo(() => {
    const hasMorning = dashboard?.has_morning_checkin ?? false;
    const todayMorningOpen = new Date(now);
    todayMorningOpen.setHours(MORNING_START_HOUR, 0, 0, 0);
    const todayEveningOpen = new Date(now);
    todayEveningOpen.setHours(EVENING_START_HOUR, 0, 0, 0);

    if (hasMorning) {
      return { status: "Done today", countdownLabel: "Next morning in", countdownMs: nextAt(MORNING_START_HOUR, now).getTime() - now.getTime(), canStart: false };
    }
    if (now < todayMorningOpen) {
      return { status: "Not open yet", countdownLabel: "Opens in", countdownMs: todayMorningOpen.getTime() - now.getTime(), canStart: false };
    }
    if (now < todayEveningOpen) {
      return { status: "Open now", countdownLabel: "Closes in", countdownMs: todayEveningOpen.getTime() - now.getTime(), canStart: true };
    }
    return { status: "Window closed", countdownLabel: "Opens tomorrow in", countdownMs: nextAt(MORNING_START_HOUR, now).getTime() - now.getTime(), canStart: false };
  }, [dashboard, now]);

  const eveningState = useMemo(() => {
    const hasMorning = dashboard?.has_morning_checkin ?? false;
    const hasEvening = dashboard?.has_evening_checkin ?? false;
    const todayEveningOpen = new Date(now);
    todayEveningOpen.setHours(EVENING_START_HOUR, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    if (hasEvening) {
      return { status: "Done today", countdownLabel: "Next evening in", countdownMs: nextAt(EVENING_START_HOUR, now).getTime() - now.getTime(), canStart: false };
    }
    if (!hasMorning) {
      return { status: "Morning required first", countdownLabel: "Morning opens in", countdownMs: nextAt(MORNING_START_HOUR, now).getTime() - now.getTime(), canStart: false };
    }
    if (now < todayEveningOpen) {
      return { status: "Not open yet", countdownLabel: "Opens in", countdownMs: todayEveningOpen.getTime() - now.getTime(), canStart: false };
    }
    return { status: "Open now", countdownLabel: "Closes in", countdownMs: endOfDay.getTime() - now.getTime(), canStart: true };
  }, [dashboard, now]);

  return (
    <div className="page-enter max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <Badge className="mb-3 px-3 py-1 shadow-sm">Check-in Center</Badge>
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent pb-1">
          Daily Check-ins
        </h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-2xl mx-auto">
          This page handles timing, live countdown, and access to morning/evening check-ins.
        </p>
      </div>

      {loading && <p className="text-sm text-on-surface-variant text-center">Loading check-in status...</p>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 max-w-md mx-auto">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card className="shadow-sanctuary hover:shadow-sanctuary-lg transition-all duration-300 ">
          <CardContent className="p-8 space-y-4 text-center">
            <div className="flex justify-center items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Sun className="h-6 w-6 text-amber-500" />
              </div>
              <h2 className="text-2xl font-bold">Morning Check-in</h2>
            </div>
            <Badge variant={morningState.canStart ? "default" : "secondary"} className="text-sm px-4 py-1">
              {morningState.status}
            </Badge>
            <div className="text-lg text-on-surface-variant flex items-center justify-center gap-2">
              <Clock3 className="h-5 w-5" />
              <span>{morningState.countdownLabel}:</span>
              <strong className="font-mono tracking-wider">{formatCountdown(morningState.countdownMs)}</strong>
            </div>
            <Button asChild size="lg" className="w-full h-12 text-base mt-4">
              <Link href="/checkin/morning">Start Morning Check-in</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sanctuary hover:shadow-sanctuary-lg transition-all duration-300 ">
          <CardContent className="p-8 space-y-4 text-center">
            <div className="flex justify-center items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <Moon className="h-6 w-6 text-indigo-500" />
              </div>
              <h2 className="text-2xl font-bold">Evening Check-in</h2>
            </div>
            <Badge variant={eveningState.canStart ? "default" : "secondary"} className="text-sm px-4 py-1">
              {eveningState.status}
            </Badge>
            <div className="text-lg text-on-surface-variant flex items-center justify-center gap-2">
              <Clock3 className="h-5 w-5" />
              <span>{eveningState.countdownLabel}:</span>
              <strong className="font-mono tracking-wider">{formatCountdown(eveningState.countdownMs)}</strong>
            </div>
            <Button asChild size="lg" className="w-full h-12 text-base mt-4">
              <Link href="/checkin/evening">Start Evening Check-in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
