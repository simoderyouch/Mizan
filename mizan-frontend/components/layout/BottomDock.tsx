"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Heart, Sparkles, User, ListChecks, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const DOCK_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/checkin", label: "Wellbeing", icon: Heart },
  { href: "/agent/contracts", label: "Actions", icon: ClipboardCheck },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/agent/chat", label: "Mizan AI", icon: Sparkles },
  { href: "/profile", label: "Profile", icon: User },
];

export default function BottomDock() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href.split("/").slice(0, 2).join("/"));
  };

  return (
    <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 md:hidden max-w-[calc(100vw-16px)]">
      <div className="glass-dock flex items-center gap-0.5 px-1.5 sm:px-3 py-2">
        {DOCK_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 sm:px-4 py-2 rounded-full transition-all min-w-0",
                active
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-primary"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider truncate max-w-[56px] sm:max-w-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
