/// <reference types="@cloudflare/workers-types" />

import type { RoomDO } from "./worker/room";

declare global {
  interface CloudflareEnv {
    ROOM_DO: DurableObjectNamespace<RoomDO>;
    ASSETS: Fetcher;
  }
}

export {};
