"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenText, Globe, GraduationCap, LayoutDashboard, LibraryBig, LogOut, Menu, School, ShieldCheck, Sparkles, UserCircle2 } from "lucide-react";

import { authApi, getApiErrorMessage, isApiStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/lib/admin-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AdminShellProps {
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TOKEN_KEYS = {
  access: "mizan_access_token",
  refresh: "mizan_refresh_token",
} as const;

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/classes", label: "Classes", icon: GraduationCap },
  { href: "/admin/resources", label: "Resources", icon: LibraryBig },
];

const GLOBAL_NAV_ITEMS: NavItem[] = [
  { href: "/admin/global", label: "Command center", icon: Globe },
  { href: "/admin/global/schools", label: "Schools", icon: School },
  { href: "/admin/global/verification", label: "Verification", icon: ShieldCheck },
];

const isAdminRole = (role: string) => role.toUpperCase() === "ADMIN";

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");

  const loadSession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEYS.access);
    if (!token) {
      router.replace("/login");
      return;
    }

    setLoading(true);
    setFatalError("");
    try {
      const me = await authApi.me();
      if (!isAdminRole(me.role)) {
        router.replace("/unauthorized");
        return;
      }
      if (pathname.startsWith("/admin/global") && me.school_id) {
        router.replace("/unauthorized");
        return;
      }
      if (pathname === "/admin/dashboard" && !me.school_id) {
        router.replace("/admin/global");
        return;
      }
      setCurrentUser(me);
    } catch (error: unknown) {
      if (isApiStatus(error, 401)) {
        router.replace("/login");
        return;
      }
      if (isApiStatus(error, 403)) {
        router.replace("/unauthorized");
        return;
      }
      setFatalError(getApiErrorMessage(error, "Unable to initialize the admin session."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEYS.access);
    localStorage.removeItem(TOKEN_KEYS.refresh);
    router.replace("/login");
  }, [router]);

  const scopeLabel = useMemo(() => {
    if (!currentUser) return "";
    return currentUser.school_id ? "School scope" : "Global scope";
  }, [currentUser]);

  const isGlobalAdmin = useMemo(() => !currentUser?.school_id, [currentUser]);

  const activeNavItems = useMemo(() => {
    if (!currentUser) return [];
    return isGlobalAdmin ? GLOBAL_NAV_ITEMS : NAV_ITEMS;
  }, [currentUser, isGlobalAdmin]);

  const isActive = useCallback(
    (href: string) => {
      if (href === "/admin/dashboard") return pathname === href;
      return pathname.startsWith(href);
    },
    [pathname]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="mx-auto max-w-screen-2xl px-4 py-4 md:px-8">
          <Skeleton className="h-14 w-full rounded-2xl bg-surface-container-lowest" />
          <div className="mt-6 grid gap-4">
            <Skeleton className="h-28 rounded-2xl bg-surface-container-lowest" />
            <Skeleton className="h-96 rounded-2xl bg-surface-container-lowest" />
          </div>
        </div>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="min-h-screen bg-surface px-4 py-10">
        <Card className="mx-auto max-w-lg overflow-hidden !rounded-2xl !border-none !bg-surface-container-lowest shadow-sanctuary">
          <CardContent className="space-y-4 !p-6">
            <h1 className="text-2xl font-bold text-on-surface">Admin access issue</h1>
            <p className="text-sm text-red-600">{fatalError}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void loadSession()} className="rounded-xl">
                Retry
              </Button>
              <Button variant="destructive" onClick={logout} className="rounded-xl">
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-surface text-on-surface selection:bg-primary/10 selection:text-primary">
      <header className="sticky top-0 z-40 bg-surface-container-low/80 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Link href={currentUser?.school_id ? "/admin/dashboard" : "/admin/global"} className="group inline-flex items-center gap-2">
              <div className="overflow-hidden rounded-xl shadow-sanctuary transition-transform group-hover:scale-105">
                <Image src="/MIZAN_ICON.png" alt="Mizan" width={32} height={32} className="h-10 w-10" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase text-primary">Mizan Admin</p>
                <p className="text-[10px] font-medium text-on-surface-variant">
                  {isGlobalAdmin ? "Command center" : "School Management"}
                </p>
              </div>
            </Link>
            <Badge className="hidden border-none bg-primary/5 text-primary md:inline-flex">{scopeLabel}</Badge>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            <TooltipProvider delayDuration={180}>
              {activeNavItems.map((item) => {
                const ItemIcon = item.icon;
                const active = isActive(item.href);
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300",
                          active
                            ? "bg-primary text-on-primary shadow-sanctuary"
                            : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                        )}
                      >
                        <ItemIcon className={cn("h-4 w-4", active ? "animate-pulse-soft" : "")} />
                        {item.label}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent className="border-none bg-surface-container-high text-on-surface shadow-sanctuary">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </nav>

          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-xs">
                <SheetHeader>
                  <SheetTitle>Admin navigation</SheetTitle>
                  <SheetDescription>Access dashboard modules and management pages.</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-2">
                  {activeNavItems.map((item) => {
                    const ItemIcon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "inline-flex w-full items-center gap-2 rounded-xl px-4 py-3 text-sm transition-all",
                          active
                            ? "bg-primary font-semibold text-on-primary shadow-sanctuary"
                            : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                        )}
                      >
                        <ItemIcon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                  <Button variant="destructive" className="mt-4 w-full" onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 rounded-xl hover:bg-surface-container-high">
                  <UserCircle2 className="h-5 w-5 text-primary" />
                  <span className="hidden font-medium md:inline">Admin</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary-lg p-2">
                <DropdownMenuLabel className="space-y-1 pb-3 pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Authenticated as</p>
                  <p className="truncate text-sm font-semibold">{currentUser.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-surface-container-high" />
                <DropdownMenuItem className="gap-2 rounded-lg py-2 transition-colors focus:bg-primary/5 focus:text-primary">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="font-medium">{scopeLabel}</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 rounded-lg py-2 transition-colors focus:bg-primary/5 focus:text-primary" asChild>
                  <Link href={currentUser.school_id ? "/admin/dashboard" : "/admin/global"}>
                    <LayoutDashboard className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      {currentUser.school_id ? "Institutional Dashboard" : "Command Center"}
                    </span>
                  </Link>
                </DropdownMenuItem>
                
                {currentUser.school_id && (
                  <DropdownMenuItem className="gap-2 rounded-lg py-2 transition-colors focus:bg-primary/5 focus:text-primary" asChild>
                    <Link href="/admin/classes">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      <span className="font-medium">Class operations</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                
                {!currentUser.school_id && (
                  <DropdownMenuItem className="gap-2 rounded-lg py-2 transition-colors focus:bg-primary/5 focus:text-primary" asChild>
                    <Link href="/admin/global/schools">
                      <School className="h-4 w-4 text-primary" />
                      <span className="font-medium">Manage Schools</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-surface-container-high" />
                <DropdownMenuItem className="gap-2 rounded-lg py-2 text-red-600 transition-colors focus:bg-red-50 focus:text-red-700" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  <span className="font-medium">Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-2xl px-4 py-5 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
