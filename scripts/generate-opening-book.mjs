// Offline opening book generator.
//
// Walks a few plies into the game tree, at each visited position runs a
// deep search to pick the best move, and writes
//   { canonicalKey: { from: [r,c], to: [r,c], tilePlace?: { ... } } }
// to public/opening-book.json. Storing in canonical form deduplicates
// across the 4-element symmetry group (identity, mirror, rotswap,
// mirror+rotswap), so the book covers up to 4 distinct game positions
// per stored entry.
//
// At runtime the AI worker computes the canonical key for the current
// position, looks the entry up, then maps the stored move back into the
// live coordinate system using the same transform.
import fs from "node:fs";
import path from "node:path";
import {
  chooseMove,
  createTT,
} from "../src/lib/ai/search.ts";
import {
  canonicalize,
  moveToCompact,
  transformCompactMove,
} from "../src/lib/ai/symmetry.ts";
import {
  applyAction,
  buildPieceGrid,
  legalDestinations,
} from "../src/lib/game/rules.ts";
import { initialState } from "../src/lib/game/initial.ts";

const PLIES = 5;
const BRANCH = 3;
const SEARCH_TIME_MS = 2000;
const SEARCH_DEPTH = 8;
const RANK_TIME_MS = 250;

const book = {};
const visited = new Set();
let searches = 0;
let collisions = 0;

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

function rankTopMoves(state, k) {
  const candidates = listMoveActions(state);
  const scored = candidates.map((action) => {
    const next = applyAction(state, action);
    if (next.winner !== null) {
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

  const { key: cKey, transform: cT } = canonicalize(state);

  // Visited dedup uses the canonical key — symmetric branches all
  // share the same key and only get searched once.
  if (visited.has(cKey)) {
    collisions++;
    return;
  }
  visited.add(cKey);

  searches++;
  const t0 = Date.now();
  const tt = createTT();
  const res = chooseMove(state, state.turn, {
    timeBudgetMs: SEARCH_TIME_MS,
    maxDepth: SEARCH_DEPTH,
    tt,
  });
  if (!res.action) return;

  // Store in canonical coords: map the chosen move into canonical space.
  const compact = moveToCompact(state, res.action);
  const canonicalCompact = transformCompactMove(compact, cT);
  book[cKey] = canonicalCompact;

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
    `SEARCH=${SEARCH_TIME_MS}ms/depth${SEARCH_DEPTH} (with 4× symmetry dedup)`,
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
    `across ${searches} deep searches (${collisions} symmetry collisions).`,
);
