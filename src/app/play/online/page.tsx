"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function OnlineLobbyPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/room/create", { method: "POST" });
      if (!res.ok) throw new Error("failed to create room");
      const json = (await res.json()) as { code: string; path: string };
      router.push(json.path as never);
    } catch {
      setError("ルーム作成に失敗しました。時間をおいて再度お試しください。");
      setBusy(false);
    }
  }

  function joinRoom(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(code)) {
      setError("コードは英数字 4〜12 文字で入力してください");
      return;
    }
    router.push(`/play/${code}` as never);
  }

  return (
    <main className="flex-1 flex flex-col items-center p-6">
      <div className="max-w-md w-full space-y-6">
        <header className="flex items-center pt-2">
          <Link
            href="/"
            className="text-sm text-slate-600 hover:underline hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            ← トップ
          </Link>
          <h1 className="flex-1 text-center text-lg font-bold tracking-tight">
            オンライン対戦
          </h1>
          <span className="w-12" />
        </header>

        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          ルームを作って URL を送れば、相手と 1 対 1 で対戦できます
        </p>

        {/* Primary action — create room */}
        <section className="rounded-2xl bg-white shadow-md p-6 space-y-4 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:shadow-none">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700 text-sm font-bold dark:bg-sky-900 dark:text-sky-200">
                1
              </span>
              新しいルームを作る
            </h2>
            <p className="mt-1.5 text-xs text-slate-500 pl-9 dark:text-slate-400">
              発行された URL を相手にシェア。先に入った人が P1 になります。
            </p>
          </div>
          <button
            disabled={busy}
            onClick={createRoom}
            className="w-full rounded-xl bg-sky-600 text-white py-3.5 text-base font-semibold hover:bg-sky-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition"
          >
            {busy ? "作成中…" : "ルームを作って待機"}
          </button>
        </section>

        <div className="flex items-center gap-3 text-xs text-slate-400 uppercase tracking-wider dark:text-slate-500">
          <span className="flex-1 h-px bg-slate-300 dark:bg-slate-700" />
          または
          <span className="flex-1 h-px bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Secondary action — join existing room */}
        <section className="rounded-2xl bg-white shadow-sm p-6 space-y-4 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:shadow-none">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-sm font-bold dark:bg-slate-700 dark:text-slate-200">
                2
              </span>
              既存ルームに参加
            </h2>
            <p className="mt-1.5 text-xs text-slate-500 pl-9 dark:text-slate-400">
              相手から受け取った 6 文字のコードを入力
            </p>
          </div>
          <form onSubmit={joinRoom} className="space-y-3">
            <input
              value={joinCode}
              onChange={(e) =>
                setJoinCode(e.target.value.replace(/[^A-Za-z0-9]/g, ""))
              }
              placeholder="ABC123"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-center text-2xl font-mono font-semibold uppercase tracking-[0.4em] focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100 placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal placeholder:text-base dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-900/40 dark:placeholder:text-slate-600"
              maxLength={12}
            />
            <button
              type="submit"
              disabled={joinCode.trim().length < 4}
              className="w-full rounded-xl bg-slate-800 text-white py-3.5 text-base font-semibold hover:bg-slate-900 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition"
            >
              ルームに参加
            </button>
          </form>
        </section>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-300 px-4 py-3 text-sm text-rose-800 text-center dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
