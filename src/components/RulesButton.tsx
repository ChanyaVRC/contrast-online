"use client";

import { useRef } from "react";
import { PieceArt } from "./pieceArt";

/**
 * Floating "?" button that opens a modal summarising the rules of
 * Contrast. Uses the native <dialog> element so ESC-to-close, backdrop
 * dismissal, and focus trapping come for free.
 */
export function RulesButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function open() {
    dialogRef.current?.showModal();
  }
  function close() {
    dialogRef.current?.close();
  }
  function onBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) close();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="ルールを表示"
        title="ルールを表示"
        className={[
          "h-11 w-11 flex items-center justify-center rounded-full",
          "border border-slate-300 bg-white/90 backdrop-blur shadow-md",
          "text-base font-semibold text-slate-700",
          "hover:bg-white hover:scale-105 active:scale-95 transition",
          "dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-800",
        ].join(" ")}
      >
        ?
      </button>

      <dialog
        ref={dialogRef}
        onClick={onBackdropClick}
        className={[
          "rounded-2xl p-0 m-auto w-full max-w-2xl",
          "bg-white text-slate-900 shadow-2xl",
          "dark:bg-slate-900 dark:text-slate-100",
          "backdrop:bg-black/50 backdrop:backdrop-blur-sm",
        ].join(" ")}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 rounded-t-2xl">
          <h2 className="text-base font-bold">ルール</h2>
          <button
            type="button"
            onClick={close}
            aria-label="閉じる"
            className="h-8 w-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 text-sm max-h-[75vh] overflow-y-auto">
          <Section title="ゲームの目的">
            自分のコマを 1 つでも相手のホーム列（自陣の反対側の一段）に
            到達させたら勝ち。
          </Section>

          <Section title="初期配置">
            <p className="mb-3">
              5×5 のマス目。各プレイヤー 5 個のコマを最下段に並べる。
            </p>
            <div className="flex justify-center">
              <SetupDiagram />
            </div>
          </Section>

          <Section title="タイル（手持ち）">
            <ul className="list-disc pl-5 space-y-1">
              <li>各プレイヤー <strong>黒 3 枚 + グレー 1 枚</strong></li>
              <li>空マス（コマも他のタイルも無い）に置ける</li>
              <li>置いたタイルは盤面に残り続ける</li>
            </ul>
          </Section>

          <Section title="ターンの手順">
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                <strong>必須</strong>: 自分のコマを 1 つ動かす
              </li>
              <li>
                <strong>任意</strong>: 空マスに自分のタイルを 1 枚置く
              </li>
            </ol>
          </Section>

          <Section title="コマの動き">
            <p className="mb-3">
              現在乗っているマスの背景色で可動方向が変わる。
            </p>
            <div className="grid grid-cols-3 gap-3 sm:gap-6">
              <MovementCard kind="white" />
              <MovementCard kind="black" />
              <MovementCard kind="gray" />
            </div>
          </Section>

          <Section title="飛び越し">
            <p className="mb-3">
              進行方向の隣接マスに <strong>自分のコマ</strong> がある場合、
              そのコマを飛び越して着地できる。連続して自分のコマが並んでいれば
              まとめて飛び越せ、最初の空マスに着地する。
              <strong>相手のコマは飛び越せず</strong>、ブロックされる。
            </p>
            <div className="flex justify-center">
              <JumpDiagram />
            </div>
          </Section>

          <Section title="勝利条件">
            自分のコマが 1 つでも相手の最下段（自陣の反対側）に到達した
            瞬間に勝ち。
          </Section>

          <p className="text-xs text-slate-500 dark:text-slate-500 pt-3 border-t border-slate-200 dark:border-slate-800">
            原作:{" "}
            <a
              href="https://029products-contrast.studio.site/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-700 dark:hover:text-slate-300"
            >
              029products「コントラスト」公式サイト ↗
            </a>
          </p>
        </div>
      </dialog>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
        {title}
      </h3>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}

// ---- Diagrams ----

function MovementCard({ kind }: { kind: "white" | "black" | "gray" }) {
  const cellBg =
    kind === "white" ? "#f8fafc" : kind === "black" ? "#0f172a" : "#94a3b8";
  const label =
    kind === "white" ? "白マス" : kind === "black" ? "黒タイル" : "グレータイル";
  const desc =
    kind === "white"
      ? "上下左右 (4 方向)"
      : kind === "black"
        ? "斜め (4 方向)"
        : "全方向 (8 方向)";

  // Use the SAME piece art as the live board so the illustration matches
  // exactly what the player will see. The cell background hides whichever
  // arrow set has matching color, which IS the rule being explained.
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="aspect-square w-full max-w-[120px] rounded-sm border border-slate-300 dark:border-slate-700 overflow-hidden"
        style={{ background: cellBg }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
          <PieceArt owner={1} />
        </svg>
      </div>
      <div className="text-center">
        <div className="text-xs font-bold">{label}</div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400">
          {desc}
        </div>
      </div>
    </div>
  );
}

