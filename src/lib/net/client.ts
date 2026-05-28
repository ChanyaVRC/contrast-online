"use client";

import type { ClientMsg, ServerMsg } from "./protocol";
import { decode, encode } from "./protocol";

export interface RoomClientOptions {
  roomId: string;
  token: string;
  onMessage: (msg: ServerMsg) => void;
  onStatus?: (status: "connecting" | "open" | "closed") => void;
}

export interface RoomClient {
  send: (msg: ClientMsg) => void;
  close: () => void;
}

export function openRoomClient(opts: RoomClientOptions): RoomClient {
  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectAttempt = 0;
  const queue: ClientMsg[] = [];

  function connect() {
    opts.onStatus?.("connecting");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/api/room/${opts.roomId}`);
    ws.onopen = () => {
      reconnectAttempt = 0;
      opts.onStatus?.("open");
      send({ t: "hello", token: opts.token });
      // flush queue
      while (queue.length && ws?.readyState === WebSocket.OPEN) {
        ws.send(encode(queue.shift()!));
      }
    };
    ws.onmessage = (ev) => {
      try {
        const msg = decode<ServerMsg>(ev.data);
        opts.onMessage(msg);
      } catch {
        /* ignore malformed */
      }
    };
    ws.onclose = () => {
      opts.onStatus?.("closed");
      if (closed) return;
      const delay = Math.min(1000 * 2 ** reconnectAttempt, 8000);
      reconnectAttempt++;
      setTimeout(connect, delay);
    };
    ws.onerror = () => {
      ws?.close();
    };
  }

  function send(msg: ClientMsg) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(encode(msg));
    } else {
      queue.push(msg);
    }
  }

  connect();

  return {
    send,
    close() {
      closed = true;
      ws?.close();
    },
  };
}

export function ensurePlayerToken(): string {
  if (typeof window === "undefined") return "";
  const KEY = "contrast.token";
  let token = sessionStorage.getItem(KEY);
  if (!token) {
    token = crypto.randomUUID();
    sessionStorage.setItem(KEY, token);
  }
  return token;
}
