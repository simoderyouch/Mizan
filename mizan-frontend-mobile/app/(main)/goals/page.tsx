"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiErrorMessage, goalsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Goal, GoalTodaySummary } from "@/lib/types";
import { Target, Plus, Loader2, ChevronRight } from "lucide-react";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [todaySummary, setTodaySummary] = useState<GoalTodaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [goalsData, todayData] = await Promise.all([goalsApi.list(), goalsApi.today()]);
      setGoals(goalsData);
      setTodaySummary(todayData);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Impossible de charger les objectifs."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-8 max-w-4xl mx-auto px-1">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Mes Objectifs & Équilibre</h1>
          <p className="text-on-surface-variant mt-2">
            Suivez votre progression académique tout en maintenant une harmonie quotidienne.
          </p>
        </div>
        <Link href="/goals/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouvel objectif
          </Button>
        </Link>
      </div>

      {error && (
        <Card>
          <CardContent className="!p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void fetchData()}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      {goals.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Target className="h-12 w-12 text-on-surface-variant/30 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Aucun objectif</h3>
            <p className="text-sm text-on-surface-variant mb-4">
              Créez votre premier objectif pour commencer à suivre votre progression.
            </p>
            <Link href="/goals/new">
              <Button>Créer un objectif</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 flex flex-col">
          {goals.filter((g) => g.is_active).map((goal) => {
            const summary = todaySummary.find((s) => s.goal_id === goal.id);
            const completion = summary?.completion_percentage || 0;

            return (
              <Link key={goal.id} href={`/goals/${goal.id}`}>
                <Card className="hover:shadow-sanctuary-lg transition-shadow cursor-pointer">
                  <CardContent>
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold text-lg">{goal.title}</h3>
                      <span className="text-xl font-bold text-primary">{Math.round(completion)}%</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mb-3">
                      Objectif : {goal.target_value} {goal.unit}
                    </p>
                    <Progress value={completion} />
                    <div className="flex items-center justify-between mt-3">
                      <Badge variant="secondary" className="text-xs">
                        {goal.unit}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-on-surface-variant" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
