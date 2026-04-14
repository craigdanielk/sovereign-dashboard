"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, type Brief } from "@/lib/supabase";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export default function PlanningWindow({ selectedBrief }: { selectedBrief: Brief | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // When a brief is selected, we might want to pre-load some context or clear messages
  useEffect(() => {
    if (selectedBrief) {
       setMessages(prev => [
         ...prev,
         { 
           id: Date.now().toString(), 
           role: "system", 
           content: `CONTEXT SECURED: Targeted communication established for Brief #${selectedBrief.id} [${selectedBrief.name}]` 
         }
       ]);
    }
  }, [selectedBrief]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const assistantId = (Date.now() + 1).toString();

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);

    // Add empty assistant message immediately — tokens will be appended into it
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const apiMessages = [...messages, userMsg]
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("/api/genesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          draft_brief: true,
          tenant_id: localStorage.getItem("ns_active_tenant") || "NORTH-STAR",
          context_brief_id: selectedBrief?.id ?? null
        })
      });

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          try {
            const event = JSON.parse(data);
            if (event.token) {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + event.token } : m
              ));
            }
            if (event.error) throw new Error(event.error);
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: "Connection error — could not reach planning API." }
          : m
      ));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg-card/20 border-t border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-1.5 border-b border-border bg-bg-primary/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest uppercase text-accent-purple">Planning Window</span>
          {selectedBrief && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20 font-mono">
              TARGET: #{selectedBrief.id}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
           <span className="text-[9px] text-text-muted font-bold tracking-wider uppercase">Neural Link Active</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none">
            <div className="w-12 h-12 mb-4 rounded-xl bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-purple">
                 <path d="M21 15a2 2 0 0 1-2 2H7l4-4V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v10z" />
               </svg>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Awaiting Planning Directives</p>
            <p className="text-[10px] text-text-muted max-w-[200px] mt-2">Initialize mission parameters or select a brief to begin targeted authoring.</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-accent-purple text-white rounded-br-none shadow-lg shadow-accent-purple/20' 
                : msg.role === 'system'
                ? 'bg-bg-primary/50 border border-border text-[10px] uppercase tracking-wider text-text-muted font-bold text-center w-full'
                : 'bg-bg-card border border-border text-text-primary rounded-bl-none'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && messages[messages.length - 1]?.content === "" && (
          <div className="flex justify-start -mt-2">
             <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-card border border-border">
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-1 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-1 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 bg-bg-primary/50 border-t border-border">
        <div className="relative flex items-end gap-2 bg-bg-card border border-border rounded-xl px-3 py-2 focus-within:border-accent-purple transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={selectedBrief ? `Update Brief #${selectedBrief.id}...` : "Author new mission directives..."}
            rows={1}
            className="flex-1 bg-transparent border-none outline-none text-xs text-text-primary resize-none py-1 max-h-32 custom-scrollbar"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="shrink-0 w-8 h-8 rounded-lg bg-accent-purple disabled:bg-bg-primary disabled:opacity-50 text-white flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-accent-purple/20"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
