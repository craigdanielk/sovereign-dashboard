"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Command {
  group: string;
  label: string;
  key?: string;
  action: () => void;
}

function buildCommands(switchTab: (key: string) => void): Command[] {
  return [
    // Navigation
    { group: "Navigate", label: "Overview",    key: "root",        action: () => switchTab("root") },
    { group: "Navigate", label: "North Star",  key: "north-star",  action: () => switchTab("north-star") },
    { group: "Navigate", label: "Battlefield", key: "battlefield", action: () => switchTab("battlefield") },
    { group: "Navigate", label: "Recon",       key: "recon",       action: () => switchTab("recon") },
    { group: "Navigate", label: "R17",         key: "r17",         action: () => switchTab("r17") },
    { group: "Navigate", label: "Workspace",   key: "command",     action: () => switchTab("command") },
    { group: "Navigate", label: "Comms",       key: "comms",       action: () => switchTab("comms") },
    { group: "Navigate", label: "Artifacts",   key: "artifacts",   action: () => switchTab("artifacts") },
    // Actions
    { group: "Actions", label: "New Task",  action: () => {} },
    { group: "Actions", label: "New BRIEF", action: () => switchTab("north-star") },
  ];
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function switchTab(key: string) {
    const setter = (window as unknown as Record<string, unknown>).__setActiveTab as
      | ((tab: string) => void)
      | undefined;
    if (setter) setter(key);
  }

  const commands = buildCommands(switchTab);

  const filtered = query.trim()
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  // Group filtered commands
  const groups = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {});

  const flatFiltered = Object.values(groups).flat();

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    // Open on Cmd+K
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen((prev) => !prev);
      setQuery("");
      setSelectedIdx(0);
      return;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [handleKeydown]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function handlePaletteKeydown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, flatFiltered.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter") {
      const cmd = flatFiltered[selectedIdx];
      if (cmd) {
        cmd.action();
        setOpen(false);
        setQuery("");
      }
    }
  }

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ paddingTop: "20vh", background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: 560,
          maxHeight: "60vh",
          background: "#161616",
          border: "1px solid #333333",
          borderRadius: 8,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
        onKeyDown={handlePaletteKeydown}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 border-b flex-shrink-0"
          style={{ padding: "12px 16px", borderColor: "#2A2A2A" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "#6B6B6B", flexShrink: 0 }}>
            <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="10" y1="10" x2="13.5" y2="13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            placeholder="Search commands…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 14,
              color: "#E5E5E5",
            }}
          />
          <kbd
            style={{
              fontSize: 11,
              color: "#6B6B6B",
              background: "#2A2A2A",
              borderRadius: 4,
              padding: "2px 6px",
              flexShrink: 0,
            }}
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {flatFiltered.length === 0 ? (
            <div style={{ padding: "24px 16px", fontSize: 13, color: "#6B6B6B", textAlign: "center" }}>
              No commands found
            </div>
          ) : (
            Object.entries(groups).map(([group, cmds]) => (
              <div key={group}>
                <div
                  style={{
                    padding: "8px 16px 4px",
                    fontSize: 11,
                    color: "#6B6B6B",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {group}
                </div>
                {cmds.map((cmd) => {
                  const isSelected = flatIdx === selectedIdx;
                  const currentIdx = flatIdx++;
                  return (
                    <button
                      key={cmd.label}
                      className="w-full flex items-center gap-3 text-left"
                      style={{
                        padding: "8px 16px",
                        fontSize: 13,
                        color: isSelected ? "#E5E5E5" : "#A0A0A0",
                        background: isSelected ? "#1E1E1E" : "transparent",
                        borderLeft: isSelected ? "2px solid #7C3AED" : "2px solid transparent",
                        cursor: "pointer",
                      }}
                      onMouseEnter={() => setSelectedIdx(currentIdx)}
                      onClick={() => {
                        cmd.action();
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      {cmd.label}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center gap-4 border-t flex-shrink-0"
          style={{ padding: "8px 16px", borderColor: "#2A2A2A", fontSize: 11, color: "#6B6B6B" }}
        >
          <span><kbd style={{ background: "#2A2A2A", borderRadius: 3, padding: "1px 4px" }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ background: "#2A2A2A", borderRadius: 3, padding: "1px 4px" }}>↵</kbd> select</span>
          <span><kbd style={{ background: "#2A2A2A", borderRadius: 3, padding: "1px 4px" }}>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
