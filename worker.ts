/// <reference types="@cloudflare/workers-types" />
// OpenNext generates this at build time (`npm run build` via opennextjs-cloudflare build).
// @ts-expect-error generated worker has no .d.ts before build
import handler from "./.open-next/worker.js";

export { RoomDO } from "./src/worker/room";

export default handler as ExportedHandler;
