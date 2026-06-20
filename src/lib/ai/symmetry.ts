import { BOARD_SIZE } from "@game/types";
import type {
  Coord,
  GameState,
  MoveAction,
  Piece,
  Player,
  TileColor,
} from "@game/types";
import { stateKey } from "./search";

/**
 * 4-element symmetry group for Contrast positions:
 *   - identity                 (no change)
 *   - mirror                   (vertical-axis flip: c → 4-c)
 *   - rotswap                  (180° rotation + player swap)
 *   - mirrorrotswap            (horizontal-axis flip + player swap)
 *
 * Each transform is its own inverse (order 2). The rotation+swap pair is
 * a true game-equivalence because flipping who plays from which side
 * doesn't change the rules.
 */
export type Transform = "identity" | "mirror" | "rotswap" | "mirrorrotswap";

const NON_IDENTITY_TRANSFORMS: Transform[] = [
  "mirror",
  "rotswap",
  "mirrorrotswap",
];

export function transformCoord(coord: Coord, t: Transform): Coord {
  const [r, c] = coord;
  switch (t) {
    case "identity":
      return [r, c];
    case "mirror":
      return [r, BOARD_SIZE - 1 - c];
    case "rotswap":
      return [BOARD_SIZE - 1 - r, BOARD_SIZE - 1 - c];
    case "mirrorrotswap":
      return [BOARD_SIZE - 1 - r, c];
  }
}

const SWAPS_PLAYERS: Record<Transform, boolean> = {
  identity: false,
  mirror: false,
  rotswap: true,
  mirrorrotswap: true,
};

function swapPlayer(p: Player): Player {
  return p === 1 ? 2 : 1;
}

export function transformState(state: GameState, t: Transform): GameState {
  if (t === "identity") return state;
  const swap = SWAPS_PLAYERS[t];

  // Board cell at (r, c) in the transformed state comes from the
  // (sr, sc) cell of the original where (sr, sc) = transform((r, c)).
  // Since every transform here is involutive, applying the transform
  // to (r, c) is the same as inverse-applying it.
  const newBoard = state.board.map((_, r) =>
    state.board[0].map((__, c) => {
      const [sr, sc] = transformCoord([r, c], t);
      return state.board[sr][sc];
    }),
  );

  const newPieces: Piece[] = state.pieces.map((p) => ({
    id: p.id,
    at: transformCoord(p.at, t),
    owner: swap ? swapPlayer(p.owner) : p.owner,
  }));

  const newInventories = swap
    ? { 1: state.inventories[2], 2: state.inventories[1] }
    : state.inventories;

  return {
    ...state,
    board: newBoard,
    pieces: newPieces,
    turn: swap ? swapPlayer(state.turn) : state.turn,
    inventories: newInventories,
  };
}

/** Find the symmetry transform that yields the lexicographically
 *  smallest stateKey. That stateKey is the "canonical" identity of the
 *  position, shared by every position in the same orbit. */
export function canonicalize(state: GameState): {
  key: string;
  transform: Transform;
} {
  let bestKey = stateKey(state);
  let bestT: Transform = "identity";
  for (const t of NON_IDENTITY_TRANSFORMS) {
    const k = stateKey(transformState(state, t));
    if (k < bestKey) {
      bestKey = k;
      bestT = t;
    }
  }
  return { key: bestKey, transform: bestT };
}

/**
 * Compact, piece-id-independent move representation: identified by the
 * source square instead of an internal piece id. Survives the canonical
 * transform because the source square translates cleanly.
 */
export interface CompactMove {
  from: Coord;
  to: Coord;
  tilePlace?: { color: TileColor; at: Coord } | null;
}

export function moveToCompact(state: GameState, move: MoveAction): CompactMove {
  const piece = state.pieces[move.pieceId];
  return {
    from: piece.at,
    to: move.to,
    tilePlace: move.tilePlace,
  };
}

export function transformCompactMove(
  move: CompactMove,
  t: Transform,
): CompactMove {
  return {
    from: transformCoord(move.from, t),
    to: transformCoord(move.to, t),
    tilePlace: move.tilePlace
      ? {
          color: move.tilePlace.color,
          at: transformCoord(move.tilePlace.at, t),
        }
      : null,
  };
}

/** Materialise a CompactMove back into a `MoveAction` against the given
 *  state by looking up which actual piece occupies the `from` square. */
export function compactMoveToAction(
  state: GameState,
  compact: CompactMove,
): MoveAction | null {
  const [fr, fc] = compact.from;
  const piece = state.pieces.find((p) => p.at[0] === fr && p.at[1] === fc);
  if (!piece) return null;
  return {
    kind: "move",
    pieceId: piece.id,
    to: compact.to,
    tilePlace: compact.tilePlace ?? null,
  };
}
