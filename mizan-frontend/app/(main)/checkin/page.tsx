"use client";

import { Suspense } from "react";
import { CheckinRouteRedirect } from "@/components/checkin/checkin-route-redirect";

export default function CheckinPage() {
  return (
    <Suspense fallback={null}>
      <CheckinRouteRedirect />
    </Suspense>
  );
}
