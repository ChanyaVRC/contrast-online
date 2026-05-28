import type { Coord, GameState, MoveAction, TileColor } from "./types";
import { legalDestinations, pieceAt, validateAction } from "./rules";
import { coordEq, inBounds } from "./types";

/**
 * UI-facing selection state machine:
 *  - no selection: clicking own piece selects it
 *  - piece selected: clicking a legal destination commits a move; clicking another own piece reselects
 *  - after picking a destination, the user can either: confirm with no tile, or pick a tile to place
 */

export type Phase =
  | { kind: "idle" }
  | { kind: "piece-selected"; pieceId: number; destinations: Coord[] }
  | {
      kind: "destination-chosen";
      pieceId: number;
      to: Coord;
      tile: TileColor | null;
      tileAt: Coord | null;
    };

export function startSelection(): Phase {
  return { kind: "idle" };
}

export function clickCell(
  state: GameState,
  phase: Phase,
  cell: Coord,
  myPlayer: GameState["turn"] | null,
  tileColor: TileColor | null,
): { phase: Phase; submit?: MoveAction } {
  // Only let the active player drive selection. For local hot-seat, `myPlayer` may be the current turn.
  const piece = pieceAt(state, cell[0], cell[1]);
  const isMyPiece = piece && myPlayer && piece.owner === myPlayer && state.turn === myPlayer;

  if (phase.kind === "idle") {
    if (isMyPiece) {
      const dests = legalDestinations(state, piece!).map((d) => d.to);
      return { phase: { kind: "piece-selected", pieceId: piece!.id, destinations: dests } };
    }
    return { phase };
  }

  if (phase.kind === "piece-selected") {
    if (isMyPiece) {
      const dests = legalDestinations(state, piece!).map((d) => d.to);
      return { phase: { kind: "piece-selected", pieceId: piece!.id, destinations: dests } };
    }
    const isLegal = phase.destinations.some((d) => coordEq(d, cell));
    if (!isLegal) return { phase: { kind: "idle" } };
    const next: Phase = {
      kind: "destination-chosen",
      pieceId: phase.pieceId,
      to: cell,
      tile: tileColor,
      tileAt: null,
    };
    return tryAutoSubmit(state, next);
  }

  // destination-chosen: clicking a cell either places a tile or commits no-tile.
  if (phase.kind === "destination-chosen") {
    if (tileColor !== null) {
      // Place tile on clicked cell if legal.
      if (!isTileTargetLegal(state, phase.pieceId, phase.to, cell)) {
        return { phase };
      }
      const action: MoveAction = {
        kind: "move",
        pieceId: phase.pieceId,
        to: phase.to,
        tilePlace: { color: tileColor, at: cell },
      };
      if (validateAction(state, action).ok) {
        return { phase: { kind: "idle" }, submit: action };
      }
      return { phase };
    }
    // No tile selected: clicking same destination commits; clicking own piece reselects; else cancel.
    if (coordEq(cell, phase.to)) {
      const action: MoveAction = {
        kind: "move",
        pieceId: phase.pieceId,
        to: phase.to,
        tilePlace: null,
      };
      return { phase: { kind: "idle" }, submit: action };
    }
    if (isMyPiece) {
      const dests = legalDestinations(state, piece!).map((d) => d.to);
      return { phase: { kind: "piece-selected", pieceId: piece!.id, destinations: dests } };
    }
    return { phase: { kind: "idle" } };
  }

  return { phase };
}

function tryAutoSubmit(_state: GameState, phase: Phase): { phase: Phase; submit?: MoveAction } {
  // Keep the destination-chosen phase so the player can opt to place a tile.
  return { phase };
}

export function isTileTargetLegal(
  state: GameState,
  movingPieceId: number,
  movingTo: Coord,
  cell: Coord,
): boolean {
  if (!inBounds(cell[0], cell[1])) return false;
  if (state.board[cell[0]][cell[1]] !== null) return false;
  if (coordEq(cell, movingTo)) return false;
  return !state.pieces.some(
    (p) => p.id !== movingPieceId && coordEq(p.at, cell),
  );
}

export function pendingAction(phase: Phase, tile: TileColor | null): MoveAction | null {
  if (phase.kind !== "destination-chosen") return null;
  if (tile === null) {
    return { kind: "move", pieceId: phase.pieceId, to: phase.to, tilePlace: null };
  }
  return null;
}
