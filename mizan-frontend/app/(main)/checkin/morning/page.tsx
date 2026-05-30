"use client";

import { Suspense } from "react";
import { CheckinRouteRedirect } from "@/components/checkin/checkin-route-redirect";

export { MorningCheckinFlow } from "./morning-flow";
export type { MorningCheckinFlowProps } from "./morning-flow";

export default function MorningCheckinPage() {
  return (
    <Suspense fallback={null}>
      <CheckinRouteRedirect defaultCheckin="morning" />
    </Suspense>
  );
}
