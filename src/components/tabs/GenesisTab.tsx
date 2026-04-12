"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, type Brief } from "@/lib/supabase";
import MissionGraph from "./MissionGraph";

// ── Types ─────────────────────────────────────────────────────────

interface ChatMessage {
  id: number;
  role: "user" | "assistant" | "system";
  text: string;
  brief_draft?: Record<string, unknown> | null;
  queued_brief_id?: number | null;
}

// ── Status colour mapping ─────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  QUEUED: "#7C3AED",
  CLAIMED: "#F59E0B",
  IN_PROGRESS: "#3B82F6",
  COMPLETED: "#10B981",
  FAILED: "#EF4444",
  SUPERSEDED: "#6B7280",
  DRAFT: "#6B7280",
};

// ── Node component (railway visualization) ────────────────────────

interface NodeDef {
  label: string;
  sub: string;
  status: "active" | "processing" | "pending";
}

const NODES: NodeDef[] = [
  { label: "Plan", sub: "Node 1-3", status: "active" },
  { label: "Build", sub: "Node 4-6", status: "processing" },
  { label: "Verify", sub: "Node 7", status: "pending" },
  { label: "Ship", sub: "Freight", status: "pending" },
];

function RailwayNode({ node, index }: { node: NodeDef; index: number }) {
  const colour =
    node.status === "active"
      ? "#7C3AED"
      : node.status === "processing"
      ? "#10B981"
      : "#2A2A2A";
  const textColour = node.status === "pending" ? "#6B6B6B" : "#E5E5E5";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        flex: index < NODES.length - 1 ? 1 : 0,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: `2px solid ${colour}`,
            background: node.status !== "pending" ? `${colour}22` : "#161616",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: node.status !== "pending" ? `0 0 12px ${colour}44` : "none",
          }}
        >
          {node.status === "active" && (
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7C3AED" }} />
          )}
          {node.status === "processing" && (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#10B981",
                animation: "pulse 1.5s infinite",
              }}
            />
          )}
          {node.status === "pending" && (
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#2A2A2A", border: "1px solid #3A3A3A" }} />
          )}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: textColour, letterSpacing: "0.03em" }}>
            {node.label}
          </div>
          <div style={{ fontSize: 10, color: "#6B6B6B", fontFamily: "monospace" }}>{node.sub}</div>
        </div>
      </div>
      {index < NODES.length - 1 && (
        <div
          style={{
            flex: 1,
            height: 1,
            background: "linear-gradient(90deg, #2A2A2A 0%, #3A3A3A 50%, #2A2A2A 100%)",
            marginBottom: 28,
            marginLeft: 8,
            marginRight: 8,
          }}
        />
      )}
    </div>
  );
}

// ── Brief draft card ──────────────────────────────────────────────

