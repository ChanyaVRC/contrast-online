"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Board } from "@/components/Board";
import { initialState } from "@game/initial";
import { applyAction } from "@game/rules";
import type { GameState, MoveAction, Player } from "@game/types";
import { AiCoordinator } from "@/lib/ai/coordinator";

export default function AiPlayPage() {
  const [state, setState] = useState<GameState>(() => initialState("ai-1"));
  const [humanPlayer] = useState<Player>(1);
  const [thinking, setThinking] = useState(false);
  const [stats, setStats] = useState<{
    depth: number;
    nodes: number;
    fromBook: boolean;
    workerCount: number;
  } | null>(null);
  const coordRef = useRef<AiCoordinator | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const coord = new AiCoordinator();
    coordRef.current = coord;
    return () => {
      coord.destroy();
      coordRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (state.winner !== null) return;
    if (state.turn === humanPlayer) return;
    const coord = coordRef.current;
    if (!coord) return;
    setThinking(true);
    const myReq = ++seqRef.current;
    (async () => {
      const res = await coord.search(state, state.turn, {
        timeBudgetMs: 1500,
        maxDepth: 10,
      });
      // Ignore stale responses if the player has moved meanwhile.
      if (myReq !== seqRef.current) return;
      setThinking(false);
      setStats({
        depth: res.depth,
        nodes: res.nodes,
        fromBook: res.fromBook,
        workerCount: res.workerCount,
      });
      if (res.action) {
        setState((s) => applyAction(s, res.action!));
      }
    })();
  }, [state, humanPlayer]);

  function onMove(action: MoveAction) {
    if (state.turn !== humanPlayer) return;
    setState((s) => applyAction(s, action));
  }

  function reset() {
    setState(initialState(`ai-${Date.now()}`));
    setStats(null);
  }

  return (
    <main className="flex-1 flex flex-col items-center p-4 gap-4 pt-6">
      <header className="w-full max-w-md flex items-center justify-between">
        <Link href="/" className="text-sm text-slate-600 hover:underline dark:text-slate-400 dark:hover:text-slate-100">
          ← トップ
        </Link>
        <h1 className="font-semibold">AI 対戦</h1>
        <button
          onClick={reset}
          className="text-sm rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          リセット
        </button>
      </header>
      <Board
        state={state}
        controllable={state.turn === humanPlayer ? humanPlayer : null}
        onMove={onMove}
        perspective={humanPlayer}
        hint={
          state.winner
            ? null
            : state.turn === humanPlayer
              ? "あなた（P1）の番です"
              : thinking
                ? "CPU 思考中…"
                : "CPU の番"
        }
      />
      {stats && (
        <p className="text-[10px] text-slate-500 dark:text-slate-500">
          {stats.fromBook
            ? "CPU 最終手: 定跡から"
            : `CPU 最終手: depth=${stats.depth} nodes=${stats.nodes.toLocaleString()} (workers=${stats.workerCount})`}
        </p>
      )}
    </main>
  );
}
