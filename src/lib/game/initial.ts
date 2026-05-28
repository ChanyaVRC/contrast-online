import {
  BLACK_TILES_PER_PLAYER,
  BOARD_SIZE,
  CellTile,
  GameState,
  GRAY_TILES_PER_PLAYER,
  Piece,
  PIECES_PER_PLAYER,
  homeRowOf,
} from "./types";

export function emptyBoard(): CellTile[][] {
  const board: CellTile[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: CellTile[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) row.push(null);
    board.push(row);
  }
  return board;
}

export function initialPieces(): Piece[] {
  const pieces: Piece[] = [];
  let id = 0;
  for (let c = 0; c < PIECES_PER_PLAYER; c++) {
    pieces.push({ id: id++, owner: 1, at: [homeRowOf(1), c] });
  }
  for (let c = 0; c < PIECES_PER_PLAYER; c++) {
    pieces.push({ id: id++, owner: 2, at: [homeRowOf(2), c] });
  }
  return pieces;
}

export function initialState(gameId = "g1"): GameState {
  return {
    board: emptyBoard(),
    pieces: initialPieces(),
    turn: 1,
    inventories: {
      1: { black: BLACK_TILES_PER_PLAYER, gray: GRAY_TILES_PER_PLAYER },
      2: { black: BLACK_TILES_PER_PLAYER, gray: GRAY_TILES_PER_PLAYER },
    },
    winner: null,
    gameId,
    ply: 0,
  };
}
