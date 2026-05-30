"use client";

import { Suspense } from "react";
import { CheckinRouteRedirect } from "@/components/checkin/checkin-route-redirect";

export { EveningCheckinFlow } from "./evening-flow";
export type { EveningCheckinFlowProps } from "./evening-flow";

export default function EveningCheckinPage() {
  return (
    <Suspense fallback={null}>
      <CheckinRouteRedirect defaultCheckin="evening" />
    </Suspense>
  );
}
