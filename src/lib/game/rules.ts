import {
  ALL_DIRECTIONS,
  BOARD_SIZE,
  CARDINAL,
  Coord,
  DIAGONAL,
  Direction,
  GameState,
  MoveAction,
  Piece,
  Player,
  TileColor,
  coordEq,
  directionsForTile,
  goalRowOf,
  inBounds,
  opponentOf,
} from "./types";

/** A precomputed 5×5 lookup of `(r, c) → piece | undefined`. */
export type PieceGrid = (Piece | undefined)[][];

/** Build a grid for O(1) `pieceAt`-style lookups. Linear in piece count. */
export function buildPieceGrid(state: GameState): PieceGrid {
  const grid: PieceGrid = new Array(BOARD_SIZE);
  for (let r = 0; r < BOARD_SIZE; r++) grid[r] = new Array(BOARD_SIZE);
  for (const p of state.pieces) grid[p.at[0]][p.at[1]] = p;
  return grid;
}

export function pieceAt(state: GameState, r: number, c: number): Piece | undefined {
  return state.pieces.find((p) => p.at[0] === r && p.at[1] === c);
}

/** Pieces are stored in id order (initialPieces emits 0..9 in order and
 *  every applyAction preserves the array order), so this is O(1). */
export function findPiece(state: GameState, id: number): Piece | undefined {
  return state.pieces[id];
}

export interface DestOption {
  to: Coord;
  /** Number of own pieces leaped over to reach `to` (0 = ordinary step). */
  jumpedCount?: number;
}

/** Compute legal destination cells for a single piece, including chained
 *  jumps over consecutive own pieces. Opponent pieces always block.
 *  Pass a prebuilt `grid` when calling repeatedly for the same state to
 *  amortise the piece-position lookup.
 */
export function legalDestinations(
  state: GameState,
  piece: Piece,
  grid?: PieceGrid,
): DestOption[] {
  if (state.winner !== null) return [];
  if (piece.owner !== state.turn) return [];

  const g = grid ?? buildPieceGrid(state);
  const [r, c] = piece.at;
  const tile = state.board[r][c];
  const dirs = directionsForTile(tile);
  const out: DestOption[] = [];

  for (let i = 0; i < dirs.length; i++) {
    const dr = dirs[i][0];
    const dc = dirs[i][1];
    // Adjacent step: empty cell = normal move; opponent blocks; own piece
    // starts a (possibly multi-step) jump.
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
    const adjacent = g[nr][nc];
    if (!adjacent) {
      out.push({ to: [nr, nc] });
      continue;
    }
    if (adjacent.owner !== piece.owner) continue;

    // Walk past consecutive own pieces in the same direction; the first
    // empty cell beyond them is the landing spot. An opponent piece or
    // the board edge blocks the jump.
    let jumped = 1;
    for (let step = 2; ; step++) {
      const cr = r + dr * step;
      const cc = c + dc * step;
      if (cr < 0 || cr >= BOARD_SIZE || cc < 0 || cc >= BOARD_SIZE) break;
      const cell = g[cr][cc];
      if (!cell) {
        out.push({ to: [cr, cc], jumpedCount: jumped });
        break;
      }
      if (cell.owner !== piece.owner) break;
      jumped++;
    }
  }
  return out;
}

export interface ValidationFailure {
  ok: false;
  reason: string;
}
export interface ValidationSuccess {
  ok: true;
}
export type ValidationResult = ValidationSuccess | ValidationFailure;

function fail(reason: string): ValidationFailure {
  return { ok: false, reason };
}

