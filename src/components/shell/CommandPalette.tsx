"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Command {
  id: string;
  label: string;
  group: "Navigate" | "Actions";
  description?: string;
  action: () => void;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  // Cmd+K to open/close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        close();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navCommands: Command[] = [
    {
      id: "nav-overview",
      label: "Overview",
      group: "Navigate",
      description: "Go to Overview dashboard",
      action: () => { close(); router.push("/"); },
    },
    {
      id: "nav-north-star",
      label: "North Star",
      group: "Navigate",
      description: "BRIEF queue and execution pipeline",
      action: () => { close(); router.push("/north-star"); },
    },
    {
      id: "nav-battlefield",
      label: "Battlefield",
      group: "Navigate",
      description: "Agent activity and system graph",
      action: () => { close(); router.push("/battlefield"); },
    },
    {
      id: "nav-recon",
      label: "Recon",
      group: "Navigate",
      description: "Pattern detections and demand signals",
      action: () => { close(); router.push("/recon"); },
    },
    {
      id: "nav-r17",
      label: "R17",
      group: "Navigate",
      description: "Client briefs and R17 portfolio",
      action: () => { close(); router.push("/r17"); },
    },
    {
      id: "nav-workspace",
      label: "Workspace",
      group: "Navigate",
      description: "Tenant workspace and configuration",
      action: () => { close(); router.push("/ws"); },
    },
    {
      id: "nav-comms",
      label: "Comms",
      group: "Navigate",
      description: "Communications log",
      action: () => { close(); router.push("/comms"); },
    },
    {
      id: "nav-artifacts",
      label: "Artifacts",
      group: "Navigate",
      description: "Delivered artifacts and deployments",
      action: () => { close(); router.push("/artifacts"); },
    },
  ];

  const actionCommands: Command[] = [
    {
      id: "action-new-task",
      label: "New Task",
      group: "Actions",
      description: "Create a new task",
      action: () => {
        close();
        router.push("/north-star?new=task");
      },
    },
    {
      id: "action-new-brief",
      label: "New BRIEF",
      group: "Actions",
      description: "Create a new BRIEF",
      action: () => {
        close();
        router.push("/north-star?new=brief");
      },
    },
  ];

  const allCommands = [...navCommands, ...actionCommands];

  const filtered = query.trim()
    ? allCommands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description?.toLowerCase().includes(query.toLowerCase())
      )
    : allCommands;

  // Group the filtered commands
  const groups = [
    { label: "Navigate", items: filtered.filter((c) => c.group === "Navigate") },
    { label: "Actions", items: filtered.filter((c) => c.group === "Actions") },
  ].filter((g) => g.items.length > 0);

  // Flat list for keyboard navigation index
  const flatFiltered = groups.flatMap((g) => g.items);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      const cmd = flatFiltered[selectedIndex];
      if (cmd) cmd.action();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ paddingTop: "18vh" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={close}
      />

      {/* Panel */}
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          width: "560px",
          maxHeight: "420px",
          background: "var(--bg-sidebar, #161616)",
          border: "1px solid var(--border-component, #333333)",
          borderRadius: "8px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Search input */}
        <div
          style={{
            borderBottom: "1px solid var(--border-component, #333333)",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            style={{ color: "var(--text-tertiary, #6B6B6B)", flexShrink: 0 }}
          >
            <path
              d="M7 13A6 6 0 1 0 7 1a6 6 0 0 0 0 12ZM15 15l-3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Navigate to or search commands..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "13px",
              color: "var(--text-primary, #E5E5E5)",
            }}
          />
          <kbd
            style={{
              fontSize: "10px",
              color: "var(--text-tertiary, #6B6B6B)",
              border: "1px solid var(--border-component, #333333)",
              borderRadius: "4px",
              padding: "2px 6px",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {flatFiltered.length === 0 && (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--text-tertiary, #6B6B6B)",
              }}
            >
              No commands match &ldquo;{query}&rdquo;
            </div>
          )}

          {groups.map((group) => {
            let groupOffset = 0;
            for (const g of groups) {
              if (g.label === group.label) break;
              groupOffset += g.items.length;
            }

            return (
              <div key={group.label}>
                {/* Group header */}
                <div
                  style={{
                    padding: "6px 16px 4px",
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-tertiary, #6B6B6B)",
                    userSelect: "none",
                  }}
                >
                  {group.label}
                </div>

                {/* Commands */}
                {group.items.map((cmd, idx) => {
                  const flatIdx = groupOffset + idx;
                  const isSelected = flatIdx === selectedIndex;

                  return (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelectedIndex(flatIdx)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                        textAlign: "left",
                        padding: "0 16px",
                        height: "40px",
                        border: "none",
                        cursor: "pointer",
                        background: isSelected
                          ? "var(--bg-selected, #1E1E1E)"
                          : "transparent",
                        transition: "background 80ms",
                      }}
                    >
                      {/* Icon: chevron for navigate, lightning for actions */}
                      {cmd.group === "Navigate" ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{
                            color: isSelected
                              ? "var(--accent, #7C3AED)"
                              : "var(--text-tertiary, #6B6B6B)",
                            flexShrink: 0,
                            transition: "color 80ms",
                          }}
                        >
                          <path
                            d="M6 12l4-4-4-4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{
                            color: isSelected
                              ? "var(--accent, #7C3AED)"
                              : "var(--text-tertiary, #6B6B6B)",
                            flexShrink: 0,
                            transition: "color 80ms",
                          }}
                        >
                          <path
                            d="M9 2L4 9h4l-1 5 5-7H8l1-5Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}

                      {/* Label + description */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: "13px",
                            color: "var(--text-primary, #E5E5E5)",
                            fontWeight: isSelected ? 500 : 400,
                          }}
                        >
                          {cmd.label}
                        </span>
                        {cmd.description && (
                          <span
                            style={{
                              marginLeft: "8px",
                              fontSize: "11px",
                              color: "var(--text-tertiary, #6B6B6B)",
                            }}
                          >
                            {cmd.description}
                          </span>
                        )}
                      </div>

                      {/* Selected indicator */}
                      {isSelected && (
                        <kbd
                          style={{
                            fontSize: "10px",
                            color: "var(--text-tertiary, #6B6B6B)",
                            border: "1px solid var(--border-component, #333333)",
                            borderRadius: "4px",
                            padding: "1px 5px",
                            fontFamily: "var(--font-mono, monospace)",
                            flexShrink: 0,
                          }}
                        >
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid var(--border-component, #333333)",
            padding: "6px 16px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "10px",
            color: "var(--text-tertiary, #6B6B6B)",
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>ESC close</span>
        </div>
      </div>
    </div>
  );
}
