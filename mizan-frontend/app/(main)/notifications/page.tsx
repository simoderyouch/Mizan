"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/notifications-context";
import { cn, formatDateShort, formatTime } from "@/lib/utils";
import {
  Bell, AlertTriangle, Calendar, Clock, Dumbbell, Heart, Moon,
  FileText, CheckCircle2, ChevronLeft, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    isLoading,
    loadError,
    refresh,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const markAsReadLocal = useCallback(
    async (id: string) => {
      await markAsRead(id);
    },
    [markAsRead]
  );

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
    if (isRead) return "border-outline-variant/10 bg-surface/50";
    const t = type.toLowerCase();
    if (t.includes("critical") || t.includes("overdue")) return "border-red-200 bg-red-50";
    if (t.includes("exam")) return "border-purple-200 bg-purple-50";
    if (t.includes("project")) return "border-blue-200 bg-blue-50";
    if (t.includes("schedule")) return "border-orange-200 bg-orange-50";
    return "border-primary/20 bg-primary/5";
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="rounded-full p-2 hover:bg-surface-container">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            <p className="text-sm text-on-surface-variant">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button size="sm" onClick={() => void markAllAsRead()}>
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {loadError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-sm text-red-800">{loadError}</CardContent>
        </Card>
      ) : null}

      {isLoading && notifications.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">No notifications yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-on-surface-variant">
            When Mizan or your school sends updates, they will appear here and in the bell menu.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void markAsReadLocal(item.id)}
              className={cn(
                "w-full rounded-xl border p-4 text-left transition-colors",
                getNotificationColor(item.type, item.is_read)
              )}
            >
              <div className="flex items-start gap-3">
                {getNotificationIcon(item.type)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-on-surface">{item.title}</p>
                    {!item.is_read ? (
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-on-surface-variant" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-on-surface-variant">{item.body}</p>
                  <p className="mt-2 text-xs text-on-surface-variant/80">
                    {formatDateShort(item.created_at)} • {formatTime(item.created_at)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {notifications.length > 0 && (
        <p className="text-center text-xs text-on-surface-variant">
          Showing your latest {notifications.length} notifications
        </p>
      )}
    </div>
  );
}
