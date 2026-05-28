import { describe, expect, it } from "vitest";
import { chooseMove } from "@/lib/ai/search";
import { initialState } from "@game/initial";
import { applyAction } from "@game/rules";
import type { GameState } from "@game/types";

describe("AI search", () => {
  it("plays a move on the opening position within budget", () => {
    const s = initialState();
    const res = chooseMove(s, 1, { timeBudgetMs: 400, maxDepth: 6 });
    expect(res.action).not.toBeNull();
    expect(res.depth).toBeGreaterThanOrEqual(1);
    expect(res.nodes).toBeGreaterThan(0);
  });

  it("takes a one-move forced win", () => {
    // P1 piece is at row 3 col 2; goal row is 4. Step forward = win.
    const s: GameState = {
      ...initialState(),
      pieces: [
        { id: 0, owner: 1, at: [3, 2] },
        { id: 1, owner: 2, at: [0, 0] },
      ],
      turn: 1,
    };
    const res = chooseMove(s, 1, { timeBudgetMs: 500, maxDepth: 6 });
    expect(res.action).not.toBeNull();
    const next = applyAction(s, res.action!);
    expect(next.winner).toBe(1);
  });

  it("blocks an opponent forced win when defending", () => {
    // P2 to move; if AI moves nothing useful, P1's piece at row 3 col 2
    // would step to row 4 next turn. The AI plays P2 and should pick a
    // move whose resulting position does NOT immediately lose to P1.
    const s: GameState = {
      ...initialState(),
      pieces: [
        { id: 0, owner: 1, at: [3, 2] },
        { id: 1, owner: 2, at: [4, 2] }, // blocker, but P1 can step around
        { id: 2, owner: 2, at: [4, 0] },
        { id: 3, owner: 2, at: [4, 1] },
        { id: 4, owner: 2, at: [4, 3] },
        { id: 5, owner: 2, at: [4, 4] },
      ],
      turn: 2,
    };
    const res = chooseMove(s, 2, { timeBudgetMs: 1000, maxDepth: 6 });
    expect(res.action).not.toBeNull();
    // The chosen move's evaluation should not be catastrophic.
    expect(res.score).toBeGreaterThan(-500_000);
  });

  it("prefers advancing when nothing tactical is on the line", () => {
    const s = initialState();
    const res = chooseMove(s, 1, { timeBudgetMs: 700, maxDepth: 6 });
    expect(res.action).not.toBeNull();
    const next = applyAction(s, res.action!);
    // Some piece of P1 should have advanced (row index increased from 0).
    const advanced = next.pieces.some(
      (p) => p.owner === 1 && p.at[0] > 0,
    );
    expect(advanced).toBe(true);
  });
});
