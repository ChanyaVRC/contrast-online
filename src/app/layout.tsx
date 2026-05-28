import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  colorScheme: "light",
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
    >
      <body className="min-h-full flex flex-col bg-gradient-to-b from-slate-100 to-slate-200 text-slate-900">
        {children}
      </body>
    </html>
  );
}
