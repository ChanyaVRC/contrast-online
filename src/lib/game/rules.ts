import {
  ALL_DIRECTIONS,
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

export function pieceAt(state: GameState, r: number, c: number): Piece | undefined {
  return state.pieces.find((p) => p.at[0] === r && p.at[1] === c);
}

export function findPiece(state: GameState, id: number): Piece | undefined {
  return state.pieces.find((p) => p.id === id);
}

export interface DestOption {
  to: Coord;
  jumpedPieceId?: number;
}

/** Compute legal destination cells (and optional jump) for a single piece. */
export function legalDestinations(state: GameState, piece: Piece): DestOption[] {
  if (state.winner !== null) return [];
  if (piece.owner !== state.turn) return [];

  const [r, c] = piece.at;
  const tile = state.board[r][c];
  const dirs = directionsForTile(tile);
  const out: DestOption[] = [];

  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    const occupant = pieceAt(state, nr, nc);
    if (!occupant) {
      out.push({ to: [nr, nc] });
      continue;
    }
    // Jump only over own piece, land 2 squares further (no chain).
    if (occupant.owner !== piece.owner) continue;
    const lr = r + dr * 2;
    const lc = c + dc * 2;
    if (!inBounds(lr, lc)) continue;
    if (pieceAt(state, lr, lc)) continue;
    out.push({ to: [lr, lc], jumpedPieceId: occupant.id });
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

  const piece = findPiece(state, action.pieceId)!;
  const newPieces = state.pieces.map((p) =>
    p.id === piece.id ? { ...p, at: action.to } : p,
  );

  let newBoard = state.board;
  let newInventories = state.inventories;

  if (action.tilePlace) {
    newBoard = state.board.map((row) => row.slice());
    newBoard[action.tilePlace.at[0]][action.tilePlace.at[1]] = action.tilePlace.color;
    const cur = state.inventories[state.turn];
    const next: typeof cur = { ...cur };
    if (action.tilePlace.color === "black") next.black -= 1;
    else next.gray -= 1;
    newInventories = { ...state.inventories, [state.turn]: next };
  }

  const winner =
    action.to[0] === goalRowOf(state.turn) ? state.turn : state.winner;

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
