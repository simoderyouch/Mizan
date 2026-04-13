import { AlertCircle, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-2xl bg-red-50/50 p-6 shadow-sm ring-1 ring-inset ring-red-500/10">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-red-100 p-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-base font-bold text-red-900">{title}</p>
          <p className="text-sm leading-relaxed text-red-700/80">{message}</p>
          {onRetry ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="mt-2 rounded-xl border-none bg-red-100 text-red-700 transition-all hover:bg-red-200"
            >
              Retry operation
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl bg-surface-container-low p-10 text-center transition-all hover:bg-surface-container-high/50">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-highest text-primary">
        <Inbox className="h-8 w-8" />
      </div>
      <p className="text-lg font-bold text-on-surface">{title}</p>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-on-surface-variant">{message}</p>
      {actionLabel && onAction ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-6 rounded-xl bg-primary px-6 py-5 text-on-primary shadow-sanctuary transition-all hover:shadow-sanctuary-lg"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