/** A small 5×5 setup, P1 at the bottom (sky), P2 at the top (rose). */
function SetupDiagram() {
  const size = 200;
  const cell = size / 5;
  const cells: { r: number; c: number; owner: 1 | 2 | null }[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const owner = r === 0 ? 2 : r === 4 ? 1 : null;
      cells.push({ r, c, owner });
    }
  }
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="rounded border border-slate-300 dark:border-slate-700"
      aria-hidden
    >
      <rect width={size} height={size} fill="#f8fafc" />
      {/* Grid lines */}
      {Array.from({ length: 6 }).map((_, i) => (
        <g key={i}>
          <line x1={0} x2={size} y1={i * cell} y2={i * cell} stroke="#cbd5e1" strokeWidth={0.5} />
          <line x1={i * cell} x2={i * cell} y1={0} y2={size} stroke="#cbd5e1" strokeWidth={0.5} />
        </g>
      ))}
      {/* Pieces */}
      {cells
        .filter((c) => c.owner !== null)
        .map(({ r, c, owner }) => (
          <MiniPiece
            key={`${r}-${c}`}
            cx={c * cell + cell / 2}
            cy={r * cell + cell / 2}
            scale={cell * 0.42}
            owner={owner as 1 | 2}
            flip={owner === 2}
          />
        ))}
    </svg>
  );
}

/** A horizontal strip showing the jump rule. */
function JumpDiagram() {
  const size = 80;
  const cells = 5;
  const width = size * cells;
  return (
    <svg
      viewBox={`0 0 ${width} ${size}`}
      width={Math.min(width, 400)}
      height={Math.min(size, 80)}
      className="rounded border border-slate-300 dark:border-slate-700"
      aria-hidden
    >
      <rect width={width} height={size} fill="#f8fafc" />
      {Array.from({ length: cells + 1 }).map((_, i) => (
        <line
          key={i}
          x1={i * size}
          x2={i * size}
          y1={0}
          y2={size}
          stroke="#cbd5e1"
          strokeWidth={0.5}
        />
      ))}
      {/* P1 mover at cell 0 */}
      <MiniPiece cx={size * 0.5} cy={size / 2} scale={size * 0.36} owner={1} />
      {/* P1 own piece at cell 1 (to be jumped) */}
      <MiniPiece cx={size * 1.5} cy={size / 2} scale={size * 0.36} owner={1} />
      {/* P1 own piece at cell 2 (also jumped) */}
      <MiniPiece cx={size * 2.5} cy={size / 2} scale={size * 0.36} owner={1} />
      {/* Empty cell 3 (landing) — drawn as dashed target */}
      <circle
        cx={size * 3.5}
        cy={size / 2}
        r={size * 0.3}
        fill="none"
        stroke="#10b981"
        strokeWidth={2}
        strokeDasharray="4 3"
      />
      {/* P2 piece at cell 4 (would block; here just for context) */}
      <MiniPiece cx={size * 4.5} cy={size / 2} scale={size * 0.36} owner={2} flip />
      {/* Jump arrow from cell 0 to cell 3 */}
      <g>
        <path
          d={`M ${size * 0.6} ${size * 0.25} Q ${size * 2} ${size * -0.05} ${size * 3.4} ${size * 0.25}`}
          fill="none"
          stroke="#10b981"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <polygon
          points={`${size * 3.4},${size * 0.25} ${size * 3.2},${size * 0.13} ${size * 3.2},${size * 0.37}`}
          fill="#10b981"
        />
      </g>
    </svg>
  );
}

function MiniPiece({
  cx,
  cy,
  scale,
  owner,
  flip,
}: {
  cx: number;
  cy: number;
  scale: number;
  owner: 1 | 2;
  flip?: boolean;
}) {
  // Reuse the live PieceArt (same arched body + cardinal-black /
  // diagonal-white arrow pattern + owner dot). PieceArt assumes a
  // 100×100 viewBox centered at (50, 50); translate + scale to position
  // it in the parent SVG's coordinates.
  const k = scale / 50;
  return (
    <g transform={`translate(${cx}, ${cy}) scale(${k}) translate(-50, -50)`}>
      <PieceArt owner={owner} flip={flip} />
    </g>
  );
}
