"use client";

import { useEffect, useState } from "react";

const MIN = 15;
const MAX = 21;
const DEFAULT = 17;
const KEY = "fontScale";

export default function FontSizeControl() {
  const [px, setPx] = useState(DEFAULT);

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) {
        const n = parseInt(s, 10);
        if (!Number.isNaN(n)) setPx(Math.max(MIN, Math.min(MAX, n)));
      }
    } catch {}
  }, []);

  function apply(next: number) {
    const c = Math.max(MIN, Math.min(MAX, next));
    setPx(c);
    document.documentElement.style.fontSize = `${c}px`;
    try {
      localStorage.setItem(KEY, String(c));
    } catch {}
  }

  return (
    <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => apply(px - 1)}
        disabled={px <= MIN}
        title="Smaller text"
        aria-label="Smaller text"
        className="w-8 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
      >
        <span className="font-semibold" style={{ fontSize: 12 }}>
          A
        </span>
      </button>
      <span className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
      <button
        onClick={() => apply(px + 1)}
        disabled={px >= MAX}
        title="Bigger text"
        aria-label="Bigger text"
        className="w-8 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
      >
        <span className="font-semibold" style={{ fontSize: 17 }}>
          A
        </span>
      </button>
    </div>
  );
}
