// Simulate the multi-worker root-split effect by running the same
// chooseMove with the rootActions option restricted to subsets.
// This isn't a wall-clock parallel test (Node single-threaded here),
// but it sanity-checks: (a) the union of split searches finds the same
// or comparable score to a single search, and (b) per-subset searches
// reach deeper than a single full search in the same budget.
import { chooseMove, createTT, generateActions } from "../src/lib/ai/search.ts";
import { initialState } from "../src/lib/game/initial.ts";

const s = initialState();
const me = 1;
const total = generateActions(s, me);
console.log(`Total root actions: ${total.length}`);

console.log("\n--- Single search (full root) ---");
{
  const t0 = performance.now();
  const res = chooseMove(s, me, {
    timeBudgetMs: 1500,
    maxDepth: 10,
    tt: createTT(),
  });
  const dt = performance.now() - t0;
  console.log(
    `depth=${res.depth} score=${res.score} nodes=${res.nodes.toLocaleString()} time=${dt.toFixed(0)}ms`,
  );
}

for (const n of [2, 3, 4]) {
  console.log(`\n--- Split into ${n} subsets (each with 1500ms) ---`);
  const subsets = Array.from({ length: n }, () => []);
  for (let i = 0; i < total.length; i++) subsets[i % n].push(total[i]);
  const results = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    const res = chooseMove(s, me, {
      timeBudgetMs: 1500,
      maxDepth: 10,
      tt: createTT(),
      rootActions: subsets[i],
    });
    const dt = performance.now() - t0;
    results.push(res);
    console.log(
      `  subset ${i + 1}/${n} (${subsets[i].length} actions): depth=${res.depth} ` +
        `score=${res.score} nodes=${res.nodes.toLocaleString()} time=${dt.toFixed(0)}ms`,
    );
  }
  const best = results.reduce((a, b) => (b.score > a.score ? b : a));
  const totalNodes = results.reduce((sum, r) => sum + r.nodes, 0);
  console.log(
    `  best across split: depth=${best.depth} score=${best.score} totalNodes=${totalNodes.toLocaleString()}`,
  );
}
