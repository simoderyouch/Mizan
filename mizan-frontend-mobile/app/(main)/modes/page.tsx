"use client";

import { useEffect, useState } from "react";
import { getApiErrorMessage, modesApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { modeLabel, formatMinutes } from "@/lib/utils";
import type { Mode, ModeStats } from "@/lib/types";
import {
  BookOpen, GraduationCap, FolderKanban, Coffee, Dumbbell, School,
  Play, Square, Loader2, Clock,
} from "lucide-react";

const MODE_CONFIG: Record<Mode, { icon: React.ElementType; color: string; bg: string }> = {
  REVISION: { icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50" },
  EXAMEN: { icon: GraduationCap, color: "text-red-600", bg: "bg-red-50" },
  PROJET: { icon: FolderKanban, color: "text-amber-600", bg: "bg-amber-50" },
  REPOS: { icon: Coffee, color: "text-emerald-600", bg: "bg-emerald-50" },
  SPORT: { icon: Dumbbell, color: "text-orange-600", bg: "bg-orange-50" },
  COURS: { icon: School, color: "text-blue-600", bg: "bg-blue-50" },
};

export default function ModesPage() {
  const [stats, setStats] = useState<ModeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  const fetchStats = async () => {
    setError("");
    try {
      const data = await modesApi.stats();
      setStats(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Impossible de charger les statistiques de mode."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStats();
  }, []);

  // Timer for active session
  useEffect(() => {
    if (!stats?.current_session) return;
    const start = new Date(stats.current_session.started_at).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [stats?.current_session]);

  const startMode = async (mode: Mode) => {
    setActionLoading(true);
    setError("");
    try {
      await modesApi.start(mode);
      await fetchStats();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Impossible de démarrer ce mode."));
    } finally {
      setActionLoading(false);
    }
  };

  const stopMode = async () => {
    setActionLoading(true);
    setError("");
    try {
      await modesApi.stop();
      await fetchStats();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Impossible d'arrêter le mode actif."));
    } finally {
      setActionLoading(false);
    }
  };

  const fmtTimer = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-8 max-w-4xl mx-auto px-1">
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Modes de travail</h1>
        <p className="text-on-surface-variant mt-2">
          Sélectionnez votre mode actuel et suivez votre productivité.
        </p>
      </div>

      {error && (
        <Card>
          <CardContent className="!p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void fetchStats()}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active Session */}
      {stats?.current_session && (
        <Card className="sanctuary-card-accent">
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Clock className="h-6 w-6 animate-pulse-soft" />
              <div>
                <span className="label-sanctuary text-on-primary/70">Mode actif</span>
                <p className="text-xl font-bold">{modeLabel(stats.current_session.mode)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 w-full sm:w-auto">
              <span className="text-xl sm:text-2xl font-mono font-bold">{fmtTimer(elapsed)}</span>
              <Button
                onClick={stopMode}
                disabled={actionLoading}
                variant="secondary"
                className="!text-white !border-white/30"
              >
                <Square className="h-4 w-4 mr-2" />
                Arrêter
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mode Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {(Object.keys(MODE_CONFIG) as Mode[]).map((mode) => {
          const config = MODE_CONFIG[mode];
          const Icon = config.icon;
          const isActive = stats?.current_session?.mode === mode;
          const todayMin = stats?.today.find((s) => s.mode === mode)?.total_minutes || 0;

          return (
            <Card
              key={mode}
              className={`cursor-pointer transition-all hover:shadow-sanctuary-lg ${
                isActive ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => !isActive && !stats?.current_session && startMode(mode)}
            >
              <CardContent className="text-center">
                <div className={`w-14 h-14 rounded-2xl ${config.bg} flex items-center justify-center mx-auto mb-3`}>
                  <Icon className={`h-7 w-7 ${config.color}`} />
                </div>
                <h3 className="font-bold mb-1">{modeLabel(mode)}</h3>
                {todayMin > 0 && (
                  <p className="text-xs text-on-surface-variant">{formatMinutes(todayMin)} aujourd&apos;hui</p>
                )}
                {isActive && (
                  <Badge variant="success" className="mt-2">Actif</Badge>
                )}
                {!isActive && !stats?.current_session && (
                  <Button variant="ghost" size="sm" className="mt-2" disabled={actionLoading}>
                    <Play className="h-3 w-3 mr-1" />
                    Démarrer
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Weekly Stats */}
      {stats && stats.this_week.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-xl font-bold mb-4">Statistiques de la semaine</h3>
            <div className="space-y-3">
              {stats.this_week.map((s) => {
                const config = MODE_CONFIG[s.mode];
                return (
                  <div key={s.mode} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl ${config.bg} flex items-center justify-center`}>
                      <config.icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <span className="text-sm font-medium flex-1">{modeLabel(s.mode)}</span>
                    <span className="text-sm font-bold">{formatMinutes(s.total_minutes)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
