"use client";

import * as React from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ToastProvider, ToastViewport, Toast, ToastClose, ToastDescription, ToastTitle, type ToastProps } from "@/components/ui/toast";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";

type ToastVariant = NonNullable<ToastProps["variant"]>;
type ToastItem = ToastProps & { id: string; title?: string; description?: string };
type ToastInput = { title?: string; description?: string; variant?: ToastVariant };

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_ICONS: Record<ToastVariant, React.ElementType> = {
  default: Info,
  success: CheckCircle2,
  destructive: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function AppToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    const item: ToastItem = {
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }
      },
      title: input.title,
      description: input.description,
      variant: input.variant ?? "default",
    };
    setToasts((prev) => [...prev, item]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastProvider>
        {children}
        {toasts.map((item) => {
          const Icon = VARIANT_ICONS[item.variant || "default"];
          return (
            <Toast key={item.id} open={item.open} onOpenChange={item.onOpenChange} variant={item.variant}>
              <div className="flex items-center gap-3 pr-8">
                <div className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-white/50 shadow-sm transition-transform group-data-[state=open]:scale-110">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col">
                  {item.title ? (
                    <ToastTitle className="text-sm font-bold tracking-tight leading-none">
                      {item.title}
                    </ToastTitle>
                  ) : null}
                  {item.description ? (
                    <ToastDescription className="mt-1 text-xs opacity-80 leading-tight font-medium line-clamp-1">
                      {item.description}
                    </ToastDescription>
                  ) : null}
                </div>
              </div>
              <ToastClose />
            </Toast>
          );
        })}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within AppToastProvider");
  return ctx;
}
