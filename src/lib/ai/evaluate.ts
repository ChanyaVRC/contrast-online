import {
  BOARD_SIZE,
  GameState,
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

  // Single pass over pieces: accumulate progress + frontmost advance for
  // each side simultaneously. Cheaper than two filtered passes.
  const meGoal = goalRowOf(me);
  const oppGoal = goalRowOf(opp);
  let meProgress = 0;
  let oppProgress = 0;
  let meFront = 0;
  let oppFront = 0;
  const pieces = state.pieces;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const r = piece.at[0];
    if (piece.owner === me) {
      const advance = BOARD_SIZE - 1 - Math.abs(meGoal - r);
      meProgress += PROGRESS_TABLE[advance];
      if (advance > meFront) meFront = advance;
    } else {
      const advance = BOARD_SIZE - 1 - Math.abs(oppGoal - r);
      oppProgress += PROGRESS_TABLE[advance];
      if (advance > oppFront) oppFront = advance;
    }
  }
  meProgress += Math.round(PROGRESS_TABLE[meFront] * (FRONT_PIECE_WEIGHT - 1));
  oppProgress += Math.round(PROGRESS_TABLE[oppFront] * (FRONT_PIECE_WEIGHT - 1));

  if (meFront === BOARD_SIZE - 2 && state.turn === me) {
    meProgress += NEAR_GOAL_PANIC;
  }
  if (oppFront === BOARD_SIZE - 2 && state.turn === opp) {
    oppProgress += NEAR_GOAL_PANIC;
  }

  const meInv = state.inventories[me];
  const oppInv = state.inventories[opp];
  meProgress += meInv.black * TILE_VALUE_BLACK + meInv.gray * TILE_VALUE_GRAY;
  oppProgress += oppInv.black * TILE_VALUE_BLACK + oppInv.gray * TILE_VALUE_GRAY;

  return meProgress - oppProgress;
}

export const _internals = { PROGRESS_TABLE, WIN_SCORE };
