"use client";

import { Mic, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onVoice: () => void;
  disabled?: boolean;
  sending?: boolean;
};

export function ChatComposer({ value, onChange, onSend, onVoice, disabled, sending }: ChatComposerProps) {
  const canSend = !disabled && !sending && value.trim().length > 0;

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex items-end gap-1.5 rounded-xl border border-outline-variant/15 bg-surface-container/40 p-1.5",
          "focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-shadow"
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-lg text-on-surface-variant hover:text-primary"
          onClick={onVoice}
          aria-label="Switch to voice"
        >
          <Mic className="h-5 w-5" />
        </Button>

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Message Mizan…"
          rows={1}
          disabled={disabled || sending}
          className={cn(
            "flex-1 min-h-[42px] max-h-32 resize-none border-0 bg-transparent px-2 py-2.5 text-[15px] leading-snug",
            "placeholder:text-on-surface-variant/50 focus:outline-none disabled:opacity-60"
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
          }}
        />

        <Button
          type="button"
          size="icon"
          disabled={!canSend}
          onClick={onSend}
          className={cn(
            "h-10 w-10 shrink-0 rounded-lg",
            canSend ? "gradient-primary text-on-primary" : "bg-transparent text-on-surface-variant/40"
          )}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-center text-[11px] text-on-surface-variant/70">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
