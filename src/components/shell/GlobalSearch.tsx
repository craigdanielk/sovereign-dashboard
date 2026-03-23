"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface SearchResult {
  type: string;
  id: string | number;
  title: string;
  subtitle: string;
  href: string;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // cmd+k listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      const matches: SearchResult[] = [];

      // Search briefs
      const { data: briefs } = await supabase
        .from("briefs")
        .select("id, name, status, priority")
        .ilike("name", `%${q}%`)
        .limit(5);

      if (briefs) {
        for (const b of briefs) {
          matches.push({
            type: "brief",
            id: b.id,
            title: b.name,
            subtitle: `#${b.id} - ${b.status} - ${b.priority}`,
            href: `/item/brief/${b.id}`,
          });
        }
      }

      // Search execution logs
      const { data: logs } = await supabase
        .from("execution_log")
        .select("id, agent, operation, input_summary")
        .or(`agent.ilike.%${q}%,input_summary.ilike.%${q}%`)
        .order("created_at", { ascending: false })
        .limit(5);

      if (logs) {
        for (const l of logs) {
          matches.push({
            type: "log",
            id: l.id,
            title: `${l.agent} - ${l.operation}`,
            subtitle: l.input_summary || "",
            href: `/item/log/${l.id}`,
          });
        }
      }

      setResults(matches);
      setSelectedIndex(0);
      setLoading(false);
    },
    []
  );

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => search(query), 300);
    return () => clearTimeout(timeout);
  }, [query, search]);

  function handleSelect(result: SearchResult) {
    setOpen(false);
    router.push(result.href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-bg-secondary border border-border rounded-lg shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="text-text-muted text-sm">/</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search briefs, agents, logs..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <kbd className="text-[10px] text-text-muted border border-border rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-xs text-text-muted">Searching...</div>
          )}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="px-4 py-3 text-xs text-text-muted">No results found</div>
          )}
          {results.map((result, i) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => handleSelect(result)}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                i === selectedIndex ? "bg-bg-card-hover" : "hover:bg-bg-card"
              }`}
            >
              <span className="text-[10px] uppercase text-text-muted font-bold w-10 shrink-0">
                {result.type}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-text-primary truncate">{result.title}</div>
                <div className="text-[10px] text-text-muted truncate">{result.subtitle}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-text-muted">
          <span>Arrow keys to navigate</span>
          <span>Enter to select</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
