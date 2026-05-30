"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { CheckinPeriod, CheckinView } from "@/components/checkin/checkin-modal-context";
import { useCheckinModal } from "@/components/checkin/checkin-modal-context";

type DashboardCheckinDeepLinkProps = {
  ready: boolean;
};

/** Opens check-in modal when landing on /dashboard?checkin=… (bookmark / legacy routes). */
export function DashboardCheckinDeepLink({ ready }: DashboardCheckinDeepLinkProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { open } = useCheckinModal();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    const checkin = searchParams.get("checkin");
    if (!checkin) return;

    const key = `${checkin}:${searchParams.get("period") ?? ""}`;
    if (handledRef.current === key) return;
    handledRef.current = key;

    const periodParam = searchParams.get("period");
    const period: CheckinPeriod | undefined =
      periodParam === "EVENING" ? "EVENING" : periodParam === "MORNING" ? "MORNING" : undefined;

    const viewMap: Record<string, CheckinView> = {
      hub: "hub",
      morning: "morning",
      evening: "evening",
      voice: "voice",
    };
    const view = viewMap[checkin.toLowerCase()] ?? "hub";

    open({ view, period });
    router.replace("/dashboard", { scroll: false });
  }, [ready, searchParams, open, router]);

  return null;
}
