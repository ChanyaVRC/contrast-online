import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RulesButton } from "@/components/RulesButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

// Inline, synchronous theme application so the page paints in the right
// theme on first frame. Reads localStorage (explicit choice) and falls
// back to the OS preference for new visitors.
const themeBootstrap = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "コントラスト online",
  description:
    "029products のボードゲーム『コントラスト』をブラウザで遊べる非公式版（ローカル / AI / オンライン対戦）",
};

export const viewport = {
  colorScheme: "light dark",
} as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full flex flex-col bg-gradient-to-b from-slate-100 to-slate-200 text-slate-900 dark:from-slate-900 dark:to-slate-950 dark:text-slate-100">
        <div className="fixed bottom-4 right-4 z-50 flex items-end gap-2">
          <RulesButton />
          <ThemeToggle />
        </div>
        {children}
      </body>
    </html>
  );
}
