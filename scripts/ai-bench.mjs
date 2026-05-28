// Bench at fixed depth, no timeout: measures raw per-node speed.
import { chooseMove } from "../src/lib/ai/search.ts";
import { initialState } from "../src/lib/game/initial.ts";

const s = initialState();
for (const depth of [4, 5, 6]) {
  const t0 = performance.now();
  const res = chooseMove(s, 1, { timeBudgetMs: 60_000, maxDepth: depth });
  const dt = performance.now() - t0;
  console.log(
    `maxDepth=${depth} reached=${res.depth} nodes=${res.nodes.toLocaleString()} time=${dt.toFixed(0)}ms ` +
      `nps=${Math.round(res.nodes / (dt / 1000)).toLocaleString()}`,
  );
}