function BriefDraftCard({
  draft,
  queuedId,
  onQueue,
}: {
  draft: Record<string, unknown>;
  queuedId: number | null | undefined;
  onQueue: () => void;
}) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 16,
        background: "#0D0D0D",
        border: "1px solid #7C3AED66",
        borderRadius: 12,
        fontSize: 11,
        fontFamily: "monospace",
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span style={{ color: "#7C3AED", fontWeight: 700, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          BRIEF PROPOSAL
        </span>
        {queuedId ? (
          <span style={{ color: "#10B981", fontSize: 10, fontWeight: 700 }}>QUEUED #{queuedId}</span>
        ) : (
          <button
            onClick={onQueue}
            style={{
              fontSize: 10,
              color: "#FFFFFF",
              background: "#7C3AED",
              border: "none",
              borderRadius: 6,
              padding: "4px 12px",
              cursor: "pointer",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase"
            }}
          >
            Deploy Brief
          </button>
        )}
      </div>
      <div style={{ color: "#E5E5E5", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {(draft.name as string) ?? "Unnamed Mission"}
      </div>
      <div style={{ color: "#6B6B6B", fontSize: 10, lineHeight: 1.4 }}>
        {(draft.description as string) ?? "No description provided."}
      </div>
    </div>
  );
}

// ── Intelligence Report Card ──────────────────────────────────────

function IntelligenceReportCard({ data, onDownload }: { data: any; onDownload: () => void }) {
  if (!data) return null;
  
  return (
    <div style={{
      marginTop: 24,
      marginBottom: 32,
      padding: 24,
      background: "#161616",
      border: "1px solid #7C3AED44",
      borderRadius: 16,
      display: "flex",
      flexDirection: "column",
      gap: 16,
      boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
           <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7C3AED", boxShadow: "0 0 10px #7C3AED" }} />
           <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", letterSpacing: "0.15em" }}>INTELLIGENCE REVEAL</span>
        </div>
        <button 
          onClick={onDownload}
          style={{
            fontSize: 10,
            background: "#7C3AED11",
            color: "#7C3AED",
            border: "1px solid #7C3AED44",
            padding: "4px 12px",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 700,
            letterSpacing: "0.05em"
          }}
        >
          DOWNLOAD .DOCX
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "#0D0D0D", padding: 14, borderRadius: 10, border: "1px solid #222222" }}>
          <div style={{ fontSize: 9, color: "#444444", marginBottom: 6, fontWeight: 700, letterSpacing: "0.05em" }}>INDUSTRY VERTICAL</div>
          <div style={{ fontSize: 13, color: "#E5E5E5", fontWeight: 600 }}>{data.industry ?? "Analyzing..."}</div>
        </div>
        <div style={{ background: "#0D0D0D", padding: 14, borderRadius: 10, border: "1px solid #222222" }}>
          <div style={{ fontSize: 9, color: "#444444", marginBottom: 6, fontWeight: 700, letterSpacing: "0.05em" }}>TECH STACK</div>
          <div style={{ fontSize: 12, color: "#E5E5E5" }}>{data.tech_stack?.platform ?? "Scanning..."}</div>
        </div>
      </div>

      <div style={{ background: "#EF444405", padding: 16, borderRadius: 12, border: "1px solid #EF444415" }}>
        <div style={{ fontSize: 9, color: "#EF4444", marginBottom: 8, fontWeight: 700, letterSpacing: "0.05em" }}>IDENTIFIED AUTOMATION GAPS</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#BBBBBB", display: "flex", flexDirection: "column", gap: 6 }}>
          {data.gaps?.map((g: string, i: number) => <li key={i}>{g}</li>) ?? <li>Processing signals...</li>}
        </ul>
      </div>
    </div>
  );
}

// ── Sovereign Vault Component ─────────────────────────────────────

function SovereignVault({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "absolute",
      bottom: "100%",
      left: 0,
      width: "100%",
      marginBottom: 12,
      background: "#161616",
      border: "1px solid #7C3AED44",
      borderRadius: 16,
      padding: 20,
      boxShadow: "0 -20px 60px rgba(0,0,0,0.6)",
      zIndex: 50,
      animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
           <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7C3AED" }} />
           <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", letterSpacing: "0.15em" }}>SOVEREIGN VAULT</span>
        </div>
        <button onClick={onClose} style={{ color: "#444444", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <button style={{ 
          background: "#0D0D0D", border: "1px solid #222222", borderRadius: 10, padding: 14, 
          display: "flex", flexDirection: "column", gap: 10, alignItems: "center", cursor: "pointer", transition: "all 0.2s"
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "#4285F415", display: "flex", alignItems: "center", justifyContent: "center" }}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth="2.5"><path d="M22 19V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2z"/><path d="M12 21V3"/><path d="M7 21v-4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4"/><path d="M12 12h.01"/></svg>
          </div>
          <span style={{ fontSize: 10, color: "#888888", fontWeight: 700 }}>GOOGLE DRIVE</span>
        </button>
        <button style={{ 
          background: "#0D0D0D", border: "1px solid #222222", borderRadius: 10, padding: 14, 
          display: "flex", flexDirection: "column", gap: 10, alignItems: "center", cursor: "pointer", transition: "all 0.2s"
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "#0061FF15", display: "flex", alignItems: "center", justifyContent: "center" }}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0061FF" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
          <span style={{ fontSize: 10, color: "#888888", fontWeight: 700 }}>DROPBOX</span>
        </button>
      </div>

      <div style={{ marginTop: 16, border: "2px dashed #222222", borderRadius: 12, height: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0A0A0A", gap: 6 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333333" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span style={{ fontSize: 10, color: "#444444", fontWeight: 700, letterSpacing: "0.05em" }}>DROP ASSETS FOR CONTEXTUAL INJECTION</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function GenesisTab() {
  const [activeTab, setActiveTab] = useState<"INTEL" | "MATRIX" | "LOGS" | "DIRECTIVES">("INTEL");
  const [activeTenant, setActiveTenant] = useState<string>("NORTH-STAR");
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null);
  const [briefsLoading, setBriefsLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]); 
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isNewMission, setIsNewMission] = useState(true);
  const [intelligenceData, setIntelligenceData] = useState<any>(null);
  const [queuedIds, setQueuedIds] = useState<Record<number, number>>({});
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Tenant Lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    const slug = (typeof window !== "undefined" ? localStorage.getItem("ns_active_tenant") : null) || "NORTH-STAR";
    setActiveTenant(slug);

    // Initial force fetch
    setTimeout(fetchBriefs, 500);

    function onTenantChange(e: Event) {
      const slug = (e as CustomEvent).detail;
      setActiveTenant(slug);
      setMessages([]); 
      setIsNewMission(true);
      setIntelligenceData(null);
      setTimeout(fetchBriefs, 200);
    }
    window.addEventListener("tenant-change", onTenantChange);
    return () => window.removeEventListener("tenant-change", onTenantChange);
  }, []);

  useEffect(() => {
    setIsNewMission(messages.length === 0);
  }, [messages]);

  // ── Fetch active briefs ──────────────────────────────────────────
  const fetchBriefs = useCallback(async () => {
    // 1. Resolve slug to ID
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", activeTenant.toLowerCase())
      .single();
    
    if (!tenant) return;

    // 2. Fetch briefs for that ID
    const { data } = await supabase
      .from("briefs")
      .select("id,name,status,priority,created_at,payload")
      .eq("tenant_id", tenant.id)
      .in("status", ["QUEUED", "CLAIMED", "IN_PROGRESS", "FAILED"])
      .order("created_at", { ascending: false })
      .limit(12);
    if (data) setBriefs(data as Brief[]);
    setBriefsLoading(false);
  }, [activeTenant]);

  useEffect(() => {
    fetchBriefs();
    const channel = supabase
      .channel("genesis-tab")
      .on("postgres_changes", { event: "*", schema: "public", table: "briefs" }, fetchBriefs)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBriefs]);

  // ── Live Telemetry ──────────────────────────────────────────────
  const fetchLiveLogs = useCallback(async (briefId: number) => {
    const { data } = await supabase
      .from("execution_log")
      .select("*")
      .eq("brief_id", briefId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (data) setLiveLogs(data);
  }, []);

  useEffect(() => {
    if (selectedBrief?.id) {
      fetchLiveLogs(selectedBrief.id);
      const interval = setInterval(() => fetchLiveLogs(selectedBrief.id), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedBrief, fetchLiveLogs]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Download Audit Report ────────────────────────────────────────
  function downloadAudit(data: any) {
    if (!data) return;
    const md = `# Sovereign Intelligence Audit: ${activeTenant.toUpperCase()}\n\n` +
      `Generated: ${new Date().toLocaleString()}\n\n` +
      `## 1. Industry Analysis\n**Industry:** ${data.industry || "N/A"}\n\n` +
      `## 2. Tech Stack\n**Platform:** ${data.tech_stack?.platform || "N/A"}\n\n` +
      `## 3. Automation Gaps\n${data.gaps?.map((g: string) => `- ${g}`).join("\n") || "No gaps identified yet."}\n\n` +
      `--- \nGenerated by North Star OS — Genesis Intelligence Portal`;
    
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Sovereign_Audit_${activeTenant}.md`;
    a.click();
  }

  // ── Send message ─────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { id: Date.now(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    const historyForApi = [...messages, userMsg]
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.text }));

    try {
      const resp = await fetch("/api/genesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: historyForApi,
          tenant_id: activeTenant,
          context_brief_id: selectedBrief?.id ?? null
        }),
      });
      const data = await resp.json();
      const agentMsg: ChatMessage = {
        id: Date.now() + 1,
        role: "assistant",
        text: data.text ?? "No response from Genesis Agent.",
        brief_draft: data.brief_draft ?? null,
        queued_brief_id: data.queued_brief_id ?? null,
      };
      setMessages((prev) => [...prev, agentMsg]);
      if (data.intelligence) setIntelligenceData(data.intelligence);

      // Save to persistence
      const updatedHistory = [...historyForApi, { role: "assistant", content: agentMsg.text }];
      await supabase
        .from("phase0_intakes")
        .upsert({
          tenant_slug: activeTenant,
          conversation_history: updatedHistory,
          status: "ACTIVE"
        }, { onConflict: 'tenant_slug' });

      if (data.queued_brief_id) fetchBriefs();
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", text: "Neural link error. Check API configuration." },
      ]);
    } finally {
      setSending(false);
    }
  }

  // ── Queue a draft ────────────────────────────────────────────────
  async function queueDraft(msgId: number, draft: Record<string, unknown>) {
    try {
      setSending(true);
      // Resolve slug to ID
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("slug", activeTenant.toLowerCase())
        .single();

      if (!tenant) throw new Error("Tenant not found");

      const { data, error } = await supabase
        .from("briefs")
        .insert({
          tenant_id: tenant.id,
          name: (draft.name as string) || `Task: ${activeTenant}`,
          description: (draft.description as string) || "Queued via Genesis Portal.",
          priority: (draft.priority as string) || "P2",
          status: "QUEUED",
          agent_slug: (draft.agent as string) || "RECON"
        })
        .select()
        .single();
      
      if (error) throw error;
      if (data) {
        setQueuedIds((prev) => ({ ...prev, [msgId]: data.id }));
        fetchBriefs();
        setMessages(prev => [...prev, { id: Date.now(), role: "system", text: `MISSION DEPLOYED: BRIEF #${data.id}` }]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "#111111",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 48,
          borderBottom: "1px solid #222222",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          background: "#111111"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#888888", letterSpacing: "0.15em", textTransform: "uppercase" }}>Genesis Portal</span>
          <span
            style={{
              fontSize: 8,
              background: "#10B98115",
              color: "#10B981",
              borderRadius: 4,
              padding: "2px 8px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              border: "1px solid #10B98122"
            }}
          >
            Mechanical Protocol: Active
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 9, color: "#444444", fontWeight: 700, letterSpacing: "0.1em" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B98155" }} />
          SOVEREIGN DAEMON CONNECTED
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Rail */}
        <div
          style={{
            width: 320,
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #222222",
            overflow: "hidden",
            background: "#0E0E0E"
          }}
        >
            <div style={{ padding: "24px 24px 12px", borderBottom: "1px solid #222222" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#444444", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 20 }}>
                {selectedBrief ? `Mission: ${selectedBrief.id}` : "Mission Railway"}
              </div>
              
              {selectedBrief ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(selectedBrief.payload?.node_6_execution_plan?.steps || []).map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ 
                        width: 20, height: 20, borderRadius: "50%", background: "#161616", border: "1px solid #7C3AED", 
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#7C3AED", fontWeight: 700, flexShrink: 0
                      }}>
                        {step.step}
                      </div>
                      <div style={{ fontSize: 11, color: "#E5E5E5", opacity: 0.8, lineHeight: 1.4 }}>
                        {step.action}
                        <div style={{ fontSize: 9, color: "#444444", marginTop: 4, fontFamily: "monospace" }}>
                          AGENT: {step.agent || "UNASSIGNED"}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(selectedBrief.payload?.node_6_execution_plan?.steps?.length === 0 || !selectedBrief.payload?.node_6_execution_plan?.steps) && (
                    <div style={{ fontSize: 10, color: "#444444", fontStyle: "italic" }}>Awaiting sequence generation...</div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-start", padding: "10px 0", gap: 4 }}>
                  {NODES.map((node, i) => (
                    <RailwayNode key={node.label} node={node} index={i} />
                  ))}
                </div>
              )}
            </div>

          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 24px 8px", fontSize: 9, fontWeight: 700, color: "#444444", letterSpacing: "0.15em", textTransform: "uppercase" }}>Active Briefs</div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
              <div 
                onClick={fetchBriefs}
                style={{ fontSize: 9, color: "#7C3AED", fontWeight: 700, cursor: "pointer", marginBottom: 12, textAlign: "right", letterSpacing: "0.1em" }}
              >
                ↻ FORCE SYNC
              </div>
              {briefsLoading ? (
                Array(3).fill(0).map((_, i) => <div key={i} style={{ height: 50, marginBottom: 8, background: "#141414", borderRadius: 8, animation: "pulse 1.5s infinite" }} />)
              ) : briefs.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", fontSize: 9, color: "#222222", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>-- Empty Horizon --</div>
              ) : (
                briefs.map((brief) => (
                  <div
                    key={brief.id}
                    onClick={() => setSelectedBrief(brief)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px",
                      background: selectedBrief?.id === brief.id ? "#7C3AED22" : "#141414",
                      borderRadius: 10,
                      border: selectedBrief?.id === brief.id ? "1px solid #7C3AED" : "1px solid #222222",
                      marginBottom: 8,
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: STATUS_DOT[brief.status] ?? "#6B6B6B", boxShadow: `0 0 6px ${STATUS_DOT[brief.status] ?? "#6B6B6B"}88` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#E5E5E5", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brief.name}</div>
                      <div style={{ fontSize: 9, color: "#444444", fontFamily: "monospace", textTransform: "uppercase", marginTop: 2 }}>#{brief.id} · {brief.priority ?? "P2"}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Mission Command Center */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#111111", position: "relative" }}>
          
          {/* ── Neural Backdrop (Background Layer) ─────────────── */}
          <MissionGraph selectedBrief={selectedBrief} />

          {selectedBrief ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", zIndex: 1, background: "rgba(17,17,17,0.8)", backdropFilter: "blur(20px)", position: "relative" }}>
              {/* Tab Switcher */}
              <div style={{ height: 44, display: "flex", borderBottom: "1px solid #222222", padding: "0 24px" }}>
                {(["INTEL", "MATRIX", "LOGS", "DIRECTIVES"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      height: "100%",
                      padding: "0 20px",
                      background: "none",
                      border: "none",
                      borderBottom: activeTab === tab ? "2px solid #7C3AED" : "2px solid transparent",
                      color: activeTab === tab ? "#FFFFFF" : "#444444",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.15em",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "32px" }} className="custom-scrollbar">
                {activeTab === "INTEL" && (
                  <div style={{ maxWidth: 800 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>{selectedBrief.name}</h2>
                    <p style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 32 }}>Mission ID: #{selectedBrief.id} · Created: {new Date(selectedBrief.created_at).toLocaleString()}</p>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
                      <div style={{ background: "#0D0D0D", padding: 20, borderRadius: 16, border: "1px solid #222222" }}>
                        <div style={{ fontSize: 9, color: "#444444", fontWeight: 700, letterSpacing: "0.15em", marginBottom: 12 }}>MISSION CATEGORY</div>
                        <div style={{ fontSize: 13, color: "#E5E5E5", fontWeight: 600 }}>{selectedBrief.priority || "P2"} PRECEDENCE</div>
                      </div>
                      <div style={{ background: "#0D0D0D", padding: 20, borderRadius: 16, border: "1px solid #222222" }}>
                        <div style={{ fontSize: 9, color: "#444444", fontWeight: 700, letterSpacing: "0.15em", marginBottom: 12 }}>ORCHESTRATION MODE</div>
                        <div style={{ fontSize: 13, color: "#E5E5E5", fontWeight: 600 }}>SOVEREIGN DAEMON</div>
                      </div>
                    </div>

                    <div style={{ background: "#0D0D0D", padding: 24, borderRadius: 16, border: "1px solid #222222", marginBottom: 32 }}>
                      <div style={{ fontSize: 9, color: "#444444", fontWeight: 700, letterSpacing: "0.15em", marginBottom: 20 }}>ACCEPTANCE CRITERIA</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {(selectedBrief.payload?.node_3_deliverables?.acceptance_criteria || ["Scanning deliverables..."]).map((ac, i) => (
                          <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13, color: "#BBBBBB" }}>
                            <div style={{ width: 14, height: 14, borderRadius: 4, border: "1px solid #333333", background: "#0A0A0A" }} />
                            {ac}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "LOGS" && (
                  <div style={{ fontFamily: "monospace", display: "flex", flexDirection: "column", gap: 8 }}>
                    {liveLogs.map((log) => (
                      <div key={log.id} style={{ padding: 16, background: "#0D0D0D", border: "1px solid #222222", borderRadius: 12, display: "flex", gap: 20 }}>
                         <span style={{ color: "#7C3AED", fontWeight: 700, minWidth: 80 }}>{log.agent}</span>
                         <span style={{ color: "#E5E5E5", flex: 1 }}>{log.operation}</span>
                         <span style={{ color: "#444444" }}>{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                    ))}
                    {liveLogs.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#444444", fontSize: 11 }}>Awaiting mechanical heartbeat...</div>}
                  </div>
                )}

                {activeTab === "MATRIX" && (
                  <div style={{ height: "100%", position: "relative" }}>
                     {/* The background MissionGraph provides the matrix view */}
                     <div style={{ position: "absolute", bottom: 20, right: 20, background: "#161616", padding: 12, borderRadius: 12, border: "1px solid #7C3AED44", fontSize: 10, color: "#7C3AED", fontWeight: 700 }}>
                        3D NEURAL TOPOLOGY ACTIVE
                     </div>
                  </div>
                )}
                
                {activeTab === "DIRECTIVES" && (
                  <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                    {/* Chat history specific to this brief would go here */}
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #222222", borderRadius: 20 }}>
                       <span style={{ fontSize: 11, color: "#444444", fontWeight: 700, letterSpacing: "0.1em" }}>COMM CHANNEL: MISSION DIRECTIVES</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Live Telemetry Strip ───────────────────────────── */}
              <div style={{
                margin: "0 32px 32px",
                padding: 24,
                background: "#0D0D0D",
                border: "1px solid #7C3AED44",
                borderRadius: 20,
                boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                     <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 10px #10B981" }} />
                     <span style={{ fontSize: 10, fontWeight: 700, color: "#10B981", letterSpacing: "0.15em" }}>EXECUTION PULSE</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#444444", fontWeight: 700 }}>#{selectedBrief.id}</div>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {liveLogs.length > 0 ? liveLogs.map((log) => (
                    <div key={log.id} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 11, fontFamily: "monospace" }}>
                      <span style={{ color: "#7C3AED", fontWeight: 700 }}>{log.agent}</span>
                      <span style={{ flex: 1, color: "#888888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{log.operation}</span>
                      <span style={{ color: "#444444" }}>{new Date(log.created_at).toLocaleTimeString([], { hour12: false })}</span>
                    </div>
                  )) : (
                    <div style={{ padding: "20px 0", textAlign: "center", color: "#222222", fontSize: 10, letterSpacing: "0.1em" }}>{selectedBrief.status === 'QUEUED' ? 'AWAITING DISPATCH...' : 'STREAMING PULSE...'}</div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div style={{ background: "#161616", padding: 12, borderRadius: 12, border: "1px solid #222222" }}>
                    <div style={{ fontSize: 8, color: "#444444", marginBottom: 4, fontWeight: 700 }}>PROGRESS</div>
                    <div style={{ height: 4, background: "#0A0A0A", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: "#10B981", width: `${(liveLogs.length / (selectedBrief.payload?.node_6_execution_plan?.steps?.length || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <div style={{ background: "#161616", padding: 12, borderRadius: 12, border: "1px solid #222222" }}>
                    <div style={{ fontSize: 8, color: "#444444", marginBottom: 4, fontWeight: 700 }}>COST BURN</div>
                    <div style={{ fontSize: 13, color: "#E5E5E5", fontWeight: 600 }}>$0.00<span style={{ fontSize: 10, color: "#444444", marginLeft: 2 }}>USD</span></div>
                  </div>
                  <div style={{ background: "#161616", padding: 12, borderRadius: 12, border: "1px solid #222222" }}>
                    <div style={{ fontSize: 8, color: "#444444", marginBottom: 4, fontWeight: 700 }}>STATUS</div>
                    <div style={{ fontSize: 11, color: "#10B981", fontWeight: 700, letterSpacing: "0.05em" }}>{selectedBrief.status}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: "40px 32px", position: "relative", zIndex: 1 }} className="custom-scrollbar">
               {isNewMission && (
               <div style={{ marginBottom: 48, borderBottom: "1px solid #222222", paddingBottom: 32 }}>
                  <h1 style={{ fontSize: 32, fontWeight: 700, color: "#FFFFFF", marginBottom: 12, letterSpacing: "-0.02em" }}>Sovereign Discovery v4.1</h1>
                  <p style={{ fontSize: 15, color: "#6B6B6B", maxWidth: 500, lineHeight: 1.6 }}>
                    Architecting mission intelligence for <span style={{ color: "#7C3AED", fontWeight: 700 }}>{activeTenant}</span>. 
                    Drop a URL or mission brief to engage the neural daemon.
                  </p>
               </div>
            )}
            
            {intelligenceData && (
              <IntelligenceReportCard 
                data={intelligenceData} 
                onDownload={() => downloadAudit(intelligenceData)} 
              />
            )}
            
            {messages.map((msg) => {
              if (msg.role === "system") {
                return (
                  <div
                    key={msg.id}
                    style={{
                      fontSize: 9,
                      color: "#333333",
                      fontFamily: "monospace",
                      fontWeight: 700,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      padding: "12px 0",
                      textAlign: "center",
                      marginBottom: 32,
                      position: "relative"
                    }}
                  >
                    <span style={{ background: "#111111", padding: "0 16px", position: "relative", zIndex: 1 }}>{msg.text}</span>
                    <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: 1, background: "#1A1A1A" }} />
                  </div>
                );
              }

              const isUser = msg.role === "user";
              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 40 }}>
                  <div style={{
                    maxWidth: "85%",
                    padding: isUser ? "14px 20px" : "0",
                    borderRadius: isUser ? "16px 16px 4px 16px" : "0",
                    background: isUser ? "#7C3AED" : "transparent",
                    boxShadow: isUser ? "0 10px 40px rgba(124, 58, 237, 0.2)" : "none",
                    fontSize: 16,
                    color: isUser ? "#FFFFFF" : "#E5E5E5",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                  }}>
                    {!isUser && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, fontSize: 10, fontWeight: 700, color: "#444444", letterSpacing: "0.15em" }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: "#7C3AED15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="3"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                        </div>
                        GENESIS AGENT
                      </div>
                    )}
                    {msg.text}
                    {msg.brief_draft && (
                      <BriefDraftCard
                        draft={msg.brief_draft}
                        queuedId={queuedIds[msg.id] ?? msg.queued_brief_id}
                        onQueue={() => msg.brief_draft && queueDraft(msg.id, msg.brief_draft)}
                      />
                    )}
                  </div>
                </div>
              );
            })}


            {sending && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 40 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10, fontWeight: 700, color: "#444444", letterSpacing: "0.15em" }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: "#7C3AED15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7C3AED", animation: "pulse 1.5s infinite" }} />
                    </div>
                    SCANNING SIGNALS...
                  </div>
                  <div style={{ height: 2, width: 160, background: "#1A1A1A", borderRadius: 1, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "#7C3AED", width: "40%", animation: "progress 2s infinite ease-in-out" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
            </div>
          )}

          <div style={{ padding: "24px 32px 40px", background: "linear-gradient(0deg, #111111 60%, rgba(17, 17, 17, 0) 100%)", position: "relative" }}>
            <SovereignVault isOpen={isVaultOpen} onClose={() => setIsVaultOpen(false)} />
            
            <div style={{ 
              display: "flex", gap: 16, background: "#161616", border: "1px solid #2A2A2A", borderRadius: 20, padding: "10px", boxShadow: "0 30px 60px rgba(0,0,0,0.6)", alignItems: "flex-end"
            }}>
              <button
                onClick={() => setIsVaultOpen(!isVaultOpen)}
                style={{
                  width: 48, height: 48, borderRadius: 14, background: isVaultOpen ? "#7C3AED22" : "#1A1A1A", border: isVaultOpen ? "1px solid #7C3AED" : "1px solid #2A2A2A", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: isVaultOpen ? "#7C3AED" : "#444444", transition: "all 0.2s"
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Target URL or mission description..."
                disabled={sending}
                rows={1}
                style={{ flex: 1, background: "transparent", border: "none", padding: "12px 10px", fontSize: 16, color: "#FFFFFF", outline: "none", fontFamily: "inherit", resize: "none", maxHeight: 240 }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                style={{ width: 48, height: 48, borderRadius: 14, background: sending || !input.trim() ? "#1F1F1F" : "#7C3AED", border: "none", cursor: sending || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s", boxShadow: sending || !input.trim() ? "none" : "0 8px 20px rgba(124, 58, 237, 0.4)" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
            <div style={{ marginTop: 16, textAlign: "center", fontSize: 9, color: "#333333", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>Genesis Neural Interface v4.6 · Sovereign Protocol Enabled</div>
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes pulse { 0% { opacity: 0.3; } 50% { opacity: 0.7; } 100% { opacity: 0.3; } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1A1A1A; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #222222; }
      `}</style>
    </div>
  );
}
