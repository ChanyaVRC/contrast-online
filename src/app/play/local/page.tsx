"use client";

import { useState } from "react";
import Link from "next/link";
import { Board } from "@/components/Board";
import { initialState } from "@game/initial";
import { applyAction } from "@game/rules";
import type { GameState, MoveAction } from "@game/types";

export default function LocalPlayPage() {
  const [state, setState] = useState<GameState>(() => initialState("local-1"));

  function onMove(action: MoveAction) {
    setState((s) => applyAction(s, action));
  }

  function reset() {
    setState(initialState(`local-${Date.now()}`));
  }

  return (
    <main className="flex-1 flex flex-col items-center p-4 gap-4 pt-6">
      <header className="w-full max-w-md flex items-center justify-between">
        <Link href="/" className="text-sm text-slate-600 hover:underline dark:text-slate-400 dark:hover:text-slate-100">
          ← トップ
        </Link>
        <h1 className="font-semibold">ローカル 2 人対戦</h1>
        <button
          onClick={reset}
          className="text-sm rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          リセット
        </button>
      </header>
      <Board
        state={state}
        controllable={state.turn}
        onMove={onMove}
      />
    </main>
  );
}
