"use client";

import { useEffect, useRef } from "react";
import { notificationsApi } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/auth";

type WsNotification = {
  id?: string;
  title?: string;
  body?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const toWsNotification = (value: unknown): WsNotification | null => {
  const obj = asRecord(value);
  if (!obj) return null;
  return {
    id: typeof obj.id === "string" ? obj.id : undefined,
    title: typeof obj.title === "string" ? obj.title : undefined,
    body: typeof obj.body === "string" ? obj.body : undefined,
  };
};

export default function NotificationsRealtimeListener() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByClient = false;

    const connect = () => {
      const wsUrl = notificationsApi.realtimeUrl();
      if (!wsUrl) return;
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data) as unknown;
          const payload = asRecord(raw);
          if (!payload || typeof payload.type !== "string") return;

          if (payload.type === "notification.snapshot") {
            const rawItems = Array.isArray(payload.notifications) ? payload.notifications : [];
            for (const rawItem of rawItems) {
              const item = toWsNotification(rawItem);
              if (item?.id) seenRef.current.add(item.id);
            }
            return;
          }

          if (payload.type === "notification.created") {
            const notif = toWsNotification(payload.notification);
            if (!notif) return;
            if (notif.id && seenRef.current.has(notif.id)) return;
            if (notif.id) seenRef.current.add(notif.id);
            toast({
              title: notif.title || "New notification",
              description: notif.body || "Mizan has an update for you.",
            });
          }
        } catch {
          // ignore malformed websocket payloads
        }
      };

      socket.onclose = () => {
        if (closedByClient) return;
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      closedByClient = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [isAuthenticated, toast]);

  return null;
}
