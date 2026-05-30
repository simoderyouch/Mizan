"use client";

import Link from "next/link";
import { ClipboardCheck, MessageSquarePlus, Sparkles } from "lucide-react";

import { COMMITMENTS_LABEL } from "@/lib/agent-commitments";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChatHeaderProps = {
  sending?: boolean;
  onNewChat: () => void;
};

export function ChatHeader({ sending, onNewChat }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-3.5 sm:py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-on-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-container-lowest",
              sending ? "bg-amber-400 animate-pulse" : "bg-emerald-500"
            )}
            aria-hidden
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate">Mizan AI</h1>
          <p className="text-sm text-on-surface-variant truncate">
            {sending ? "Composing a reply…" : "Ask about focus, stress, or your schedule"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex h-9 text-sm" asChild>
          <Link href="/agent/contracts">
            <ClipboardCheck className="h-4 w-4 mr-1.5" />
            {COMMITMENTS_LABEL}
          </Link>
        </Button>
        <Button variant="secondary" size="sm" className="h-9 text-sm" onClick={onNewChat}>
          <MessageSquarePlus className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">New</span>
        </Button>
      </div>
    </div>
  );
}
