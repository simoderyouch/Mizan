"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CheckinHub } from "@/components/checkin/checkin-hub";
import { useCheckinModal } from "@/components/checkin/checkin-modal-context";

const MorningCheckinFlow = dynamic(
  () => import("@/app/(main)/checkin/morning/morning-flow").then((m) => m.MorningCheckinFlow),
  { loading: () => <CheckinFlowSkeleton /> }
);
const EveningCheckinFlow = dynamic(
  () => import("@/app/(main)/checkin/evening/evening-flow").then((m) => m.EveningCheckinFlow),
  { loading: () => <CheckinFlowSkeleton /> }
);
const VoiceCheckinFlow = dynamic(
  () => import("@/app/(main)/checkin/voice/voice-flow").then((m) => m.VoiceCheckinFlow),
  { loading: () => <CheckinFlowSkeleton /> }
);

function CheckinFlowSkeleton() {
  return (
    <div className="flex items-center justify-center py-16 text-on-surface-variant">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function CheckinModal() {
  const { isOpen, view, voicePeriod, close, setView, setVoicePeriod, notifyCompleted } = useCheckinModal();

  const openVoice = (period: "MORNING" | "EVENING") => {
    setVoicePeriod(period);
    setView("voice");
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="max-w-4xl w-[min(100vw,55rem)] max-h-[min(92vh,900px)] p-0 gap-0 overflow-hidden flex flex-col [&>button]:z-10"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Daily check-in</DialogTitle>
        <DialogDescription className="sr-only">
          Morning and evening wellbeing rituals, quiz or voice mode.
        </DialogDescription>
        <div className="overflow-y-auto flex-1 p-4 sm:p-6">
          {view === "hub" && (
            <CheckinHub
              compact
              onMorning={() => setView("morning")}
              onEvening={() => setView("evening")}
            />
          )}
          {view === "morning" && (
            <MorningCheckinFlow
              embedded
              onBack={() => setView("hub")}
              onOpenVoice={() => openVoice("MORNING")}
              onComplete={notifyCompleted}
            />
          )}
          {view === "evening" && (
            <EveningCheckinFlow
              embedded
              onBack={() => setView("hub")}
              onOpenVoice={() => openVoice("EVENING")}
              onComplete={notifyCompleted}
            />
          )}
          {view === "voice" && (
            <VoiceCheckinFlow
              embedded
              period={voicePeriod}
              onBack={() => setView(voicePeriod === "MORNING" ? "morning" : "evening")}
              onComplete={notifyCompleted}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
