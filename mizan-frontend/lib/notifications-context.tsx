"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getApiErrorMessage, notificationsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Notification } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";

const LIST_LIMIT = 50;
const POLL_MS = 30_000;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const asBoolean = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

export const parseWsNotification = (value: unknown): Notification | null => {
  const obj = asRecord(value);
  if (!obj) return null;
  const id = asString(obj.id);
  const studentId = asString(obj.student_id);
  const type = asString(obj.type);
  const title = asString(obj.title);
  const body = asString(obj.body);
  const createdAt = asString(obj.created_at);
  const isRead = asBoolean(obj.is_read);
  if (!id || !studentId || !type || !title || !body || !createdAt || isRead === null) return null;
  return {
    id,
    student_id: studentId,
    type,
    title,
    body,
    payload: asRecord(obj.payload),
    is_read: isRead,
    read_at: asString(obj.read_at),
    created_at: createdAt,
  };
};

const sortByNewest = (items: Notification[]) =>
  [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

const mergeNotifications = (current: Notification[], incoming: Notification[], limit: number) => {
  const byId = new Map<string, Notification>();
  for (const item of incoming) byId.set(item.id, item);
  for (const item of current) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return sortByNewest([...byId.values()]).slice(0, limit);
};

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  loadError: string | null;
  wsConnected: boolean;
  refresh: () => Promise<void>;
  prepend: (item: Notification) => void;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, student, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const sessionReady = isAuthenticated && student !== null;

  const refresh = useCallback(async () => {
    if (!sessionReady) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await notificationsApi.list({ limit: LIST_LIMIT });
      const sorted = sortByNewest(data);
      setNotifications(sorted);
      for (const item of sorted) seenIdsRef.current.add(item.id);
    } catch (err) {
      setLoadError(getApiErrorMessage(err, "Unable to load notifications."));
    } finally {
      setIsLoading(false);
    }
  }, [sessionReady]);

  const prepend = useCallback((item: Notification) => {
    seenIdsRef.current.add(item.id);
    setNotifications((prev) => mergeNotifications(prev, [item], LIST_LIMIT));
  }, []);

  const markAsRead = useCallback(
    async (notificationId: string) => {
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
    },
    [notifications]
  );

  const markAllAsRead = useCallback(async () => {
    const previous = [...notifications];
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    try {
      await notificationsApi.readAll();
    } catch {
      setNotifications(previous);
    }
  }, [notifications]);

  useEffect(() => {
    if (authLoading || !sessionReady) {
      setNotifications([]);
      setLoadError(null);
      setWsConnected(false);
      seenIdsRef.current.clear();
      return;
    }
    void refresh();
  }, [authLoading, sessionReady, refresh]);

  useEffect(() => {
    if (!sessionReady) return;
    const interval = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    const onRefresh = () => void refresh();
    window.addEventListener("mizan:notifications:refresh", onRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("mizan:notifications:refresh", onRefresh);
    };
  }, [sessionReady, refresh]);

  useEffect(() => {
    if (!sessionReady) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByClient = false;

    const connect = () => {
      const wsUrl = notificationsApi.realtimeUrl();
      if (!wsUrl) return;

      socket = new WebSocket(wsUrl);

      socket.onopen = () => setWsConnected(true);

      socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data) as unknown;
          const payload = asRecord(raw);
          if (!payload || typeof payload.type !== "string") return;

          if (payload.type === "notification.snapshot") {
            const rawItems = Array.isArray(payload.notifications) ? payload.notifications : [];
            const parsed = rawItems.map(parseWsNotification).filter(Boolean) as Notification[];
            for (const item of parsed) seenIdsRef.current.add(item.id);
            setNotifications((prev) => mergeNotifications(prev, parsed, LIST_LIMIT));
            return;
          }

          if (payload.type === "notification.created") {
            const notif = parseWsNotification(payload.notification);
            if (!notif || seenIdsRef.current.has(notif.id)) return;
            seenIdsRef.current.add(notif.id);
            prepend(notif);
            toast({
              title: notif.title || "New notification",
              description: notif.body || "Mizan has an update for you.",
            });
            return;
          }

          if (payload.type === "notification.all_read") {
            setNotifications((prev) =>
              prev.map((item) => (item.is_read ? item : { ...item, is_read: true }))
            );
          }
        } catch {
          // ignore malformed websocket payloads
        }
      };

      socket.onerror = () => setWsConnected(false);

      socket.onclose = () => {
        setWsConnected(false);
        if (closedByClient) return;
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      closedByClient = true;
      setWsConnected(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    };
  }, [sessionReady, prepend, toast]);

  const unreadCount = useMemo(
    () => notifications.reduce((count, item) => (item.is_read ? count : count + 1), 0),
    [notifications]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      loadError,
      wsConnected,
      refresh,
      prepend,
      markAsRead,
      markAllAsRead,
    }),
    [
      notifications,
      unreadCount,
      isLoading,
      loadError,
      wsConnected,
      refresh,
      prepend,
      markAsRead,
      markAllAsRead,
    ]
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
