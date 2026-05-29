// Offline opening book generator.
//
// Walks a few plies into the game tree, at each visited position runs a
// deep search to pick the best move, and writes the position → action
// mapping to public/opening-book.json. The AI Web Worker fetches this
// at startup and short-circuits chooseMove when the current position is
// in the book.
//
// Parameters are tuned for a ~5 minute generation on a desktop. Bump
// PLIES or BRANCH for a wider/deeper book at quadratic cost.
import fs from "node:fs";
import path from "node:path";
import {
  chooseMove,
  createTT,
  stateKey,
} from "../src/lib/ai/search.ts";
import {
  applyAction,
  buildPieceGrid,
  legalDestinations,
} from "../src/lib/game/rules.ts";
import { initialState } from "../src/lib/game/initial.ts";

const PLIES = 5;          // walk this many half-moves into the tree
const BRANCH = 3;         // explore the top-K replies at each branch
const SEARCH_TIME_MS = 2000;
const SEARCH_DEPTH = 8;
const RANK_TIME_MS = 250; // shallow search used to rank candidate replies

const book = {};
const visited = new Set();
let searches = 0;

/** Enumerate every legal move-only action for the side to move. */
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

/** Rank the top-K candidate moves for the player to move by playing each
 *  and running a shallow search from the resulting position. The score
 *  returned by chooseMove is from the next-to-move's perspective, so we
 *  negate to score from the mover's perspective. */
function rankTopMoves(state, k) {
  const candidates = listMoveActions(state);
  const scored = candidates.map((action) => {
    const next = applyAction(state, action);
    if (next.winner !== null) {
      // Immediate win for the mover is worth a huge positive score.
      return {
        action,
        score:
          next.winner === state.turn ? 9_000_000 : -9_000_000,
      };
    }
    const res = chooseMove(next, next.turn, {
      timeBudgetMs: RANK_TIME_MS,
      maxDepth: 5,
    });
    return { action, score: -res.score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.action);
}

function expand(state, pliesLeft) {
  if (pliesLeft <= 0 || state.winner !== null) return;
  const key = stateKey(state);
  if (visited.has(key)) return;
  visited.add(key);

  searches++;
  const t0 = Date.now();
  const tt = createTT();
  const res = chooseMove(state, state.turn, {
    timeBudgetMs: SEARCH_TIME_MS,
    maxDepth: SEARCH_DEPTH,
    tt,
  });
  if (!res.action) return;
  book[key] = res.action;

  const dt = Date.now() - t0;
  process.stdout.write(
    `  [${searches.toString().padStart(3)}] plies=${PLIES - pliesLeft} ` +
      `depth=${res.depth} nodes=${res.nodes.toLocaleString().padStart(9)} ` +
      `${dt.toFixed(0)}ms\n`,
  );

  const replies = rankTopMoves(state, BRANCH);
  for (const move of replies) {
    const next = applyAction(state, move);
    expand(next, pliesLeft - 1);
  }
}

console.log(
  `Generating opening book: PLIES=${PLIES} BRANCH=${BRANCH} ` +
    `SEARCH=${SEARCH_TIME_MS}ms/depth${SEARCH_DEPTH}`,
);
const t0 = Date.now();
expand(initialState(), PLIES);
const dt = (Date.now() - t0) / 1000;

const outDir = path.join("public");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "opening-book.json");
fs.writeFileSync(outPath, JSON.stringify(book));
const sizeKB = fs.statSync(outPath).size / 1024;

console.log(
  `\nWrote ${Object.keys(book).length} positions ` +
    `(${sizeKB.toFixed(1)} KB) to ${outPath} in ${dt.toFixed(0)}s ` +
    `across ${searches} deep searches.`,
);
