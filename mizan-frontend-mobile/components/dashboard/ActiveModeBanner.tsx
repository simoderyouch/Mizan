"use client";

import { useEffect, useState } from "react";
import { Clock, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { modesApi } from "@/lib/api";
import { MODE_CONFIG } from "@/components/modes/ModeSelector";
import type { ModeSession } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function ActiveModeBanner({
  session,
  onStop
}: {
  session: ModeSession;
  onStop?: () => void;
}) {
  const { toast } = useToast();
  const [elapsed, setElapsed] = useState<string>("00:00:00");
  const [stopping, setStopping] = useState(false);
  const config = MODE_CONFIG[session.mode];

  useEffect(() => {
    const updateTimer = () => {
      const start = new Date(session.started_at).getTime();
      const now = Date.now();
      const diff = Math.max(0, now - start);

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      const h_str = h.toString().padStart(2, "0");
      const m_str = m.toString().padStart(2, "0");
      const s_str = s.toString().padStart(2, "0");

      setElapsed(`${h_str}:${m_str}:${s_str}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session.started_at]);

  const handleStop = async () => {
    setStopping(true);
    try {
      await modesApi.stop();
      toast({ title: "Mode arrêté", description: "Votre session a été enregistrée." });
      onStop?.();
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'arrêter le mode.", variant: "destructive" });
    } finally {
      setStopping(false);
    }
  };

  if (!config) return null;

  return (
    <div className="animate-in slide-in-from-top duration-500 mb-6">
      <div className={cn(
        "relative overflow-hidden rounded-[2rem] p-6 shadow-sanctuary border backdrop-blur-md transition-all",
        config.bg,
        "border-white/20"
      )}>
        {/* Decorative background elements */}
        <div className={cn("absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-3xl", config.bg.replace('bg-', 'bg-'))} />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center shadow-sm", "bg-white ")}>
              <config.icon className={cn("h-7 w-7", config.color)} />
            </div>
            <div>
              <p className="label-sanctuary text-primary opacity-70">Focus Actuel</p>
              <h3 className={cn("text-2xl font-black tracking-tight", config.color)}>
                {config.label}
              </h3>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-2 justify-end mb-1">
              <Clock className="h-4 w-4 text-on-surface-variant animate-pulse" />
              <span className="font-mono text-xl font-bold tracking-widest text-on-surface">
                {elapsed}
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleStop()}
              disabled={stopping}
              className="rounded-xl h-9 bg-white/50 border-white/20 hover:bg-white/80 transition-all font-bold text-xs"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Arrêter
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
