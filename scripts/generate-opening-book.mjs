// Parallel opening-book generator.
//
// BFS the game tree up to PLIES half-moves. Each visited position is a
// "job" handed to one of N worker threads; the worker does a deep
// alpha-beta search and returns the best move plus its top-BRANCH
// candidate replies (which become children to enqueue). Symmetry
// canonicalisation deduplicates across the 4-orbit so the same
// equivalence-class is searched only once.
//
// Tunables can also come from environment variables:
//   WORKERS, PLIES, BRANCH, SEARCH_TIME, SEARCH_DEPTH, RANK_TIME
import { Worker } from "node:worker_threads";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { canonicalize } from "../src/lib/ai/symmetry.ts";
import { initialState } from "../src/lib/game/initial.ts";
import { stringifyPretty } from "./book-format.mjs";

const envInt = (name, fallback) => {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const NUM_WORKERS = envInt("WORKERS", Math.max(1, os.cpus().length - 1));
const PLIES = envInt("PLIES", 8);
const BRANCH = envInt("BRANCH", 3);
const SEARCH_TIME_MS = envInt("SEARCH_TIME", 6000);
const SEARCH_DEPTH = envInt("SEARCH_DEPTH", 12);
const RANK_TIME_MS = envInt("RANK_TIME", 400);
const APPEND = process.env.APPEND === "1" || process.env.APPEND === "true";

const SOURCE_PATH = path.join("data", "opening-book.json");

/** Pre-existing entries loaded when APPEND=1. Positions whose canonical
 *  key is already in here are skipped at the deep-search step — their
 *  stored move stands — but their children are still expanded so the
 *  BFS can reach previously-untouched positions. */
const existingBook = (() => {
  if (!APPEND) return {};
  if (!fs.existsSync(SOURCE_PATH)) {
    console.warn(
      `APPEND=1 but ${SOURCE_PATH} doesn't exist yet — starting fresh.`,
    );
    return {};
  }
  return JSON.parse(fs.readFileSync(SOURCE_PATH, "utf-8"));
})();
const existingKeys = new Set(Object.keys(existingBook));

const workerPath = new URL("./book-worker.mjs", import.meta.url);

console.log(
  `Generator: PLIES=${PLIES} BRANCH=${BRANCH} ` +
    `SEARCH=${SEARCH_TIME_MS}ms/depth${SEARCH_DEPTH} RANK=${RANK_TIME_MS}ms ` +
    `WORKERS=${NUM_WORKERS} ` +
    `MODE=${APPEND ? `append (${existingKeys.size} existing entries)` : "overwrite"}`,
);

const workers = Array.from(
  { length: NUM_WORKERS },
  () => new Worker(workerPath, { execArgv: ["--import", "tsx"] }),
);

const idleWorkers = [...workers];
const book = { ...existingBook };
const visited = new Set();
const queue = [];
let inFlight = 0;
let completed = 0;
let collisions = 0;
let newlyAdded = 0;
let reusedFromBook = 0;

function tryEnqueue(state, plies) {
  if (plies <= 0 || state.winner !== null) return;
  const { key } = canonicalize(state);
  if (visited.has(key)) {
    collisions++;
    return;
  }
  visited.add(key);
  const skipDeepSearch = existingKeys.has(key);
  queue.push({ state, plies, skipDeepSearch });
}

tryEnqueue(initialState(), PLIES);

const t0 = Date.now();

await new Promise((resolve) => {
  function dispatch() {
    while (queue.length > 0 && idleWorkers.length > 0) {
      const worker = idleWorkers.pop();
      const job = queue.shift();
      inFlight++;

      const handler = (result) => {
        worker.off("message", handler);
        idleWorkers.push(worker);
        inFlight--;
        completed++;

        if (result.canonicalKey) {
          book[result.canonicalKey] = result.packedMove;
          newlyAdded++;
        }
        if (result.reused) reusedFromBook++;
        for (const child of result.children ?? []) {
          tryEnqueue(child, job.plies - 1);
        }

        const tag = result.reused ? "reused" : "new   ";
        process.stdout.write(
          `[${completed.toString().padStart(4)}] ` +
            `plies=${(PLIES - job.plies).toString().padStart(2)} ` +
            `${tag} ` +
            `depth=${result.info.depth.toString().padStart(2)} ` +
            `nodes=${result.info.nodes.toLocaleString().padStart(10)} ` +
            `${result.info.time.toFixed(0).padStart(5)}ms ` +
            `(queue=${queue.length} active=${inFlight})\n`,
        );

        if (queue.length === 0 && inFlight === 0) resolve();
        else dispatch();
      };
      worker.on("message", handler);

      worker.postMessage({
        state: job.state,
        branch: BRANCH,
        searchTimeMs: SEARCH_TIME_MS,
        searchDepth: SEARCH_DEPTH,
        rankTimeMs: RANK_TIME_MS,
        skipDeepSearch: job.skipDeepSearch,
      });
    }
  }

  dispatch();
});

await Promise.all(workers.map((w) => w.terminate()));

const dt = (Date.now() - t0) / 1000;

// Generator writes the source-of-truth pretty file under `data/`. The
// minified `public/opening-book.json` is produced from it by the
// `book:minify` script (run automatically by predev / prebuild hooks).
const outDir = path.join("data");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "opening-book.json");
fs.writeFileSync(outPath, stringifyPretty(book));
const sizeKB = fs.statSync(outPath).size / 1024;

console.log(
  `\nWrote ${Object.keys(book).length} positions ` +
    `(${sizeKB.toFixed(1)} KB, pretty + sorted) to ${outPath} in ${dt.toFixed(0)}s`,
);
console.log(
  `  + ${newlyAdded} new entries from this run` +
    (APPEND ? `, ${reusedFromBook} positions reused from existing book` : "") +
    `, ${collisions} symmetry collisions, ${NUM_WORKERS} workers`,
);
console.log(
  "Run `npm run book:minify` to refresh public/opening-book.json for distribution.",
);
