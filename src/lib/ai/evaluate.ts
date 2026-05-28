import {
  BOARD_SIZE,
  GameState,
  Piece,
  Player,
  goalRowOf,
  opponentOf,
} from "@game/types";

const WIN_SCORE = 1_000_000;

// Squared progression: the last steps before the goal matter much more
// than the first ones, mirroring how a single advancing piece can swing
// the game in the endgame.
const PROGRESS_TABLE = computeProgressTable();

function computeProgressTable(): number[] {
  // Index by `advance` (= rows traveled toward the goal). At advance 4
  // the piece is on the goal — but win detection runs before eval so
  // we shouldn't see that here. Still seed it as a strong value.
  const out: number[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    // 0, 30, 80, 160, 270
    out.push(Math.round(i * i * 10 + i * 20));
  }
  return out;
}

const TILE_VALUE_BLACK = 12;
const TILE_VALUE_GRAY = 30;

const FRONT_PIECE_WEIGHT = 1.4; // multiplier on the most-advanced piece
const NEAR_GOAL_PANIC = 220; // opponent one step from winning is dire

export function evaluate(state: GameState, me: Player): number {
  if (state.winner) {
    return state.winner === me
      ? WIN_SCORE - state.ply
      : -WIN_SCORE + state.ply;
  }
  const opp = opponentOf(me);
  return scoreFor(state, me) - scoreFor(state, opp);
}

function scoreFor(state: GameState, p: Player): number {
  const goal = goalRowOf(p);
  let total = 0;
  let frontAdvance = 0;
  for (const piece of state.pieces) {
    if (piece.owner !== p) continue;
    const advance = BOARD_SIZE - 1 - Math.abs(goal - piece.at[0]);
    total += PROGRESS_TABLE[advance] ?? 0;
    if (advance > frontAdvance) frontAdvance = advance;
  }
  // Front piece counts extra — only one piece needs to score.
  total += Math.round(PROGRESS_TABLE[frontAdvance] * (FRONT_PIECE_WEIGHT - 1));
  // Imminent-win bonus: if any of p's pieces is one step from the goal row
  // (= advance BOARD_SIZE - 2) AND it's p's turn to move, weight it heavily.
  if (frontAdvance === BOARD_SIZE - 2 && state.turn === p) {
    total += NEAR_GOAL_PANIC;
  }
  const inv = state.inventories[p];
  total += inv.black * TILE_VALUE_BLACK + inv.gray * TILE_VALUE_GRAY;
  return total;
}

export const _internals = {
  PROGRESS_TABLE,
  scoreFor,
  WIN_SCORE,
  Piece: null as unknown as Piece,
};
