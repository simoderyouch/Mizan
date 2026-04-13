"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { notificationsApi, getApiErrorMessage } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { formatDateShort, formatTime, cn } from "@/lib/utils";
import {
  Bell, AlertTriangle, Calendar, Clock, Dumbbell, Heart, Moon,
  FileText, CheckCircle2, ChevronLeft, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await notificationsApi.list({ limit: 100 });
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load notifications."));
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.is_read) return;

    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await notificationsApi.markRead(id, true);
    } catch {
      void fetchData();
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await notificationsApi.readAll();
    } catch {
      void fetchData();
    }
  };

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const getNotificationIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("critical") || t.includes("overdue")) return <AlertTriangle className="h-5 w-5 text-red-500" />;
    if (t.includes("exam")) return <Calendar className="h-5 w-5 text-purple-500" />;
    if (t.includes("project")) return <FileText className="h-5 w-5 text-blue-500" />;
    if (t.includes("schedule") || t.includes("mode")) return <Clock className="h-5 w-5 text-orange-500" />;
    if (t.includes("sleep")) return <Moon className="h-5 w-5 text-indigo-500" />;
    if (t.includes("sport")) return <Dumbbell className="h-5 w-5 text-green-500" />;
    if (t.includes("wellbeing") || t.includes("resource")) return <Heart className="h-5 w-5 text-pink-500" />;
    return <Bell className="h-5 w-5 text-slate-400" />;
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

  return (
    <div className="page-enter max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void fetchData()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button size="sm" onClick={() => void markAllRead()}>
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="link" size="sm" onClick={() => void fetchData()} className="text-red-700 underline">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && notifications.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-on-surface-variant/40" />
            </div>
            <h3 className="text-lg font-semibold">No new notifications</h3>
            <p className="text-sm text-on-surface-variant max-w-xs mt-2">
              Your latest Mizan updates will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <button
              key={item.id}
              onClick={() => void markAsRead(item.id)}
              className={cn(
                "w-full text-left rounded-2xl border p-4 sm:p-5 transition-all duration-300",
                getNotificationColor(item.type, item.is_read),
                !item.is_read && "shadow-sm transform"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "mt-1 p-2 rounded-xl bg-white/50",
                    !item.is_read && "bg-white/80 shadow-sm"
                  )}>
                    {getNotificationIcon(item.type)}
                  </div>
                  <div>
                    <h3 className={cn("font-bold text-base", !item.is_read && "text-on-surface")}>
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed opacity-90">
                      {item.body}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-xs font-medium opacity-60">
                      <span>{formatDateShort(item.created_at)} • {formatTime(item.created_at)}</span>
                      {item.is_read && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Seen
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {!item.is_read && (
                  <div className="h-3 w-3 rounded-full bg-primary animate-pulse mt-2 flex-shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
