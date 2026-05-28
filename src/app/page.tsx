import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-8 text-center">
        <header>
          <h1 className="text-4xl font-bold tracking-tight">コントラスト</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            背景色でコマの可動方向が変わる、5×5 の 2 人対戦アブストラクト
          </p>
        </header>

        <div className="grid gap-3">
          <ModeCard
            href="/play/local"
            title="ローカル 2 人対戦"
            desc="1 つの端末で交互にプレイ"
            tone="slate"
          />
          <ModeCard
            href="/play/ai"
            title="AI と対戦"
            desc="CPU と 1 人プレイ"
            tone="emerald"
          />
          <ModeCard
            href="/play/online"
            title="オンライン対戦"
            desc="ルームを作って URL を友達に共有"
            tone="sky"
          />
        </div>

        <footer className="text-xs text-slate-500 dark:text-slate-500">
          原作: 029products「コントラスト」 ·
          このサイトは非公式のファンメイド web 実装です
        </footer>
      </div>
    </main>
  );
}

function ModeCard({
  href,
  title,
  desc,
  tone,
}: {
  href: string;
  title: string;
  desc: string;
  tone: "slate" | "emerald" | "sky";
}) {
  const toneClass = {
    slate: "bg-slate-800 hover:bg-slate-900",
    emerald: "bg-emerald-600 hover:bg-emerald-700",
    sky: "bg-sky-600 hover:bg-sky-700",
  }[tone];
  return (
    <Link
      href={href as never}
      className={`rounded-xl ${toneClass} text-white p-5 text-left shadow-sm transition`}
    >
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-sm opacity-90">{desc}</div>
    </Link>
  );
}
