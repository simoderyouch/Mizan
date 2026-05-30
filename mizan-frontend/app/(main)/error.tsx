"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error.name === "ChunkLoadError" ||
    error.message.includes("Failed to load chunk") ||
    error.message.includes("Loading chunk");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-bold text-on-surface">Something went wrong</h1>
      <p className="text-sm text-on-surface-variant max-w-md">
        {isChunkError
          ? "A page script failed to load. In development this usually means the dev server rebuilt — reload or try again."
          : error.message || "An unexpected error occurred."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="secondary" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </div>
  );
}
