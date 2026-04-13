"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Heart, Sparkles, User, ListChecks, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const DOCK_ITEMS = [
  { href: "/dashboard", label: "Accueil", icon: Home },
  { href: "/checkin", label: "Bien-être", icon: Heart },
  { href: "/agent/contracts", label: "Actions", icon: ClipboardCheck },
  { href: "/tasks", label: "Tâches", icon: ListChecks },
  { href: "/agent/chat", label: "Agent", icon: Sparkles },
  { href: "/profile", label: "Profil", icon: User },
];

export default function BottomDock() {
  const pathname = usePathname();
  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href.split("/").slice(0, 2).join("/"));
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-xl border-t border-outline-variant/10 pb-[env(safe-area-inset-bottom)] select-none">
      <div className="flex items-center justify-between px-2 pt-2 pb-1">
        {DOCK_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 min-w-[16.66%] py-1 active:scale-95 transition-transform duration-200 select-none touch-manipulation",
                active ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <div className={cn("flex items-center justify-center w-14 h-8 rounded-full transition-colors", active && "bg-primary/10")}>
                <Icon className={cn("h-5 w-5", active && "text-primary")} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span className={cn("text-[10px] font-semibold tracking-wide", active ? "text-primary" : "text-on-surface-variant")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
