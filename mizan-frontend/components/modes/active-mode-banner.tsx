"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ModeSession } from "@/lib/types";
import { formatElapsedSeconds, modeLabel } from "@/lib/utils";

interface ActiveModeBannerProps {
  session: ModeSession;
  onStop?: () => void | Promise<void>;
  stopping?: boolean;
  showStop?: boolean;
}

export function ActiveModeBanner({
  session,
  onStop,
  stopping = false,
  showStop = true,
}: ActiveModeBannerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(session.started_at).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [session.started_at]);

  return (
    <Card className="sanctuary-card-accent">
      <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 !py-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Clock className="h-6 w-6 shrink-0 animate-pulse-soft" />
          <div className="min-w-0">
            <span className="label-sanctuary text-on-primary/70">Active mode</span>
            <p className="text-xl font-bold truncate">{modeLabel(session.mode)}</p>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto">
          <span className="text-xl sm:text-2xl font-mono font-bold tabular-nums">
            {formatElapsedSeconds(elapsed)}
          </span>
          <div className="flex items-center gap-2">
            <Link href="/modes">
              <Button variant="secondary" size="sm" className="!text-white !border-white/30">
                Details
              </Button>
            </Link>
            {showStop && onStop ? (
              <Button
                onClick={() => void onStop()}
                disabled={stopping}
                variant="secondary"
                size="sm"
                className="!text-white !border-white/30"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
