"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Bell, LogOut, AlertTriangle, Calendar, Clock, Dumbbell, Heart, Moon, FileText, CheckCircle2 } from "lucide-react";
import { notificationsApi } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { cn, formatDateShort, formatTime } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const NAV_LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/checkin", label: "Wellbeing" },
  { href: "/tasks", label: "Tasks" },
  { href: "/agent/contracts", label: "AI Actions" },
  { href: "/agent/chat", label: "Mizan AI" },
  { href: "/history", label: "Progress" },
  { href: "/profile", label: "Profile" },
];

const SHORTCUT_LINKS = [
  { href: "/modes", label: "Modes" },
  { href: "/goals", label: "Goals" },
  { href: "/tasks", label: "Tasks" },
  { href: "/agent/contracts", label: "AI Actions" },
  { href: "/agent/scenarios", label: "Scenario Lab" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { student, logout } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  const loadNotifications = useCallback(async () => {
    setIsLoadingNotifications(true);
    try {
      const data = await notificationsApi.list({ limit: 20 });
      setNotifications(data);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    if (!isNotificationsOpen) return;
    void loadNotifications();
  }, [isNotificationsOpen, loadNotifications]);

  const unreadCount = useMemo(
    () => notifications.reduce((count, item) => (item.is_read ? count : count + 1), 0),
    [notifications]
  );

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    const target = notifications.find((item) => item.id === notificationId);
    if (!target || target.is_read) return;
    setNotifications((prev) =>
      prev.map((item) => (item.id === notificationId ? { ...item, is_read: true } : item))
    );
    try {
      await notificationsApi.markRead(notificationId, true);
    } catch {
      setNotifications((prev) =>
        prev.map((item) => (item.id === notificationId ? { ...item, is_read: false } : item))
      );
    }
  }, [notifications]);
  const markAllAsRead = useCallback(async () => {
    if (unreadCount === 0) return;
    const previous = [...notifications];
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    try {
      await notificationsApi.readAll();
    } catch {
      setNotifications(previous);
    }
  }, [notifications, unreadCount]);

  const getNotificationIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("critical") || t.includes("overdue")) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (t.includes("exam")) return <Calendar className="h-4 w-4 text-purple-500" />;
    if (t.includes("project")) return <FileText className="h-4 w-4 text-blue-500" />;
    if (t.includes("schedule") || t.includes("mode")) return <Clock className="h-4 w-4 text-orange-500" />;
    if (t.includes("sleep")) return <Moon className="h-4 w-4 text-indigo-500" />;
    if (t.includes("sport")) return <Dumbbell className="h-4 w-4 text-green-500" />;
    if (t.includes("wellbeing") || t.includes("resource")) return <Heart className="h-4 w-4 text-pink-500" />;
    return <Bell className="h-4 w-4 text-slate-400" />;
  };

  const getNotificationColor = (type: string, isRead: boolean) => {
    if (isRead) return "border-outline-variant/10 bg-surface/50 text-on-surface-variant";
    const t = type.toLowerCase();
    if (t.includes("critical") || t.includes("overdue")) return "border-red-200 bg-red-50 text-red-900 shadow-sm";
    if (t.includes("exam")) return "border-purple-200 bg-purple-50 text-purple-900";
    if (t.includes("project")) return "border-blue-200 bg-blue-50 text-blue-900";
    if (t.includes("schedule")) return "border-orange-200 bg-orange-50 text-orange-900";
    return "border-primary/20 bg-primary/5 text-on-surface";
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <header className=" top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-2 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="inline-flex items-center">
          <Image
            src="/MIZAN_FULL_LOGO.png"
            alt="Mizan"
            width={132}
            height={40}
            priority
            className="h-[5rem] w-auto"
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "text-primary underline underline-offset-4 decoration-2"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
            <DropdownMenuTrigger asChild>
              <button className="relative rounded-full p-2 text-on-surface-variant hover:bg-surface-container">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[24rem] p-0">
              <div className="flex items-center justify-between border-b border-outline-variant/20 px-3 py-2">
                <DropdownMenuLabel className="p-0 text-sm">Notifications</DropdownMenuLabel>
                <div className="flex gap-3">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      All seen
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void loadNotifications()}
                    className="text-xs text-on-surface-variant hover:text-primary transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              <div className="max-h-[22rem] overflow-y-auto p-2">
                {isLoadingNotifications ? (
                  <p className="px-2 py-3 text-sm text-on-surface-variant">Loading...</p>
                ) : notifications.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-on-surface-variant">No notifications yet.</p>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void markNotificationAsRead(item.id)}
                      className={cn(
                        "mb-2 w-full rounded-lg border p-3 text-left transition-all duration-200 hover:scale-[1.01]",
                        getNotificationColor(item.type, item.is_read)
                      )}
                    >
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5">{getNotificationIcon(item.type)}</div>
                          <div>
                            <p className="line-clamp-1 text-sm font-bold leading-tight">{item.title}</p>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed opacity-90">{item.body}</p>
                          </div>
                        </div>
                        {!item.is_read ? (
                          <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-primary" />
                        ) : null}
                      </div>
                      <div className="mt-2.5 flex items-center justify-between text-[10px] font-medium opacity-60">
                        <span>{formatDateShort(item.created_at)} • {formatTime(item.created_at)}</span>
                        {item.is_read && <CheckCircle2 className="h-3 w-3" />}
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="border-t border-outline-variant/10 p-2">
                <Link
                  href="/notifications"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="flex w-full items-center justify-center rounded-md py-2 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
                >
                  View all notifications
                </Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full">
                <Avatar className="h-9 w-9">

                  {student?.photo_url ? (
                    <AvatarImage src={student.photo_url} alt="avatar" className="object-cover" />
                  ) : null}
                  <AvatarFallback className="text-xs font-bold">
                    {student?.first_name?.[0]}{student?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                {student ? `${student.first_name} ${student.last_name}`.trim() : "My account"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-on-surface-variant">Navigation</DropdownMenuLabel>
              {NAV_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link href={link.href}>{link.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-on-surface-variant">Shortcuts</DropdownMenuLabel>
              {SHORTCUT_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link href={link.href}>{link.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
