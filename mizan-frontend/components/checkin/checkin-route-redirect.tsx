"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type CheckinRouteRedirectProps = {
  defaultCheckin?: string;
};

/** Sends legacy /checkin URLs to home with optional deep-link query for the modal. */
export function CheckinRouteRedirect({ defaultCheckin }: CheckinRouteRedirectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const checkin = searchParams.get("checkin") ?? defaultCheckin;
    const period = searchParams.get("period");
    const params = new URLSearchParams();
    if (checkin) params.set("checkin", checkin);
    if (period) params.set("period", period);
    const qs = params.toString();
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard");
  }, [router, searchParams, defaultCheckin]);

  return null;
}
