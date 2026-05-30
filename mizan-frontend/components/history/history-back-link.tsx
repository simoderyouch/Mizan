import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function HistoryBackLink() {
  return (
    <Link
      href="/history"
      className="inline-flex items-center text-sm font-medium text-on-surface-variant hover:text-primary transition-colors"
    >
      <ArrowLeft className="h-4 w-4 mr-1.5" />
      Back to progress
    </Link>
  );
}
