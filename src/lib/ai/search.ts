import { applyAction, legalDestinations, pieceAt } from "@game/rules";
import type { Coord, GameState, MoveAction, Player, TileColor } from "@game/types";
import {
  BOARD_SIZE,
  coordEq,
  goalRowOf,
  inBounds,
  opponentOf,
} from "@game/types";
import { evaluate } from "./evaluate";

interface SearchOptions {
  /** Hard wall-clock budget in ms. */
  timeBudgetMs?: number;
  /** Maximum ply depth. */
  maxDepth?: number;
}

interface SearchResult {
  action: MoveAction | null;
  score: number;
  depth: number;
  nodes: number;
}

class TimeUp extends Error {}

interface TTEntry {
  depth: number;
  value: number;
  flag: "exact" | "lower" | "upper";
  bestActionKey?: string;
}

/** Iterative-deepening alpha-beta search with transposition table. */
export function chooseMove(
  root: GameState,
  me: Player,
  opts: SearchOptions = {},
): SearchResult {
  const deadline = performance.now() + (opts.timeBudgetMs ?? 1200);
  const maxDepth = opts.maxDepth ?? 8;
  const tt = new Map<string, TTEntry>();
  let best: SearchResult = { action: null, score: -Infinity, depth: 0, nodes: 0 };

  const rootActions = generateActions(root, me);
  if (rootActions.length === 0) return best;

  // Order root actions by quick eval-delta.
  const orderedRoot = orderActions(root, rootActions, undefined, me);

  for (let depth = 1; depth <= maxDepth; depth++) {
    const ctx: Ctx = { deadline, nodes: 0, me, tt };
    try {
      let alpha = -Infinity;
      const beta = Infinity;
      let iterationBestAction: MoveAction = orderedRoot[0];
      let iterationBestScore = -Infinity;

      for (const action of orderedRoot) {
        const next = applyAction(root, action);
        const score = -alphaBeta(next, depth - 1, -beta, -alpha, ctx);
        if (score > iterationBestScore) {
          iterationBestScore = score;
          iterationBestAction = action;
        }
        if (score > alpha) alpha = score;
      }
      best = {
        action: iterationBestAction,
        score: iterationBestScore,
        depth,
        nodes: ctx.nodes,
      };
      // Pull best-so-far to the front for the next iteration.
      const idx = orderedRoot.indexOf(iterationBestAction);
      if (idx > 0) {
        orderedRoot.splice(idx, 1);
        orderedRoot.unshift(iterationBestAction);
      }
      // Early-out on confirmed win/loss at this depth.
      if (Math.abs(iterationBestScore) > 500_000) break;
    } catch (e) {
      if (e instanceof TimeUp) break;
      throw e;
    }
  }
  return best;
}

interface Ctx {
  deadline: number;
  nodes: number;
  me: Player;
  tt: Map<string, TTEntry>;
}

function alphaBeta(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  ctx: Ctx,
): number {
  ctx.nodes++;
  if ((ctx.nodes & 1023) === 0 && performance.now() > ctx.deadline) throw new TimeUp();

  if (state.winner !== null) {
    // Engine quirk: `turn` does NOT flip after a winning move (so the
    // UI can say "Pn の勝利"). For negamax we need the score from the
    // perspective of the player who WOULD move next — the loser.
    // Earlier wins are more valuable, hence subtracting ply.
    return -(1_000_000 - state.ply);
  }
  if (depth <= 0) {
    return relativeEval(state, ctx.me);
  }

  const key = stateKey(state);
  const hit = ctx.tt.get(key);
  if (hit && hit.depth >= depth) {
    if (hit.flag === "exact") return hit.value;
    if (hit.flag === "lower" && hit.value > alpha) alpha = hit.value;
    else if (hit.flag === "upper" && hit.value < beta) beta = hit.value;
    if (alpha >= beta) return hit.value;
  }

  const actions = generateActions(state, state.turn);
  if (actions.length === 0) return relativeEval(state, ctx.me);

  const ordered = orderActions(state, actions, hit?.bestActionKey, state.turn);

  const alphaOrig = alpha;
  let value = -Infinity;
  let bestKey: string | undefined;

  for (const action of ordered) {
    const next = applyAction(state, action);
    const score = -alphaBeta(next, depth - 1, -beta, -alpha, ctx);
    if (score > value) {
      value = score;
      bestKey = actionKey(action);
    }
    if (value > alpha) alpha = value;
    if (alpha >= beta) break;
  }

  let flag: TTEntry["flag"];
  if (value <= alphaOrig) flag = "upper";
  else if (value >= beta) flag = "lower";
  else flag = "exact";
  ctx.tt.set(key, { depth, value, flag, bestActionKey: bestKey });

  return value;
}

function relativeEval(state: GameState, me: Player): number {
  // Negamax: return eval from the perspective of the player to move.
  const v = evaluate(state, me);
  return state.turn === me ? v : -v;
}

// ---- Move generation with aggressive tile-placement pruning ----

const TILE_CANDIDATE_LIMIT = 4;

interface TileCandidate {
  color: TileColor;
  at: Coord;
}

