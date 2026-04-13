"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getApiErrorMessage, goalsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import type { GoalWithProgress } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

export default function GoalDetailPage() {
  const { goalId } = useParams();
  const router = useRouter();
  const [goal, setGoal] = useState<GoalWithProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [progressValue, setProgressValue] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const fetchGoal = useCallback(async () => {
    setError("");
    try {
      const data = await goalsApi.getById(String(goalId));
      setGoal(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Impossible de charger cet objectif."));
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    fetchGoal();
  }, [goalId, fetchGoal]);

  const logProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalId) return;
    const parsedValue = Number(progressValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      toast({ title: "Valeur invalide", description: "La progression doit être supérieure à 0.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await goalsApi.logProgress({
        goal_id: String(goalId),
        value: parsedValue,
        note: progressNote || undefined,
      });
      setProgressValue("");
      setProgressNote("");
      await fetchGoal();
    } catch (err: unknown) {
      toast({ title: "Erreur", description: getApiErrorMessage(err, "Impossible d'enregistrer la progression."), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const deactivate = async () => {
    try {
      await goalsApi.deactivate(String(goalId));
      toast({ title: "Objectif désactivé", description: "L'objectif a été retiré de vos actifs." });
      router.push("/goals");
    } catch (err: unknown) {
      toast({ title: "Erreur", description: getApiErrorMessage(err, "Impossible de désactiver l'objectif."), variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="text-center py-12">
        <p className="text-on-surface-variant">Objectif introuvable.</p>
        <Link href="/goals"><Button variant="secondary" className="mt-4">Retour</Button></Link>
      </div>
    );
  }

  return (
    <div className="page-enter max-w-2xl mx-auto space-y-6 px-1">
      <Link href="/goals" className="inline-flex items-center text-sm text-on-surface-variant hover:text-primary">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Retour aux objectifs
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{goal.title}</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Objectif : {goal.target_value} {goal.unit}
          </p>
        </div>
        <span className="text-3xl font-bold text-primary">{Math.round(goal.completion_percentage)}%</span>
      </div>

      {error && (
        <Card>
          <CardContent className="!p-4">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <Progress value={goal.completion_percentage} className="h-3" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sanctuary-card-subtle text-center !p-4">
          <span className="label-sanctuary">Aujourd&apos;hui</span>
          <p className="text-lg font-bold mt-1">{goal.today_progress}</p>
        </div>
        <div className="sanctuary-card-subtle text-center !p-4">
          <span className="label-sanctuary">Total</span>
          <p className="text-lg font-bold mt-1">{goal.total_progress}</p>
        </div>
        <div className="sanctuary-card-subtle text-center !p-4">
          <span className="label-sanctuary">Cible</span>
          <p className="text-lg font-bold mt-1">{goal.target_value}</p>
        </div>
      </div>

      {/* Log progress */}
      <Card>
        <CardContent>
          <h3 className="font-bold mb-4">Enregistrer un progrès</h3>
          <form onSubmit={logProgress} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valeur</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={progressValue}
                  onChange={(e) => setProgressValue(e.target.value)}
                  placeholder="Ex: 2"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Note (opt.)</Label>
                <Input
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder="Bonne séance"
                />
              </div>
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <><Plus className="h-4 w-4 mr-1" /> Ajouter</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* History */}
      {goal.progress_history.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="font-bold mb-4">Historique</h3>
            <div className="space-y-2">
              {goal.progress_history.slice().reverse().map((p) => (
                <div key={p.id} className="sanctuary-card-subtle !p-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold">+{p.value} {goal.unit}</span>
                    {p.note && <p className="text-xs text-on-surface-variant">{p.note}</p>}
                  </div>
                  <span className="text-xs text-on-surface-variant">{formatDateShort(p.date)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" className="w-full">
            <Trash2 className="h-4 w-4 mr-2" />
            Désactiver cet objectif
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Désactiver cet objectif ?</DialogTitle>
            <DialogDescription>
              Cette action retirera l&apos;objectif de vos actifs. L&apos;historique restera conservé.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setConfirmOpen(false);
                await deactivate();
              }}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
