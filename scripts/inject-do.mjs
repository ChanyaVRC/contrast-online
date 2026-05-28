// Patches the OpenNext-generated worker.js with two concerns:
//   1. Re-export our custom Durable Object class so wrangler can bind to it.
//   2. Intercept WebSocket upgrades to /api/room/:id BEFORE Next.js sees them
//      (Next App Router doesn't support WS upgrades — it dies parsing the Request).
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const target = path.join(root, ".open-next", "worker.js");

if (!fs.existsSync(target)) {
  console.error(`[inject-do] ${target} not found. Did OpenNext build run?`);
  process.exit(1);
}

const marker = "/* injected: contrast room DO + WS interceptor */";
let source = fs.readFileSync(target, "utf8");

if (source.includes(marker)) {
  console.log("[inject-do] already patched; skipping");
  process.exit(0);
}

// Rename the existing default export so we can wrap it.
const replaced = source.replace(
  /\nexport default ({[\s\S]*?async fetch\(request, env, ctx\)[\s\S]*?})\s*;?\s*$/,
  "\nconst __openNextHandler = $1;\n",
);

if (replaced === source) {
  console.error(
    "[inject-do] could not locate the OpenNext default export to wrap. Bailing.",
  );
  process.exit(1);
}

const wrapper = `
${marker}
export { RoomDO } from "../src/worker/room.ts";

const ROOM_ROUTE = /^\\/api\\/room\\/([A-Za-z0-9-]{4,32})\\/?$/;

export default {
  async fetch(request, env, ctx) {
    const upgrade = request.headers.get("Upgrade");
    if (upgrade && upgrade.toLowerCase() === "websocket") {
      const url = new URL(request.url);
      const match = ROOM_ROUTE.exec(url.pathname);
      if (match) {
        const id = env.ROOM_DO.idFromName(match[1]);
        const stub = env.ROOM_DO.get(id);
        return stub.fetch(request);
      }
    }
    return __openNextHandler.fetch(request, env, ctx);
  },
};
`;

fs.writeFileSync(target, replaced + wrapper, "utf8");
console.log(
  "[inject-do] wrapped OpenNext handler with WS interceptor + RoomDO export",
);
