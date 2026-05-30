"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const CHAT_LAYOUT = "mx-auto w-full max-w-9xl";

export const CHAT_INNER_X = "px-4 sm:px-6";

export const CHAT_CARD =
  "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm";

/** Fits main layout (nav + main padding + mobile dock) without forcing extra min-height */
export const CHAT_HEIGHT = "h-[calc(100dvh-12rem)] md:h-[calc(100dvh-10rem)] max-h-[820px]";

type ChatShellProps = {
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Voice mode: body fills height so controls can sit at the bottom */
  variant?: "chat" | "voice";
};

export function ChatShell({ header, footer, children, className, variant = "chat" }: ChatShellProps) {
  return (
    <div className={cn(CHAT_LAYOUT, "flex flex-col", CHAT_HEIGHT, className)}>
      <div className={CHAT_CARD}>
        <div className="shrink-0 border-b border-outline-variant/10 bg-surface-container-lowest">
          <div className={CHAT_INNER_X}>{header}</div>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto bg-surface-container/15",
            variant === "voice" && "flex flex-col"
          )}
        >
          <div
            className={cn(
              CHAT_INNER_X,
              variant === "chat"
                ? "py-4 sm:py-5 flex flex-col gap-4"
                : "flex flex-col flex-1 min-h-0 py-3 sm:py-4"
            )}
          >
            {children}
          </div>
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-outline-variant/10 bg-surface-container-lowest">
            <div className={cn(CHAT_INNER_X, "py-4 space-y-3")}>{footer}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
