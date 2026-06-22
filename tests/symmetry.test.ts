import { describe, expect, it } from "vitest";
import {
  canonicalize,
  compactMoveToAction,
  moveToCompact,
  packCompactMove,
  transformCompactMove,
  transformCoord,
  transformState,
  unpackCompactMove,
  type Transform,
} from "@/lib/ai/symmetry";
import { stateKey } from "@/lib/ai/search";
import { initialState } from "@game/initial";
import type { GameState } from "@game/types";

const T_ALL: Transform[] = ["identity", "mirror", "rotswap", "mirrorrotswap"];

describe("symmetry transforms", () => {
  it("are self-inverse on coords", () => {
    for (const t of T_ALL) {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const once = transformCoord([r, c], t);
          const twice = transformCoord(once, t);
          expect(twice).toEqual([r, c]);
        }
      }
    }
  });

  it("are self-inverse on full state", () => {
    const s = initialState();
    for (const t of T_ALL) {
      const once = transformState(s, t);
      const twice = transformState(once, t);
      expect(stateKey(twice)).toEqual(stateKey(s));
    }
  });

  it("canonicalize is idempotent (applying the picked transform yields the canonical key)", () => {
    const s = initialState();
    // Construct a clearly asymmetric position by hand.
    const asym: GameState = {
      ...s,
      pieces: [
        { id: 0, owner: 1, at: [2, 1] },
        { id: 1, owner: 2, at: [3, 4] },
      ],
      turn: 1,
    };
    const { key, transform } = canonicalize(asym);
    expect(stateKey(transformState(asym, transform))).toEqual(key);
    // All four orbit members canonicalize to the same key.
    for (const t of T_ALL) {
      const variant = transformState(asym, t);
      expect(canonicalize(variant).key).toEqual(key);
    }
  });

  it("compact move round-trip matches the original action", () => {
    const s = initialState();
    const action = {
      kind: "move" as const,
      pieceId: 2,
      to: [1, 2] as [number, number],
      tilePlace: null,
    };
    const compact = moveToCompact(s, action);
    const back = compactMoveToAction(s, compact);
    expect(back?.pieceId).toBe(action.pieceId);
    expect(back?.to).toEqual(action.to);
  });

  it("packCompactMove round-trips losslessly for both shapes", () => {
    const noTile = {
      from: [0, 2] as [number, number],
      to: [1, 2] as [number, number],
      tilePlace: null,
    };
    const withTile = {
      from: [3, 1] as [number, number],
      to: [4, 1] as [number, number],
      tilePlace: { color: "gray" as const, at: [2, 2] as [number, number] },
    };
    for (const move of [noTile, withTile]) {
      const packed = packCompactMove(move);
      const back = unpackCompactMove(packed);
      expect(back.from).toEqual(move.from);
      expect(back.to).toEqual(move.to);
      expect(back.tilePlace).toEqual(move.tilePlace);
    }
  });

  it("transformCompactMove round-trips through a non-identity transform", () => {
    const s = initialState();
    const action = {
      kind: "move" as const,
      pieceId: 2,
      to: [1, 2] as [number, number],
      tilePlace: { color: "black" as const, at: [2, 2] as [number, number] },
    };
    const compact = moveToCompact(s, action);
    for (const t of T_ALL) {
      const transformed = transformCompactMove(compact, t);
      const restored = transformCompactMove(transformed, t);
      expect(restored.from).toEqual(compact.from);
      expect(restored.to).toEqual(compact.to);
      expect(restored.tilePlace?.at).toEqual(compact.tilePlace?.at);
    }
  });
});
