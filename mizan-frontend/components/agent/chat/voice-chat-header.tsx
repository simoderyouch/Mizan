"use client";

import { MessageSquare, Mic } from "lucide-react";

import { Button } from "@/components/ui/button";

type VoiceChatHeaderProps = {
  onBackToText: () => void;
  sessionActive?: boolean;
};

export function VoiceChatHeader({ onBackToText, sessionActive }: VoiceChatHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-3.5 sm:py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full gradient-primary text-on-primary">
          <Mic className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate">Voice with Mizan</h1>
          <p className="text-sm text-on-surface-variant truncate">
            {sessionActive ? "Session active — speak when ready" : "Tap start, then talk naturally"}
          </p>
        </div>
      </div>
      <Button variant="secondary" size="sm" className="h-9 shrink-0 text-sm" onClick={onBackToText}>
        <MessageSquare className="h-4 w-4 mr-1.5" />
        Text chat
      </Button>
    </div>
  );
}
