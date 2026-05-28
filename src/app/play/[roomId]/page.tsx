"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Board } from "@/components/Board";
import { initialState } from "@game/initial";
import type { GameState, MoveAction, Player } from "@game/types";
import type { PlayerSlot, Presence, ServerMsg } from "@/lib/net/protocol";
import { ensurePlayerToken, openRoomClient, type RoomClient } from "@/lib/net/client";

const EMPTY_PRESENCE: Presence = { p1: false, p2: false };

export default function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const [state, setState] = useState<GameState>(() => initialState(`pending`));
  const [slot, setSlot] = useState<PlayerSlot>("spectator");
  const [presence, setPresence] = useState<Presence>(EMPTY_PRESENCE);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">(
    "connecting",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
            setPresence(msg.presence);
            return;
          case "state":
            setState(msg.state);
            return;
          case "presence":
            setPresence(msg.presence);
            return;
          case "peer":
            return;
          case "end":
            return;
          case "reject":
            if (msg.reason === "waiting-for-opponent") {
              setNotice("対戦相手がまだ参加していません");
            } else {
              setNotice(`手が無効: ${msg.reason}`);
            }
            setTimeout(() => setNotice(null), 2500);
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
  const bothPresent = presence.p1 && presence.p2;
  const isMyTurn = me !== null && state.turn === me && state.winner === null;
  const canPlay = isMyTurn && bothPresent;

  const shareUrl =
    typeof window !== "undefined" ? `${location.origin}/play/${roomId}` : "";

  async function copyUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center p-4 gap-4 w-full max-w-xl mx-auto pt-6">
      <header className="w-full flex items-center justify-between gap-2">
        <Link
          href="/play/online"
          className="text-sm text-slate-600 hover:underline dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← ロビー
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-semibold tracking-wider bg-white px-3 py-1 rounded-md border border-slate-300 shadow-sm dark:bg-slate-800 dark:border-slate-700">
            {roomId}
          </span>
          <ConnectionDot status={status} />
        </div>
      </header>

      <SlotBar slot={slot} presence={presence} turn={state.turn} />

      {!bothPresent && (
        <WaitingCard
          shareUrl={shareUrl}
          onCopy={copyUrl}
          copied={copied}
          mySlot={slot}
          presence={presence}
        />
      )}

      <div
        className={[
          "w-full",
          !bothPresent ? "opacity-60 pointer-events-none select-none" : "",
        ].join(" ")}
      >
        <Board
          state={state}
          controllable={canPlay ? me : null}
          onMove={onMove}
          perspective={me ?? 1}
          hint={
            state.winner
              ? null
              : !bothPresent
                ? "対戦相手の参加待ち"
                : me === null
                  ? "観戦中"
                  : isMyTurn
                    ? `あなた（${slot}）の番です`
                    : "相手の番です"
          }
        />
      </div>

      {notice && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200">
          {notice}
        </div>
      )}

      {state.winner !== null && bothPresent && (
        <button
          onClick={requestRematch}
          className="rounded-lg bg-sky-600 text-white px-5 py-2.5 font-medium hover:bg-sky-700 shadow"
        >
          もう一度
        </button>
      )}
    </main>
  );
}

function ConnectionDot({
  status,
}: {
  status: "connecting" | "open" | "closed";
}) {
  const color =
    status === "open"
      ? "bg-emerald-500"
      : status === "connecting"
        ? "bg-amber-500 animate-pulse"
        : "bg-rose-500";
  const label =
    status === "open"
      ? "接続中"
      : status === "connecting"
        ? "接続試行中"
        : "切断";
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function SlotBar({
  slot,
  presence,
  turn,
}: {
  slot: PlayerSlot;
  presence: Presence;
  turn: GameState["turn"];
}) {
  return (
    <div className="w-full grid grid-cols-2 gap-2">
      <SlotChip
        label="P1"
        color="sky"
        present={presence.p1}
        mine={slot === "P1"}
        active={turn === 1 && presence.p1 && presence.p2}
      />
      <SlotChip
        label="P2"
        color="rose"
        present={presence.p2}
        mine={slot === "P2"}
        active={turn === 2 && presence.p1 && presence.p2}
      />
    </div>
  );
}

function SlotChip({
  label,
  color,
  present,
  mine,
  active,
}: {
  label: string;
  color: "sky" | "rose";
  present: boolean;
  mine: boolean;
  active: boolean;
}) {
  const tone =
    color === "sky"
      ? present
        ? "bg-sky-100 border-sky-400 text-sky-900 dark:bg-sky-950/60 dark:border-sky-700 dark:text-sky-200"
        : "bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500"
      : present
        ? "bg-rose-100 border-rose-400 text-rose-900 dark:bg-rose-950/60 dark:border-rose-700 dark:text-rose-200"
        : "bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500";
  const ring = active ? "ring-2 ring-amber-400" : "";
  return (
    <div
      className={`flex items-center justify-between rounded-md border-2 px-3 py-2 text-sm font-medium ${tone} ${ring}`}
    >
      <span className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            present
              ? color === "sky"
                ? "bg-sky-500"
                : "bg-rose-500"
              : "bg-slate-400"
          }`}
        />
        <span>{label}</span>
        {mine && (
          <span className="text-[10px] uppercase tracking-wider opacity-70">
            you
          </span>
        )}
      </span>
      <span className="text-xs">
        {present ? (active ? "手番" : "待機") : "未参加"}
      </span>
    </div>
  );
}

function WaitingCard({
  shareUrl,
  onCopy,
  copied,
  mySlot,
  presence,
}: {
  shareUrl: string;
  onCopy: () => void;
  copied: boolean;
  mySlot: PlayerSlot;
  presence: Presence;
}) {
  const waitingFor = !presence.p1
    ? "P1"
    : !presence.p2
      ? "P2"
      : null;
  return (
    <section className="w-full rounded-xl bg-amber-50 border-2 border-amber-300 p-4 shadow-sm dark:bg-amber-950/30 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg animate-pulse">⏳</span>
        <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200">
          対戦相手を待っています
        </h2>
      </div>
      <p className="text-xs text-amber-800 mb-3 dark:text-amber-300/90">
        {mySlot === "spectator"
          ? "ルームは満員ですが、観戦としては入室できます"
          : `あなたは ${mySlot} です。${waitingFor ?? ""} の参加までお待ちください。下の URL を相手にシェアしてください。`}
      </p>
      <div className="font-mono text-[11px] bg-white rounded px-2 py-2 break-all border border-slate-300 mb-2 select-all dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100">
        {shareUrl || "..."}
      </div>
      <button
        onClick={onCopy}
        className={`w-full rounded-md py-2 text-sm font-medium transition ${
          copied
            ? "bg-emerald-600 text-white"
            : "bg-sky-600 text-white hover:bg-sky-700"
        }`}
      >
        {copied ? "✓ コピーしました" : "URL をコピー"}
      </button>
    </section>
  );
}
