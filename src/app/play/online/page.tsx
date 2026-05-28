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
      setError("ルーム作成に失敗しました");
      setBusy(false);
    }
  }

  function joinRoom(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(code)) {
      setError("コードは英数字 4〜12 文字");
      return;
    }
    router.push(`/play/${code}` as never);
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-600 hover:underline">
            ← トップ
          </Link>
          <h1 className="font-semibold">オンライン対戦</h1>
          <span />
        </header>

        <section className="space-y-3 rounded-xl bg-white shadow p-5">
          <h2 className="font-semibold">ルームを作成</h2>
          <p className="text-sm text-slate-600">
            6 文字のコードと URL が発行されます。相手にシェアしてください。
          </p>
          <button
            disabled={busy}
            onClick={createRoom}
            className="w-full rounded bg-sky-600 text-white py-2 font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? "作成中…" : "新しいルームを作る"}
          </button>
        </section>

        <section className="space-y-3 rounded-xl bg-white shadow p-5">
          <h2 className="font-semibold">既存ルームに参加</h2>
          <form onSubmit={joinRoom} className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="ABC123"
              className="flex-1 rounded border border-slate-300 px-3 py-2 font-mono uppercase"
              maxLength={12}
            />
            <button
              type="submit"
              className="rounded bg-slate-800 text-white px-4 py-2 hover:bg-slate-900"
            >
              参加
            </button>
          </form>
        </section>

        {error && <p className="text-sm text-rose-600 text-center">{error}</p>}
      </div>
    </main>
  );
}
