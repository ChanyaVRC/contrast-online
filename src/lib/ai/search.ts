import { applyAction, legalActions } from "@game/rules";
import type { GameState, MoveAction, Player } from "@game/types";
import { goalRowOf, opponentOf } from "@game/types";
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

/** Iterative-deepening alpha-beta search. */
export function chooseMove(
  root: GameState,
  me: Player,
  opts: SearchOptions = {},
): SearchResult {
  const deadline = performance.now() + (opts.timeBudgetMs ?? 500);
  const maxDepth = opts.maxDepth ?? 6;
  let best: SearchResult = { action: null, score: -Infinity, depth: 0, nodes: 0 };

  const actions = orderActions(root, me, legalActions(root));
  if (actions.length === 0) return best;

  for (let depth = 1; depth <= maxDepth; depth++) {
    const ctx = { deadline, nodes: 0, me };
    try {
      let alpha = -Infinity;
      const beta = Infinity;
      let bestAction: MoveAction = actions[0];
      let bestScore = -Infinity;

      for (const action of actions) {
        const next = applyAction(root, action);
        const score = -alphaBeta(next, depth - 1, -beta, -alpha, ctx);
        if (score > bestScore) {
          bestScore = score;
          bestAction = action;
        }
        if (score > alpha) alpha = score;
      }
      best = { action: bestAction, score: bestScore, depth, nodes: ctx.nodes };
      // Re-order root moves so best becomes first for next iteration.
      actions.splice(actions.indexOf(best.action!), 1);
      actions.unshift(best.action!);
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

  if (state.winner !== null || depth <= 0) {
    return evaluate(state, ctx.me) * (state.turn === ctx.me ? 1 : -1);
  }

  const actions = orderActions(state, state.turn, legalActions(state));
  if (actions.length === 0) return evaluate(state, ctx.me) * (state.turn === ctx.me ? 1 : -1);

  let value = -Infinity;
  for (const action of actions) {
    const next = applyAction(state, action);
    const score = -alphaBeta(next, depth - 1, -beta, -alpha, ctx);
    if (score > value) value = score;
    if (value > alpha) alpha = value;
    if (alpha >= beta) break;
  }
  return value;
}

function orderActions(state: GameState, mover: Player, actions: MoveAction[]): MoveAction[] {
  const goal = goalRowOf(mover);
  // Prefer moves that advance toward the goal row; tiebreak: actions without tile placement first.
  return actions.slice().sort((a, b) => {
    const aGain = scoreOrder(a, goal, mover, state);
    const bGain = scoreOrder(b, goal, mover, state);
    return bGain - aGain;
  });
}

function scoreOrder(action: MoveAction, goal: number, mover: Player, state: GameState): number {
  const piece = state.pieces.find((p) => p.id === action.pieceId)!;
  const advance = Math.abs(piece.at[0] - goal) - Math.abs(action.to[0] - goal);
  const tilePenalty = action.tilePlace ? 0 : 1; // prefer cheaper no-tile actions when tied
  return advance * 10 + tilePenalty;
}

export const _internals = { opponentOf };
