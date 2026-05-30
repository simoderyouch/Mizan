"use client";

import { cn } from "@/lib/utils";

const PROMPTS = [
  "What should I focus on today?",
  "I'm feeling stressed — help me reset",
  "Turn our chat into tasks I can track",
  "How does Mizan support my wellbeing?",
] as const;

type ChatStarterPromptsProps = {
  onSelect: (text: string) => void;
  disabled?: boolean;
  className?: string;
};

export function ChatStarterPrompts({ onSelect, disabled, className }: ChatStarterPromptsProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-2", className)}>
      {PROMPTS.map((text) => (
        <button
          key={text}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(text)}
          className={cn(
            "rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-3 py-2.5 text-left text-sm text-on-surface",
            "hover:border-primary/30 hover:bg-primary/5 transition-colors disabled:opacity-50"
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
