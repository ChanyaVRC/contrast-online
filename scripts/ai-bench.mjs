// Multi-turn bench: simulate four consecutive AI turns and compare
// (a) fresh TT per call vs (b) one TT reused across calls.
import { chooseMove, createTT } from "../src/lib/ai/search.ts";
import { applyAction } from "../src/lib/game/rules.ts";
import { initialState } from "../src/lib/game/initial.ts";

function play(reuse) {
  let state = initialState();
  const tt = reuse ? createTT() : undefined;
  let total = { nodes: 0, time: 0 };
  for (let t = 0; t < 4; t++) {
    const t0 = performance.now();
    const res = chooseMove(state, state.turn, {
      timeBudgetMs: 1000,
      maxDepth: 8,
      tt,
    });
    const dt = performance.now() - t0;
    total.nodes += res.nodes;
    total.time += dt;
    console.log(
      `  turn ${t + 1}: depth=${res.depth} nodes=${res.nodes.toLocaleString()} ` +
        `ttSize=${res.ttSize.toLocaleString()} time=${dt.toFixed(0)}ms`,
    );
    if (!res.action) break;
    state = applyAction(state, res.action);
  }
  return total;
}

console.log("--- WITHOUT TT reuse ---");
const a = play(false);
console.log("--- WITH TT reuse across turns ---");
const b = play(true);
console.log(
  `\nTotal: no-reuse ${a.nodes.toLocaleString()} nodes / ${a.time.toFixed(0)}ms`,
);
console.log(
  `Total: reuse    ${b.nodes.toLocaleString()} nodes / ${b.time.toFixed(0)}ms`,
);
