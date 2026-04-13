"use client";

import { useEffect } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Navbar from "@/components/layout/Navbar";
import BottomDock from "@/components/layout/BottomDock";
import NotificationsRealtimeListener from "@/components/notifications/realtime-listener";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAgentChat = pathname === "/agent/chat";

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
    <div className="flex flex-col h-[100dvh] bg-surface overflow-hidden">
      <NotificationsRealtimeListener />
      <Navbar />
      <main
        className={`flex-1 min-h-0 w-full px-4 overflow-x-hidden ${
          isAgentChat
            ? "overflow-hidden overscroll-none pt-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
            : "overflow-y-auto pt-4 pb-28"
        }`}
      >
        {children}
      </main>
      <BottomDock />
    </div>
  );
}
