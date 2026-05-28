export const BOARD_SIZE = 5;
export const PIECES_PER_PLAYER = 5;
export const BLACK_TILES_PER_PLAYER = 3;
export const GRAY_TILES_PER_PLAYER = 1;

export type Player = 1 | 2;
export type TileColor = "black" | "gray";
export type CellTile = TileColor | null;

export type Coord = readonly [row: number, col: number];

export interface Piece {
  readonly id: number;
  readonly owner: Player;
  readonly at: Coord;
}

export interface TileInventory {
  black: number;
  gray: number;
}

export type MoveAction =
  | { kind: "move"; pieceId: number; to: Coord; tilePlace?: { color: TileColor; at: Coord } | null };

export interface GameState {
  /** row-major grid of placed tiles (null = bare white cell) */
  board: CellTile[][];
  pieces: Piece[];
  turn: Player;
  inventories: { 1: TileInventory; 2: TileInventory };
  winner: Player | null;
  /** Bumped by host on rematch so stale messages are rejected. */
  gameId: string;
  /** Monotonic ply counter (one per applied move). */
  ply: number;
}

export type Direction = readonly [dr: number, dc: number];

export const CARDINAL: readonly Direction[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

export const DIAGONAL: readonly Direction[] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export const ALL_DIRECTIONS: readonly Direction[] = [...CARDINAL, ...DIAGONAL];

export function directionsForTile(tile: CellTile): readonly Direction[] {
  if (tile === null) return CARDINAL;
  if (tile === "black") return DIAGONAL;
  return ALL_DIRECTIONS;
}

export function opponentOf(p: Player): Player {
  return p === 1 ? 2 : 1;
}

export function homeRowOf(p: Player): number {
  return p === 1 ? 0 : BOARD_SIZE - 1;
}

/** The row the given player is trying to reach to win. */
export function goalRowOf(p: Player): number {
  return homeRowOf(opponentOf(p));
}

export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

export function coordEq(a: Coord, b: Coord): boolean {
  return a[0] === b[0] && a[1] === b[1];
}
