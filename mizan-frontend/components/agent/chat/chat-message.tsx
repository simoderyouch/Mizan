"use client";

import { Sparkles } from "lucide-react";

import { RichTextMessage } from "@/components/agent/rich-text-message";
import type { AgentChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatMessageProps = {
  message: AgentChatMessage;
};

const BUBBLE = "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed";

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={cn("flex w-full gap-3", isAssistant ? "justify-start" : "justify-end")}>
      {isAssistant ? (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5"
          aria-hidden
        >
          <Sparkles className="h-4 w-4" />
        </div>
      ) : null}

      <div
        className={cn(
          BUBBLE,
          isAssistant
            ? "rounded-tl-md border border-outline-variant/12 bg-surface-container-low text-on-surface"
            : "rounded-tr-md gradient-primary text-on-primary"
        )}
      >
        <RichTextMessage
          content={message.content}
          className={isAssistant ? undefined : "[&_a]:text-on-primary [&_code]:bg-white/15"}
        />
      </div>
    </div>
  );
}

export function ChatTypingIndicator() {
  return (
    <div className="flex w-full gap-3 justify-start">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </div>
      <div
        className={cn(BUBBLE, "rounded-tl-md border border-outline-variant/12 bg-surface-container-low")}
        aria-label="Mizan is thinking"
      >
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
