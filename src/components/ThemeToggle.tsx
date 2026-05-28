"use client";

import { useEffect, useState } from "react";

/**
 * Light/dark toggle. The actual `dark` class on <html> is applied by the
 * inline pre-hydration script in layout.tsx; this component only mutates
 * it on click and persists the user choice to localStorage.
 *
 * Returns null on first render to avoid hydration mismatch (we cannot
 * know the resolved theme on the server).
 */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const root = document.documentElement;
    root.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore quota / privacy mode failures */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        dark === null ? "テーマ" : dark ? "ライトモードに切り替え" : "ダークモードに切り替え"
      }
      title={
        dark === null ? "テーマ" : dark ? "ライトモードに切り替え" : "ダークモードに切り替え"
      }
      className={[
        "fixed bottom-4 right-4 z-50 h-11 w-11 flex items-center justify-center rounded-full",
        "border border-slate-300 bg-white/90 backdrop-blur shadow-md",
        "hover:bg-white hover:scale-105 active:scale-95 transition",
        "dark:border-slate-700 dark:bg-slate-800/90 dark:hover:bg-slate-800",
      ].join(" ")}
    >
      <span aria-hidden className="text-base leading-none">
        {dark === null ? "" : dark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
