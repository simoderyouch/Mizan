import type { Notification } from "./types";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const asBoolean = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

export function parseWsNotification(value: unknown): Notification | null {
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
}

export type WsNotificationPacket =
  | { type: "notification.snapshot" }
  | { type: "notification.all_read"; updated_count?: number }
  | { type: "notification.created"; notification: Notification }
  | { type: "legacy"; title: string; body: string; payload?: Record<string, unknown> };

export function parseWsPacket(raw: unknown): WsNotificationPacket | null {
  const data = asRecord(raw);
  if (!data || typeof data.type !== "string") {
    const title = asString(asRecord(raw)?.title);
    if (title) {
      return {
        type: "legacy",
        title,
        body: asString(asRecord(raw)?.body) ?? "",
        payload: asRecord(asRecord(raw)?.payload) ?? undefined,
      };
    }
    return null;
  }

  if (data.type === "notification.snapshot") {
    return { type: "notification.snapshot" };
  }

  if (data.type === "notification.all_read") {
    return {
      type: "notification.all_read",
      updated_count: typeof data.updated_count === "number" ? data.updated_count : undefined,
    };
  }

  if (data.type === "notification.created") {
    const notif = parseWsNotification(data.notification);
    if (!notif) return null;
    return { type: "notification.created", notification: notif };
  }

  const title = asString(data.title);
  if (title) {
    return {
      type: "legacy",
      title,
      body: asString(data.body) ?? "",
      payload: asRecord(data.payload) ?? undefined,
    };
  }

  return null;
}
