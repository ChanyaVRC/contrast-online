import { BOARD_SIZE, GameState, Player, goalRowOf, opponentOf } from "@game/types";

const PIECE_PROGRESS = 30; // per row toward goal
const FRONT_PIECE_BONUS = 25; // additional weight on most-advanced piece
const TILE_VALUE = 18; // value of an unspent tile
const WIN_SCORE = 100_000;

export function evaluate(state: GameState, me: Player): number {
  if (state.winner) {
    return state.winner === me ? WIN_SCORE - state.ply : -WIN_SCORE + state.ply;
  }
  const opp = opponentOf(me);
  return scoreFor(state, me) - scoreFor(state, opp);
}

function scoreFor(state: GameState, p: Player): number {
  const goal = goalRowOf(p);
  let progress = 0;
  let frontDistance = BOARD_SIZE; // smaller is better
  for (const piece of state.pieces) {
    if (piece.owner !== p) continue;
    const dist = Math.abs(goal - piece.at[0]);
    const advance = BOARD_SIZE - 1 - dist;
    progress += advance * PIECE_PROGRESS;
    if (dist < frontDistance) frontDistance = dist;
  }
  const front = (BOARD_SIZE - 1 - frontDistance) * FRONT_PIECE_BONUS;
  const inv = state.inventories[p];
  const tiles = (inv.black + inv.gray) * TILE_VALUE;
  return progress + front + tiles;
}
