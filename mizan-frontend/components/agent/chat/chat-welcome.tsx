"use client";

import { ChatStarterPrompts } from "@/components/agent/chat/chat-starter-prompts";

type ChatWelcomeProps = {
  disabled?: boolean;
  onSelectPrompt: (text: string) => void;
};

export function ChatWelcome({ disabled, onSelectPrompt }: ChatWelcomeProps) {
  return (
    <div className="rounded-xl border border-outline-variant/12 bg-surface-container/35 p-4 sm:p-5">
      <p className="text-sm font-semibold text-on-surface mb-1">Quick prompts</p>
      <p className="text-sm text-on-surface-variant mb-3">
        Tap one to start, or type your own message below.
      </p>
      <ChatStarterPrompts disabled={disabled} onSelect={onSelectPrompt} />
    </div>
  );
}
