// Worker that handles a single book-generation job:
//   1. Deep search at the given state to pick the best move.
//   2. Rank top-K replies via shallow searches.
//   3. Return canonical key + canonical move + child states.
import { parentPort } from "node:worker_threads";
import { chooseMove, createTT } from "../src/lib/ai/search.ts";
import {
  canonicalize,
  moveToCompact,
  packCompactMove,
  transformCompactMove,
} from "../src/lib/ai/symmetry.ts";
import {
  applyAction,
  buildPieceGrid,
  legalDestinations,
} from "../src/lib/game/rules.ts";

function listMoveActions(state) {
  const out = [];
  const grid = buildPieceGrid(state);
  for (const piece of state.pieces) {
    if (piece.owner !== state.turn) continue;
    for (const dest of legalDestinations(state, piece, grid)) {
      out.push({
        kind: "move",
        pieceId: piece.id,
        to: dest.to,
        tilePlace: null,
      });
    }
  }
  return out;
}

function rankTopMoves(state, k, rankTimeMs) {
  const candidates = listMoveActions(state);
  const scored = candidates.map((action) => {
    const next = applyAction(state, action);
    if (next.winner !== null) {
      return {
        action,
        score: next.winner === state.turn ? 9_000_000 : -9_000_000,
      };
    }
    const res = chooseMove(next, next.turn, {
      timeBudgetMs: rankTimeMs,
      maxDepth: 5,
    });
    return { action, score: -res.score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.action);
}

parentPort.on("message", (job) => {
  const { state, branch, searchTimeMs, searchDepth, rankTimeMs } = job;
  const t0 = performance.now();

  const tt = createTT();
  const res = chooseMove(state, state.turn, {
    timeBudgetMs: searchTimeMs,
    maxDepth: searchDepth,
    tt,
  });
  const dt = performance.now() - t0;

  if (!res.action) {
    parentPort.postMessage({
      canonicalKey: null,
      info: { depth: 0, nodes: 0, time: dt },
    });
    return;
  }

  const { key, transform } = canonicalize(state);
  const compact = moveToCompact(state, res.action);
  const canonicalMove = transformCompactMove(compact, transform);
  const packedMove = packCompactMove(canonicalMove);

  const replies = rankTopMoves(state, branch, rankTimeMs);
  const children = replies.map((r) => applyAction(state, r));

  parentPort.postMessage({
    canonicalKey: key,
    packedMove,
    children,
    info: { depth: res.depth, nodes: res.nodes, time: dt },
  });
});