function generateActions(state: GameState, mover: Player): MoveAction[] {
  if (state.winner !== null) return [];
  const out: MoveAction[] = [];
  const myPieces = state.pieces.filter((p) => p.owner === mover);
  const inv = state.inventories[mover];
  const hasTiles = inv.black > 0 || inv.gray > 0;
  const tileCandidates = hasTiles ? candidateTiles(state, mover, myPieces) : [];

  for (const piece of myPieces) {
    for (const dest of legalDestinations(state, piece)) {
      // Always include the bare-move option.
      out.push({ kind: "move", pieceId: piece.id, to: dest.to, tilePlace: null });

      for (const cand of tileCandidates) {
        if (coordEq(cand.at, dest.to)) continue;
        // Reject if any OTHER piece sits on that cell.
        if (
          state.pieces.some(
            (p) => p.id !== piece.id && coordEq(p.at, cand.at),
          )
        ) {
          continue;
        }
        out.push({
          kind: "move",
          pieceId: piece.id,
          to: dest.to,
          tilePlace: cand,
        });
      }
    }
  }
  return out;
}

function candidateTiles(
  state: GameState,
  mover: Player,
  myPieces: GameState["pieces"],
): TileCandidate[] {
  const inv = state.inventories[mover];
  const goal = goalRowOf(mover);
  const opp = opponentOf(mover);
  const oppFront = oppFrontRow(state, opp);

  // Score every empty, unoccupied cell within Manhattan-2 of any own
  // piece OR adjacent to the opponent's front-most piece (defensive
  // block). Higher = better. Take the top N for both colors.
  const scored: { score: number; color: TileColor; at: Coord }[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c] !== null) continue;
      if (pieceAt(state, r, c)) continue;

      const distOwn = nearestPieceDistance(myPieces, r, c);
      const distOppFront =
        oppFront !== null ? Math.abs(oppFront - r) : BOARD_SIZE;

      if (distOwn > 2 && distOppFront > 1) continue;

      // Prefer placements toward the goal direction (in front of own pieces)
      const goalProximity = BOARD_SIZE - 1 - Math.abs(goal - r);
      const base = 50 - distOwn * 8 - distOppFront * 4 + goalProximity * 3;

      if (inv.gray > 0) {
        scored.push({ score: base + 10, color: "gray", at: [r, c] });
      }
      if (inv.black > 0) {
        scored.push({ score: base, color: "black", at: [r, c] });
      }
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, TILE_CANDIDATE_LIMIT);
  return top.map(({ color, at }) => ({ color, at }));
}

function nearestPieceDistance(
  pieces: GameState["pieces"],
  r: number,
  c: number,
): number {
  let min = BOARD_SIZE * 2;
  for (const p of pieces) {
    const d = Math.abs(p.at[0] - r) + Math.abs(p.at[1] - c);
    if (d < min) min = d;
  }
  return min;
}

function oppFrontRow(state: GameState, opp: Player): number | null {
  const goal = goalRowOf(opp);
  let bestAdvance = -1;
  let bestRow: number | null = null;
  for (const p of state.pieces) {
    if (p.owner !== opp) continue;
    const advance = BOARD_SIZE - 1 - Math.abs(goal - p.at[0]);
    if (advance > bestAdvance) {
      bestAdvance = advance;
      bestRow = p.at[0];
    }
  }
  return bestRow;
}

// ---- Ordering ----

function orderActions(
  state: GameState,
  actions: MoveAction[],
  preferredKey: string | undefined,
  mover: Player,
): MoveAction[] {
  const goal = goalRowOf(mover);
  const scored = actions.map((a) => ({
    a,
    score: quickActionScore(state, a, goal),
    key: actionKey(a),
  }));
  scored.sort((x, y) => y.score - x.score);
  if (preferredKey) {
    const idx = scored.findIndex((s) => s.key === preferredKey);
    if (idx > 0) {
      const [hit] = scored.splice(idx, 1);
      scored.unshift(hit);
    }
  }
  return scored.map((s) => s.a);
}

function quickActionScore(
  state: GameState,
  action: MoveAction,
  goal: number,
): number {
  const piece = state.pieces.find((p) => p.id === action.pieceId)!;
  const before = Math.abs(piece.at[0] - goal);
  const after = Math.abs(action.to[0] - goal);
  let s = (before - after) * 100;
  if (action.tilePlace) {
    s += action.tilePlace.color === "gray" ? 8 : 4;
  } else {
    s += 1; // tiny tiebreak toward not spending tiles
  }
  return s;
}

function actionKey(a: MoveAction): string {
  const t = a.tilePlace
    ? `${a.tilePlace.color}@${a.tilePlace.at[0]},${a.tilePlace.at[1]}`
    : "x";
  return `${a.pieceId}>${a.to[0]},${a.to[1]}|${t}`;
}

// ---- State hashing for TT ----

function stateKey(state: GameState): string {
  let board = "";
  for (const row of state.board) {
    for (const cell of row) {
      board += cell === null ? "." : cell === "black" ? "B" : "G";
    }
  }
  const grid = new Array(BOARD_SIZE * BOARD_SIZE).fill(".");
  for (const p of state.pieces) {
    grid[p.at[0] * BOARD_SIZE + p.at[1]] = p.owner === 1 ? "1" : "2";
  }
  const inv = state.inventories;
  return `${state.turn}|${board}|${grid.join("")}|${inv[1].black}${inv[1].gray}${inv[2].black}${inv[2].gray}`;
}

export const _internals = { generateActions, orderActions, stateKey, opponentOf, inBounds };
