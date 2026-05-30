/**
 * Optional realtime voice companion hook.
 * Connects to `/api/v1/voice/realtime` when enabled.
 * Falls back to REST voice/chat flow when unavailable.
 */
import { useCallback, useRef, useState } from "react";
import { API_ORIGIN, tokenStore } from "../../../lib/api";

export function useVoiceRealtime() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    const token = await tokenStore.getAccessToken();
    if (!token) {
      setError("Not authenticated");
      return false;
    }
    const wsOrigin = API_ORIGIN.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsOrigin}/api/v1/voice/realtime?token=${token}`);
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };
    ws.onerror = () => setError("Realtime voice unavailable");
    ws.onclose = () => setConnected(false);
    return true;
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  return { connected, error, connect, disconnect, socket: wsRef };
}
