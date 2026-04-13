"use client";

import { useState } from "react";
import {
  BookOpen,
  FileText,
  FolderKanban,
  Coffee,
  Zap,
  GraduationCap,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { modesApi } from "@/lib/api";
import type { Mode } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";

export const MODE_CONFIG: Record<Mode, { label: string; icon: any; color: string; bg: string }> = {
  REVISION: { label: "Révision", icon: BookOpen, color: "text-primary", bg: "bg-blue-50" },
  EXAMEN: { label: "Examen", icon: FileText, color: "text-red-500", bg: "bg-red-50" },
  PROJET: { label: "Projet", icon: FolderKanban, color: "text-indigo-500", bg: "bg-indigo-50" },
  REPOS: { label: "Repos", icon: Coffee, color: "text-emerald-500", bg: "bg-emerald-50" },
  SPORT: { label: "Sport", icon: Zap, color: "text-amber-500", bg: "bg-amber-50" },
  COURS: { label: "Cours", icon: GraduationCap, color: "text-purple-500", bg: "bg-purple-50" },
};

export function ModeSelector({
  currentMode,
  onModeChange
}: {
  currentMode?: Mode | null;
  onModeChange?: () => void;
}) {
  const { toast } = useToast();
  const [switching, setSwitching] = useState<Mode | null>(null);

  const handleToggleMode = async (mode: Mode) => {
    if (switching) return;
    setSwitching(mode);
    try {
      if (currentMode === mode) {
        await modesApi.stop();
        toast({ title: "Mode arrêté", description: "Vous êtes maintenant en mode libre." });
      } else {
        await modesApi.start(mode);
        toast({
          title: `Mode ${MODE_CONFIG[mode].label} activé`,
          description: "Votre agent Mizan adapte son assistance."
        });
      }
      onModeChange?.();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de changer de mode.",
        variant: "destructive"
      });
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-2 -mx-2 px-2">
      <div className="flex gap-3 min-w-max pb-2">
        {(Object.entries(MODE_CONFIG) as [Mode, typeof MODE_CONFIG["REVISION"]][]).map(([mode, config]) => {
          const isActive = currentMode === mode;
          const isPending = switching === mode;
          const Icon = config.icon;

          return (
            <button
              key={mode}
              onClick={() => void handleToggleMode(mode)}
              disabled={!!switching && !isPending}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all duration-300 border backdrop-blur-sm select-none",
                isActive
                  ? cn("border-primary/30 ring-4 ring-primary/20 scale-105 z-10", config.bg)
                  : "bg-surface-container/40 border-white/10 text-on-surface-variant hover:bg-surface-container/60 active:scale-95"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-lg transition-colors",
                isActive ? config.bg : "bg-white/50 dark:bg-black/10"
              )}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Icon className={cn("h-4 w-4", isActive ? config.color : "text-on-surface-variant/70")} />
                )}
              </div>
              <span className={cn(
                "text-sm font-bold whitespace-nowrap",
                isActive ? "text-primary" : "text-on-surface-variant"
              )}>
                {config.label}
              </span>
              {isActive && (
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse ml-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
