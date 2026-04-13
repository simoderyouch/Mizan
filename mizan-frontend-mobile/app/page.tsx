"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function RootPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      router.replace(isAuthenticated ? "/dashboard" : "/login");
    }
  }, [isAuthenticated, isLoading, router]);

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
