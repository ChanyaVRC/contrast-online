// Pre-build cleanup for Windows: kill stale .next/lock and try to remove
// .open-next. Either can outlive a crashed dev/preview session and then
// block the next `cf:build`. On non-Windows this is mostly a no-op.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const lockFile = path.join(root, ".next", "lock");
const openNextDir = path.join(root, ".open-next");

if (fs.existsSync(lockFile)) {
  try {
    fs.rmSync(lockFile, { force: true });
    console.log("[clean] removed stale .next/lock");
  } catch (e) {
    console.warn("[clean] could not remove .next/lock:", e.message);
  }
}

if (fs.existsSync(openNextDir)) {
  // Retry a few times because Windows may hold handles open briefly after a
  // previous wrangler/workerd process exits.
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      fs.rmSync(openNextDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
      console.log("[clean] removed .open-next");
      break;
    } catch (e) {
      if (attempt === 4) {
        console.error(
          "[clean] could not remove .open-next after 4 attempts.\n" +
            "        A wrangler/workerd/preview process is probably still running.\n" +
            "        Stop it (TaskStop the dev server) and retry.\n" +
            "        Original error:",
          e.message,
        );
        process.exit(1);
      }
    }
  }
}
