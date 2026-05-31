"use client";

import Image from "next/image";

import { LandingPage } from "@/components/landing/landing-page";
import { useAuth } from "@/lib/auth";

export default function RootPage() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Image
          src="/MIZAN_ICON.png"
          alt="Mizan"
          width={64}
          height={64}
          priority
          className="animate-pulse-soft h-16 w-16"
        />
      </div>
    );
  }

  return <LandingPage />;
}
