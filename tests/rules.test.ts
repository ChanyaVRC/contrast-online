import { describe, expect, it } from "vitest";
import { initialState } from "@game/initial";
import {
  applyAction,
  findPiece,
  legalActions,
  legalDestinations,
  validateAction,
} from "@game/rules";
import {
  BOARD_SIZE,
  GameState,
  PIECES_PER_PLAYER,
  goalRowOf,
} from "@game/types";

function pieceAtCoord(state: GameState, r: number, c: number) {
  return state.pieces.find((p) => p.at[0] === r && p.at[1] === c);
}

describe("initial state", () => {
  it("has 5 pieces per player on their home rows", () => {
    const s = initialState();
    expect(s.pieces.filter((p) => p.owner === 1)).toHaveLength(PIECES_PER_PLAYER);
    expect(s.pieces.filter((p) => p.owner === 2)).toHaveLength(PIECES_PER_PLAYER);
    expect(s.pieces.filter((p) => p.owner === 1).every((p) => p.at[0] === 0)).toBe(true);
    expect(s.pieces.filter((p) => p.owner === 2).every((p) => p.at[0] === BOARD_SIZE - 1)).toBe(true);
  });
  it("player 1 starts and has full tile inventory", () => {
    const s = initialState();
    expect(s.turn).toBe(1);
    expect(s.inventories[1]).toEqual({ black: 3, gray: 1 });
    expect(s.inventories[2]).toEqual({ black: 3, gray: 1 });
  });
});

describe("legal destinations on white cell", () => {
  it("front piece (row 0, col 2) can only step forward — sideways jumps land on own pieces", () => {
    const s = initialState();
    const p = pieceAtCoord(s, 0, 2)!;
    const dests = legalDestinations(s, p).map((d) => d.to);
    // Cardinal: (-1,0) OOB, (1,0) empty ✓, (0,-1) own → jump to (0,0) own ✗, (0,1) own → jump to (0,4) own ✗
    expect(dests).toEqual([[1, 2]]);
  });
});

describe("jump rule", () => {
  it("can jump over own piece to empty cell beyond", () => {
    const s = initialState();
    // P1 piece at (0,2) jumps over own piece at (0,1) to (0,0)? (0,0) is occupied by own piece. No.
    // Construct a clear test: put a P1 piece at (2,2) and another P1 at (2,3); leave (2,4) empty.
    const test: GameState = {
      ...initialState(),
      pieces: [
        { id: 0, owner: 1, at: [2, 2] },
        { id: 1, owner: 1, at: [2, 3] },
        { id: 2, owner: 2, at: [4, 0] },
      ],
      turn: 1,
    };
    const p = findPiece(test, 0)!;
    const dests = legalDestinations(test, p).map((d) => d.to);
    expect(dests).toContainEqual([2, 4]); // jumped over own piece
  });
  it("cannot jump over opponent piece", () => {
    const test: GameState = {
      ...initialState(),
      pieces: [
        { id: 0, owner: 1, at: [2, 2] },
        { id: 1, owner: 2, at: [2, 3] },
      ],
      turn: 1,
    };
    const p = findPiece(test, 0)!;
    const dests = legalDestinations(test, p).map((d) => d.to);
    expect(dests).not.toContainEqual([2, 4]);
    expect(dests).not.toContainEqual([2, 3]);
  });
  it("can chain-jump over multiple consecutive own pieces", () => {
    // P1 moving piece at (0,0); own pieces line the row at (0,1) and (0,2).
    // Should be able to land at (0,3).
    const test: GameState = {
      ...initialState(),
      pieces: [
        { id: 0, owner: 1, at: [0, 0] },
        { id: 1, owner: 1, at: [0, 1] },
        { id: 2, owner: 1, at: [0, 2] },
        { id: 3, owner: 2, at: [4, 4] },
      ],
      turn: 1,
    };
    const p = findPiece(test, 0)!;
    const dests = legalDestinations(test, p);
    const landing = dests.find((d) => d.to[0] === 0 && d.to[1] === 3);
    expect(landing).toBeDefined();
    expect(landing!.jumpedCount).toBe(2);
  });
  it("multi-jump is blocked by an opponent piece in the chain", () => {
    // Own at (0,1), opponent at (0,2). Cannot land at (0,3) since (0,2)
    // blocks the chain.
    const test: GameState = {
      ...initialState(),
      pieces: [
        { id: 0, owner: 1, at: [0, 0] },
        { id: 1, owner: 1, at: [0, 1] },
        { id: 2, owner: 2, at: [0, 2] },
        { id: 3, owner: 2, at: [4, 4] },
      ],
      turn: 1,
    };
    const p = findPiece(test, 0)!;
    const dests = legalDestinations(test, p).map((d) => d.to);
    expect(dests).not.toContainEqual([0, 3]);
    expect(dests).not.toContainEqual([0, 2]);
  });
  it("multi-jump must land on an empty cell — board edge blocks", () => {
    // Two own pieces stretching to the edge: nothing past the second piece.
    const test: GameState = {
      ...initialState(),
      pieces: [
        { id: 0, owner: 1, at: [0, 2] },
        { id: 1, owner: 1, at: [0, 3] },
        { id: 2, owner: 1, at: [0, 4] },
        { id: 3, owner: 2, at: [4, 4] },
      ],
      turn: 1,
    };
    const p = findPiece(test, 0)!;
    const dests = legalDestinations(test, p).map((d) => d.to);
    // Can't land at (0,5) — out of bounds — and (0,3)/(0,4) are occupied
    // by own pieces, so no rightward destination at all.
    expect(dests.filter((d) => d[0] === 0 && d[1] > 2)).toHaveLength(0);
  });
});

