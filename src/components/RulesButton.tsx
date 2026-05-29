"use client";

import { useRef } from "react";

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
    // Clicks on the dialog itself land on the <dialog> element when they
    // hit the backdrop. Clicks inside content land on inner elements.
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
          "rounded-2xl p-0 m-auto w-full max-w-md",
          "bg-white text-slate-900 shadow-2xl",
          "dark:bg-slate-900 dark:text-slate-100",
          "backdrop:bg-black/50 backdrop:backdrop-blur-sm",
        ].join(" ")}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
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

        <div className="px-5 py-4 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
          <Section title="ゲームの目的">
            自分のコマを 1 つでも相手のホーム列（自陣の反対側の一段）に
            到達させたら勝ち。
          </Section>

          <Section title="ボードとコマ">
            <ul className="list-disc pl-5 space-y-1">
              <li>5×5 のマス目</li>
              <li>各プレイヤー 5 個のコマ、最下段に並べる</li>
              <li>透明なコマには黒の十字矢印と白の斜め矢印が描かれており、下のタイル色によって見える矢印が変わる</li>
            </ul>
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
                <strong>任意</strong>: 空マスに自分のタイルを 1 枚置く（置かなくてもよい）
              </li>
            </ol>
          </Section>

          <Section title="コマの動き">
            現在乗っているマスの背景色で可動方向が決まる：
            <table className="w-full mt-2 text-xs">
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                <tr>
                  <td className="py-1.5 pr-2 font-medium">白マス</td>
                  <td className="py-1.5 text-slate-600 dark:text-slate-400">上下左右 (4 方向)</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-2 font-medium">黒タイル</td>
                  <td className="py-1.5 text-slate-600 dark:text-slate-400">斜め 4 方向</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-2 font-medium">グレータイル</td>
                  <td className="py-1.5 text-slate-600 dark:text-slate-400">全 8 方向</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section title="飛び越し">
            進行方向の隣接マスに <strong>自分のコマ</strong> がある場合、
            そのコマを飛び越して着地できる。連続して自分のコマが並んでいれば
            まとめて飛び越せ、最初の空マスに着地する。相手のコマは飛び越せず、
            ブロックされる。
          </Section>

          <Section title="勝利条件">
            自分のコマが 1 つでも相手の最下段（自陣の反対側）に到達した
            瞬間に勝ち。
          </Section>

          <p className="text-xs text-slate-500 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800">
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
