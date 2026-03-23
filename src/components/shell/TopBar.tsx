"use client";

import Link from "next/link";
import Breadcrumb from "./Breadcrumb";

export default function TopBar() {
  return (
    <header className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-border bg-bg-secondary">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-lg font-bold tracking-widest text-accent-cyan">SOVEREIGN</span>
        </Link>
        <span className="text-border">|</span>
        <Breadcrumb />
      </div>
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <button
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true })
            );
          }}
          className="flex items-center gap-1.5 px-2 py-1 rounded border border-border hover:border-text-muted transition-colors"
        >
          <span>Search</span>
          <kbd className="text-[10px] border border-border rounded px-1 py-0.5">
            Cmd+K
          </kbd>
        </button>
        <Link
          href="/ops"
          className="hover:text-text-secondary transition-colors"
        >
          Ops
        </Link>
        <span className="text-accent-green">APQC 1.0</span>
      </div>
    </header>
  );
}