export function validateAction(state: GameState, action: MoveAction): ValidationResult {
  if (state.winner !== null) return fail("game-over");
  const piece = findPiece(state, action.pieceId);
  if (!piece) return fail("no-such-piece");
  if (piece.owner !== state.turn) return fail("not-your-piece");

  const dests = legalDestinations(state, piece);
  const match = dests.find((d) => coordEq(d.to, action.to));
  if (!match) return fail("illegal-move");

  if (action.tilePlace) {
    const { color, at } = action.tilePlace;
    const [tr, tc] = at;
    if (!inBounds(tr, tc)) return fail("tile-out-of-bounds");
    if (state.board[tr][tc] !== null) return fail("tile-cell-occupied");

    // The piece will be at `action.to` after the move — disallow placing under it.
    if (coordEq([tr, tc], action.to)) return fail("tile-on-piece");

    // Any other piece sitting on that cell — disallow.
    if (state.pieces.some((p) => p.id !== piece.id && coordEq(p.at, [tr, tc]))) {
      return fail("tile-on-piece");
    }

    const inv = state.inventories[state.turn];
    if (color === "black" && inv.black <= 0) return fail("no-black-tile");
    if (color === "gray" && inv.gray <= 0) return fail("no-gray-tile");
  }

  return { ok: true };
}

export function applyAction(state: GameState, action: MoveAction): GameState {
  const v = validateAction(state, action);
  if (!v.ok) throw new Error(`invalid move: ${v.reason}`);
  return applyActionUnchecked(state, action);
}

/** Trusted-caller variant: skip `validateAction`. Use only when the
 *  action is known legal (e.g. produced by `generateActions` in the AI). */
export function applyActionUnchecked(
  state: GameState,
  action: MoveAction,
): GameState {
  const piece = state.pieces[action.pieceId];
  const newPieces = state.pieces.slice();
  newPieces[action.pieceId] = { ...piece, at: action.to };

  let newBoard = state.board;
  let newInventories = state.inventories;

  const tilePlace = action.tilePlace;
  if (tilePlace) {
    newBoard = state.board.slice();
    const tr = tilePlace.at[0];
    newBoard[tr] = newBoard[tr].slice();
    newBoard[tr][tilePlace.at[1]] = tilePlace.color;
    const cur = state.inventories[state.turn];
    const next: typeof cur = { black: cur.black, gray: cur.gray };
    if (tilePlace.color === "black") next.black -= 1;
    else next.gray -= 1;
    newInventories =
      state.turn === 1
        ? { 1: next, 2: state.inventories[2] }
        : { 1: state.inventories[1], 2: next };
  }

  const goal = goalRowOf(state.turn);
  const winner = action.to[0] === goal ? state.turn : state.winner;

  return {
    ...state,
    board: newBoard,
    pieces: newPieces,
    inventories: newInventories,
    turn: winner ? state.turn : opponentOf(state.turn),
    winner,
    ply: state.ply + 1,
  };
}

/** Enumerate every legal (move, optional tile placement) pair for current player. */
export function legalActions(state: GameState): MoveAction[] {
  if (state.winner !== null) return [];
  const actions: MoveAction[] = [];
  const myPieces = state.pieces.filter((p) => p.owner === state.turn);
  const inv = state.inventories[state.turn];

  for (const piece of myPieces) {
    for (const dest of legalDestinations(state, piece)) {
      const base: MoveAction = { kind: "move", pieceId: piece.id, to: dest.to };
      actions.push({ ...base, tilePlace: null });
      // Tile placements: every empty non-piece cell that isn't where the piece is moving to.
      if (inv.black > 0 || inv.gray > 0) {
        for (let r = 0; r < state.board.length; r++) {
          for (let c = 0; c < state.board[r].length; c++) {
            if (state.board[r][c] !== null) continue;
            if (coordEq([r, c], dest.to)) continue;
            const occupied = state.pieces.some(
              (p) => p.id !== piece.id && coordEq(p.at, [r, c]),
            );
            if (occupied) continue;
            if (inv.black > 0) {
              actions.push({ ...base, tilePlace: { color: "black", at: [r, c] } });
            }
            if (inv.gray > 0) {
              actions.push({ ...base, tilePlace: { color: "gray", at: [r, c] } });
            }
          }
        }
      }
    }
  }
  return actions;
}

export const _internals = { CARDINAL, DIAGONAL, ALL_DIRECTIONS } as const;
export type { Direction, Player, TileColor };
