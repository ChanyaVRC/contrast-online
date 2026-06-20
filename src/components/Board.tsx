"use client";

import { useMemo, useState } from "react";
import { Cell } from "./Cell";
import { Piece } from "./Piece";
import { TileTray } from "./TileTray";
import type { Coord, GameState, MoveAction, Player, TileColor } from "@game/types";
import { coordEq } from "@game/types";
import { clickCell, isTileTargetLegal, Phase, startSelection } from "@/lib/game/selection";

interface BoardProps {
  state: GameState;
  /** Player whose turn UI should accept input from (null = view-only). */
  controllable: Player | null;
  onMove: (action: MoveAction) => void;
  perspective?: Player;
  hint?: string | null;
}

export function Board({
  state,
  controllable,
  onMove,
  perspective = 1,
  hint,
}: BoardProps) {
  const [phase, setPhase] = useState<Phase>(startSelection);
  const [tile, setTile] = useState<TileColor | null>(null);

  // P1's home row is engine row 0; we want each player's own home row at
  // the bottom of their screen. Reverse rows for P1 (so row 4 is on top),
  // keep natural order for P2 (whose home is already row 4 = bottom).
  const rows = useMemo(() => {
    const r = state.board.map((row, ri) => ({ ri, cells: row }));
    return perspective === 1 ? [...r].reverse() : r;
  }, [state.board, perspective]);

  function handleCellClick(coord: Coord) {
    const result = clickCell(state, phase, coord, controllable, tile);
    setPhase(result.phase);
    if (result.submit) {
      onMove(result.submit);
      setPhase(startSelection());
      setTile(null);
    }
  }

  function commitWithoutTile() {
    if (phase.kind !== "destination-chosen") return;
    onMove({ kind: "move", pieceId: phase.pieceId, to: phase.to, tilePlace: null });
    setPhase(startSelection());
    setTile(null);
  }

  function cancelSelection() {
    setPhase(startSelection());
    setTile(null);
  }

  const destinations: Coord[] =
    phase.kind === "piece-selected" ? phase.destinations : [];

  // Each viewer sees their own tray at the bottom-right (near their
  // pieces) and the opponent's at the top-left, mirroring the row-order
  // flip applied to the board itself.
  const topPlayer: Player = perspective === 1 ? 2 : 1;
  const bottomPlayer: Player = perspective;
  const trayActiveFor = (p: Player) =>
    state.turn === p && controllable === p && state.winner === null;

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-3">
      <TurnBanner state={state} controllable={controllable} hint={hint} />

      <div className="flex items-stretch justify-center gap-2">
        {/* Opponent's tray — top-left of the row */}
        <div className="self-start">
          <TileTray
            player={topPlayer}
            orientation="vertical"
            inventory={state.inventories[topPlayer]}
            active={trayActiveFor(topPlayer)}
            selected={trayActiveFor(topPlayer) ? tile : null}
            onSelect={trayActiveFor(topPlayer) ? setTile : noop}
          />
        </div>

        <div className="aspect-square w-full max-w-md grid grid-cols-5 gap-[2px] rounded bg-slate-300 p-[2px] shadow-md dark:bg-slate-700">
        {rows.map(({ ri, cells }) =>
          cells.map((cellTile, ci) => {
            const coord: Coord = [ri, ci];
            const piece = state.pieces.find((p) => coordEq(p.at, coord));
            const isDest = destinations.some((d) => coordEq(d, coord));
            const showTileTarget =
              phase.kind === "destination-chosen" &&
              tile !== null &&
              isTileTargetLegal(state, phase.pieceId, phase.to, coord);
            const isPendingMoveTarget =
              phase.kind === "destination-chosen" && coordEq(phase.to, coord);

            return (
              <Cell
                key={`${ri}-${ci}`}
                tile={cellTile}
                isDestination={isDest || isPendingMoveTarget}
                isTileTarget={showTileTarget}
                onClick={() => handleCellClick(coord)}
              >
                {piece && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Piece
                      owner={piece.owner}
                      tile={cellTile}
                      selected={
                        (phase.kind === "piece-selected" && phase.pieceId === piece.id) ||
                        (phase.kind === "destination-chosen" && phase.pieceId === piece.id)
                      }
                      movable={controllable === piece.owner && piece.owner === state.turn}
                      flip={piece.owner !== perspective}
                    />
                  </div>
                )}
                {/* When pending-move destination, show a ghost piece preview */}
                {!piece && phase.kind === "destination-chosen" && coordEq(phase.to, coord) && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-60">
                    <Piece
                      owner={state.turn}
                      tile={cellTile}
                      selected
                      movable={false}
                      flip={state.turn !== perspective}
                    />
                  </div>
                )}
              </Cell>
            );
          }),
        )}
        </div>

        {/* Viewer's own tray — bottom-right of the row */}
        <div className="self-end">
          <TileTray
            player={bottomPlayer}
            orientation="vertical"
            inventory={state.inventories[bottomPlayer]}
            active={trayActiveFor(bottomPlayer)}
            selected={trayActiveFor(bottomPlayer) ? tile : null}
            onSelect={trayActiveFor(bottomPlayer) ? setTile : noop}
          />
        </div>
      </div>

      <ActionBar
        phase={phase}
        tile={tile}
        onCommit={commitWithoutTile}
        onCancel={cancelSelection}
      />
    </div>
  );
}

function noop() {}

function TurnBanner({
  state,
  controllable,
  hint,
}: {
  state: GameState;
  controllable: Player | null;
  hint?: string | null;
}) {
  if (state.winner) {
    return (
      <div className="rounded bg-emerald-100 px-3 py-2 text-sm text-emerald-900 text-center font-medium dark:bg-emerald-950/60 dark:text-emerald-200">
        🏆 P{state.winner} の勝利！
      </div>
    );
  }
  const me = controllable;
  const isMe = me !== null && me === state.turn;
  return (
    <div
      className={[
        "rounded px-3 py-2 text-sm text-center font-medium",
        isMe
          ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      ].join(" ")}
    >
      {hint ?? (isMe ? `あなた（P${me}）の番です` : `P${state.turn} の番`)}
    </div>
  );
}

function ActionBar({
  phase,
  tile,
  onCommit,
  onCancel,
}: {
  phase: Phase;
  tile: TileColor | null;
  onCommit: () => void;
  onCancel: () => void;
}) {
  // Reserved height so phase transitions (idle / piece-selected /
  // destination-chosen) don't push the board up or down.
  const wrapper =
    "min-h-[40px] flex items-center justify-between gap-2 text-xs";

  if (phase.kind === "idle") {
    return (
      <div className={wrapper}>
        <p className="text-slate-500 text-center w-full dark:text-slate-400">
          コマをクリック →
          移動先をクリック →
          必要ならタイルを選んで設置マスをクリック
        </p>
      </div>
    );
  }
  if (phase.kind === "piece-selected") {
    return (
      <div className={wrapper}>
        <span className="text-slate-600 dark:text-slate-300">移動先を選んでください</span>
        <button
          onClick={onCancel}
          className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          キャンセル
        </button>
      </div>
    );
  }
  return (
    <div className={wrapper}>
      <span className="text-slate-600 dark:text-slate-300">
        {tile
          ? `タイル(${tile === "black" ? "黒" : "灰"})を置くマスをクリック`
          : "確定: タイルを置かず次のプレイヤーへ"}
      </span>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          キャンセル
        </button>
        {!tile && (
          <button
            onClick={onCommit}
            className="rounded bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700"
          >
            確定
          </button>
        )}
      </div>
    </div>
  );
}
