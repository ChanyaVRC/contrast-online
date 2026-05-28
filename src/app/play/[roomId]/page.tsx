"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Board } from "@/components/Board";
import { initialState } from "@game/initial";
import type { GameState, MoveAction, Player } from "@game/types";
import type { PlayerSlot, ServerMsg } from "@/lib/net/protocol";
import { ensurePlayerToken, openRoomClient, type RoomClient } from "@/lib/net/client";

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [state, setState] = useState<GameState>(() => initialState(`pending`));
  const [slot, setSlot] = useState<PlayerSlot>("spectator");
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [, setLastEvent] = useState<string | null>(null);
  const clientRef = useRef<RoomClient | null>(null);
  const seqRef = useRef(1);

  useEffect(() => {
    const token = ensurePlayerToken();
    const client = openRoomClient({
      roomId,
      token,
      onStatus: setStatus,
      onMessage: (msg: ServerMsg) => {
        switch (msg.t) {
          case "welcome":
            setSlot(msg.you);
            setState(msg.state);
            return;
          case "state":
            setState(msg.state);
            return;
          case "peer":
            setLastEvent(`相手が ${msg.event === "joined" ? "参加" : msg.event === "left" ? "切断" : "再接続"} (${msg.slot})`);
            return;
          case "end":
            setLastEvent(msg.winner ? `ゲーム終了 — P${msg.winner} の勝利` : "ゲーム終了");
            return;
          case "reject":
            setLastEvent(`手が無効: ${msg.reason}`);
            return;
        }
      },
    });
    clientRef.current = client;
    return () => client.close();
  }, [roomId]);

  const onMove = useCallback(
    (action: MoveAction) => {
      const c = clientRef.current;
      if (!c) return;
      c.send({
        t: "move",
        gameId: state.gameId,
        action,
        clientSeq: seqRef.current++,
      });
    },
    [state.gameId],
  );

  function requestRematch() {
    clientRef.current?.send({ t: "rematch", gameId: state.gameId });
  }

  const me: Player | null = slot === "P1" ? 1 : slot === "P2" ? 2 : null;
  const isMyTurn = me !== null && state.turn === me && state.winner === null;
  const shareUrl = typeof window !== "undefined" ? `${location.origin}/play/${roomId}` : "";

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
      <header className="w-full max-w-md flex items-center justify-between gap-2">
        <Link href="/play/online" className="text-sm text-slate-600 hover:underline">
          ← ロビー
        </Link>
        <span className="font-mono text-sm">{roomId}</span>
        <button
          onClick={() => navigator.clipboard?.writeText(shareUrl)}
          className="text-xs rounded border border-slate-300 px-2 py-1 hover:bg-slate-100"
        >
          URL コピー
        </button>
      </header>

      <div className="w-full max-w-md text-xs text-center text-slate-600 flex justify-between">
        <span>
          あなた: <strong>{slot}</strong>
        </span>
        <span>
          回線:{" "}
          <strong className={status === "open" ? "text-emerald-600" : "text-amber-600"}>
            {status === "open" ? "接続中" : status === "connecting" ? "接続試行中" : "切断"}
          </strong>
        </span>
      </div>

      <Board
        state={state}
        controllable={isMyTurn ? me : null}
        onMove={onMove}
        perspective={me ?? 1}
        hint={
          state.winner
            ? null
            : me === null
              ? "観戦中"
              : isMyTurn
                ? `あなた（${slot}）の番です`
                : `相手の番です`
        }
      />

      {state.winner !== null && (
        <button
          onClick={requestRematch}
          className="rounded bg-sky-600 text-white px-4 py-2 text-sm hover:bg-sky-700"
        >
          もう一度
        </button>
      )}
    </main>
  );
}
