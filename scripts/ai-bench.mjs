// Quick bench: how deep does the AI go from the initial position in
// the same time budget the UI uses (1500ms)?
import { chooseMove } from "../src/lib/ai/search.ts";
import { initialState } from "../src/lib/game/initial.ts";

const s = initialState();
const t0 = performance.now();
const res = chooseMove(s, 1, { timeBudgetMs: 1500, maxDepth: 10 });
const dt = performance.now() - t0;
console.log(
  `depth=${res.depth} nodes=${res.nodes.toLocaleString()} time=${dt.toFixed(0)}ms ` +
    `nps=${Math.round(res.nodes / (dt / 1000)).toLocaleString()} ` +
    `score=${res.score} action=${JSON.stringify(res.action)}`,
);
