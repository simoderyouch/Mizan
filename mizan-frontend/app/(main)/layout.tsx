"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Navbar from "@/components/layout/Navbar";
import BottomDock from "@/components/layout/BottomDock";
import NotificationsRealtimeListener from "@/components/notifications/realtime-listener";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

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

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-surface">
      <NotificationsRealtimeListener />
      <Navbar />
      <main className="pt-10 pb-28 md:pb-12 px-3 sm:px-4 md:px-6 lg:px-8 w-full max-w-screen-xl mx-auto overflow-x-hidden">
        {children}
      </main>
      <BottomDock />
    </div>
  );
}