describe("tile movement directions", () => {
  it("piece on black tile moves diagonally", () => {
    const s = initialState();
    // Move P1 piece (id 2 at (0,2)) forward to (1,2), then before its next turn put a black tile under it.
    let s2 = applyAction(s, { kind: "move", pieceId: 2, to: [1, 2] });
    // Manually drop a black tile at (1,2) and give P1 next turn.
    s2 = {
      ...s2,
      board: s2.board.map((r, ri) =>
        r.map((c, ci) => (ri === 1 && ci === 2 ? ("black" as const) : c)),
      ),
      turn: 1,
    };
    const p = findPiece(s2, 2)!;
    const dests = legalDestinations(s2, p).map((d) => d.to);
    // Diagonals from (1,2): (0,1) and (0,3) are own pieces (jumps OOB), so only (2,1) and (2,3).
    expect(dests).toEqual(expect.arrayContaining([[2, 1], [2, 3]]));
    expect(dests).not.toContainEqual([2, 2]);
    expect(dests).not.toContainEqual([0, 2]);
  });
  it("piece on gray tile moves all 8 directions", () => {
    const s: GameState = {
      ...initialState(),
      pieces: [{ id: 0, owner: 1, at: [2, 2] }],
      board: initialState().board.map((row, r) =>
        row.map((c, ci) => (r === 2 && ci === 2 ? ("gray" as const) : c)),
      ),
      turn: 1,
    };
    const p = findPiece(s, 0)!;
    const dests = legalDestinations(s, p).map((d) => d.to);
    expect(dests).toHaveLength(8);
  });
});

describe("tile placement", () => {
  it("placing a tile decrements inventory and writes the cell", () => {
    const s = initialState();
    const next = applyAction(s, {
      kind: "move",
      pieceId: 2,
      to: [1, 2],
      tilePlace: { color: "black", at: [2, 2] },
    });
    expect(next.board[2][2]).toBe("black");
    expect(next.inventories[1].black).toBe(2);
  });
  it("cannot place a tile on a cell with a piece", () => {
    const s = initialState();
    const res = validateAction(s, {
      kind: "move",
      pieceId: 2,
      to: [1, 2],
      tilePlace: { color: "black", at: [4, 4] }, // P2 piece is at (4,4)
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("tile-on-piece");
  });
  it("cannot place a tile on the cell the piece is moving onto", () => {
    const s = initialState();
    const res = validateAction(s, {
      kind: "move",
      pieceId: 2,
      to: [1, 2],
      tilePlace: { color: "gray", at: [1, 2] },
    });
    expect(res.ok).toBe(false);
  });
  it("cannot overwrite an existing tile", () => {
    let s = initialState();
    s = {
      ...s,
      board: s.board.map((r, ri) =>
        r.map((c, ci) => (ri === 2 && ci === 2 ? ("black" as const) : c)),
      ),
    };
    const res = validateAction(s, {
      kind: "move",
      pieceId: 2,
      to: [1, 2],
      tilePlace: { color: "gray", at: [2, 2] },
    });
    expect(res.ok).toBe(false);
  });
});

describe("win condition", () => {
  it("P1 reaching row 4 wins; turn does not flip after win", () => {
    const s: GameState = {
      ...initialState(),
      pieces: [
        { id: 0, owner: 1, at: [3, 2] },
        { id: 1, owner: 2, at: [0, 0] },
      ],
      turn: 1,
    };
    const next = applyAction(s, { kind: "move", pieceId: 0, to: [4, 2] });
    expect(next.winner).toBe(1);
    expect(next.turn).toBe(1);
  });
  it("after game over no more actions are legal", () => {
    const s: GameState = { ...initialState(), winner: 1 };
    expect(legalActions(s)).toHaveLength(0);
  });
});

describe("turn ordering", () => {
  it("turn flips to opponent after a non-winning move", () => {
    const s = initialState();
    const next = applyAction(s, { kind: "move", pieceId: 2, to: [1, 2] });
    expect(next.turn).toBe(2);
    expect(next.ply).toBe(1);
  });
  it("opponent cannot move pieces on their off-turn", () => {
    const s = initialState();
    const res = validateAction(s, { kind: "move", pieceId: 5, to: [3, 0] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not-your-piece");
  });
});

describe("goal row helper", () => {
  it("P1 goal is opponent home row (row 4)", () => {
    expect(goalRowOf(1)).toBe(BOARD_SIZE - 1);
    expect(goalRowOf(2)).toBe(0);
  });
});
