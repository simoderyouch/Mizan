"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type CheckinView = "hub" | "morning" | "evening" | "voice";
export type CheckinPeriod = "MORNING" | "EVENING";

export type OpenCheckinOptions = {
  view?: CheckinView;
  period?: CheckinPeriod;
};

type CheckinModalContextValue = {
  isOpen: boolean;
  view: CheckinView;
  voicePeriod: CheckinPeriod;
  open: (options?: OpenCheckinOptions) => void;
  close: () => void;
  setView: (view: CheckinView) => void;
  setVoicePeriod: (period: CheckinPeriod) => void;
  notifyCompleted: () => void;
};

const CheckinModalContext = createContext<CheckinModalContextValue | null>(null);

export function CheckinModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<CheckinView>("hub");
  const [voicePeriod, setVoicePeriod] = useState<CheckinPeriod>("MORNING");

  const open = useCallback((options?: OpenCheckinOptions) => {
    if (options?.view) setView(options.view);
    else setView("hub");
    if (options?.period) setVoicePeriod(options.period);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setView("hub");
    setVoicePeriod("MORNING");
  }, []);

  const notifyCompleted = useCallback(() => {
    window.dispatchEvent(new CustomEvent("mizan:checkin:completed"));
    close();
  }, [close]);

  const value = useMemo(
    () => ({
      isOpen,
      view,
      voicePeriod,
      open,
      close,
      setView,
      setVoicePeriod,
      notifyCompleted,
    }),
    [isOpen, view, voicePeriod, open, close, notifyCompleted]
  );

  return <CheckinModalContext.Provider value={value}>{children}</CheckinModalContext.Provider>;
}

export function useCheckinModal() {
  const ctx = useContext(CheckinModalContext);
  if (!ctx) {
    throw new Error("useCheckinModal must be used within CheckinModalProvider");
  }
  return ctx;
}

export function useCheckinModalOptional() {
  return useContext(CheckinModalContext);
}
