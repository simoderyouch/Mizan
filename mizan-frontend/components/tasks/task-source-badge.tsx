import { Bot, ClipboardCheck, MessageCircle, Mic, Sun, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getSourceMeta } from "@/lib/task-utils";

const SOURCE_ICONS: Record<string, typeof User> = {
  manual: User,
  chat: MessageCircle,
  voice_chat: Mic,
  morning_checkin: Sun,
  agent: Bot,
};

export function TaskSourceBadge({ source }: { source: string }) {
  const meta = getSourceMeta(source);
  const Icon = SOURCE_ICONS[source] ?? ClipboardCheck;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-semibold gap-1 px-2 py-0",
        meta.tone === "ai" && "border-primary/30 bg-primary/5 text-primary",
        meta.tone === "ritual" && "border-amber-200 bg-amber-50 text-amber-900",
        meta.tone === "agent" && "border-violet-200 bg-violet-50 text-violet-900"
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}
