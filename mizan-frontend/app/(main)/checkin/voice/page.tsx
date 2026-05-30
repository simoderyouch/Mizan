"use client";

import { Suspense } from "react";
import { CheckinRouteRedirect } from "@/components/checkin/checkin-route-redirect";

export { VoiceCheckinFlow } from "./voice-flow";
export type { VoiceCheckinFlowProps } from "./voice-flow";

export default function VoiceCheckinPage() {
  return (
    <Suspense fallback={null}>
      <CheckinRouteRedirect defaultCheckin="voice" />
    </Suspense>
  );
}
