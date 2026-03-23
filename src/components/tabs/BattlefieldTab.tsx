"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getAgentColour, withAlpha } from "@/lib/colours";
import EventStream from "@/components/EventStream";

interface GraphNode {
  id: string;
  type: "agent" | "workflow" | "skill";
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  colour: string;
  size: number;
  active: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

interface MetricItem {
  label: string;
  value: string | number;
  colour: string;
}

function useForceGraph(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  nodes: GraphNode[],
  edges: GraphEdge[]
) {
  const nodesRef = useRef<GraphNode[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    nodesRef.current = nodes.map((n) => ({ ...n }));
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
    }
    resize();
    window.addEventListener("resize", resize);

    function simulate() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const ns = nodesRef.current;

      for (let i = 0; i < ns.length; i++) {
        ns[i].vx += (w / 2 - ns[i].x) * 0.001;
        ns[i].vy += (h / 2 - ns[i].y) * 0.001;

        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[i].x - ns[j].x;
          const dy = ns[i].y - ns[j].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 5000 / (dist * dist);
          ns[i].vx += (dx / dist) * force;
          ns[i].vy += (dy / dist) * force;
          ns[j].vx -= (dx / dist) * force;
          ns[j].vy -= (dy / dist) * force;
        }
      }

      for (const edge of edges) {
        const src = ns.find((n) => n.id === edge.source);
        const tgt = ns.find((n) => n.id === edge.target);
        if (!src || !tgt) continue;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = (dist - 150) * 0.01;
        src.vx += (dx / dist) * force;
        src.vy += (dy / dist) * force;
        tgt.vx -= (dx / dist) * force;
        tgt.vy -= (dy / dist) * force;
      }

      for (const n of ns) {
        n.vx *= 0.9;
        n.vy *= 0.9;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(40, Math.min(w - 40, n.x));
        n.y = Math.max(40, Math.min(h - 40, n.y));
      }

      ctx.clearRect(0, 0, w, h);

      for (const edge of edges) {
        const src = ns.find((n) => n.id === edge.source);
        const tgt = ns.find((n) => n.id === edge.target);
        if (!src || !tgt) continue;
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = "rgba(30, 30, 30, 0.8)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (const n of ns) {
        if (n.active) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.size * 2 + 8, 0, Math.PI * 2);
          ctx.fillStyle = withAlpha(n.colour, 0.15);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size * 2, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(n.colour, n.active ? 0.8 : 0.3);
        ctx.fill();
        ctx.strokeStyle = n.colour;
        ctx.lineWidth = n.active ? 2 : 1;
        ctx.stroke();

        ctx.fillStyle = n.active ? n.colour : "rgba(115, 115, 115, 0.8)";
        ctx.font = `${n.active ? "bold " : ""}16px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y + n.size * 2 + 16);
      }

      animRef.current = requestAnimationFrame(simulate);
    }

    animRef.current = requestAnimationFrame(simulate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef, edges]);
}

export default function BattlefieldTab() {
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchMetrics = useCallback(async () => {
    const now = Date.now();
    const cutoff1h = new Date(now - 3600000).toISOString();

    const [{ data: queued }, { data: claimed }, { data: completed }, { data: failed }, { data: logs1h }] =
      await Promise.all([
        supabase.from("briefs").select("id").eq("status", "QUEUED"),
        supabase.from("briefs").select("id").eq("status", "CLAIMED"),
        supabase.from("briefs").select("id").eq("status", "COMPLETED"),
        supabase.from("briefs").select("id").eq("status", "FAILED"),
        supabase.from("execution_log").select("id").gte("created_at", cutoff1h),
      ]);

    setMetrics([
      { label: "QUEUED", value: queued?.length || 0, colour: "#00b0ff" },
      { label: "CLAIMED", value: claimed?.length || 0, colour: "#ffb800" },
      { label: "COMPLETED", value: completed?.length || 0, colour: "#00ff41" },
      { label: "FAILED", value: failed?.length || 0, colour: "#ff1744" },
      { label: "OPS/1H", value: logs1h?.length || 0, colour: "#00e5ff" },
    ]);
  }, []);

  const fetchGraph = useCallback(async () => {
    const { data: recentLogs } = await supabase
      .from("execution_log")
      .select("agent, operation, brief_id, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (!recentLogs) return;

    const now = Date.now();
    const agentSet = new Map<string, { count: number; active: boolean; briefId: number | null }>();
    const edgeSet = new Map<string, { source: string; target: string; label: string }>();

    for (const log of recentLogs) {
      const age = now - new Date(log.created_at).getTime();
      if (!agentSet.has(log.agent)) {
        agentSet.set(log.agent, {
          count: 0,
          active: age < 5 * 60000,
          briefId: log.brief_id,
        });
      }
      agentSet.get(log.agent)!.count++;

      if (log.brief_id) {
        for (const [otherAgent, otherData] of agentSet) {
          if (otherAgent !== log.agent && otherData.briefId === log.brief_id) {
            const key = [log.agent, otherAgent].sort().join("-");
            if (!edgeSet.has(key)) {
              edgeSet.set(key, {
                source: log.agent,
                target: otherAgent,
                label: `#${log.brief_id}`,
              });
            }
          }
        }
      }
    }

    if (!agentSet.has("sovereign")) {
      agentSet.set("sovereign", { count: 0, active: false, briefId: null });
    }

    const center = { x: 400, y: 300 };
    const graphNodes: GraphNode[] = [];
    let i = 0;
    const total = agentSet.size;

    for (const [agent, data] of agentSet) {
      const angle = (i / total) * Math.PI * 2;
      const radius = agent === "sovereign" ? 0 : 200 + Math.random() * 100;
      graphNodes.push({
        id: agent,
        type: "agent",
        label: agent.toUpperCase(),
        x: center.x + Math.cos(angle) * radius + Math.random() * 50,
        y: center.y + Math.sin(angle) * radius + Math.random() * 50,
        vx: 0,
        vy: 0,
        colour: getAgentColour(agent),
        size: Math.min(12, 4 + Math.log(data.count + 1) * 2),
        active: data.active,
      });

      if (agent !== "sovereign") {
        const key = ["sovereign", agent].sort().join("-sov-");
        edgeSet.set(key, { source: "sovereign", target: agent, label: "dispatch" });
      }

      i++;
    }

    setNodes(graphNodes);
    setEdges(Array.from(edgeSet.values()));
  }, []);

  useEffect(() => {
    fetchMetrics();
    fetchGraph();

    const interval = setInterval(() => {
      fetchMetrics();
      fetchGraph();
    }, 30000);

    const channel = supabase
      .channel("battlefield-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "briefs" }, () => fetchMetrics())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "execution_log" }, () => {
        fetchMetrics();
        fetchGraph();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchMetrics, fetchGraph]);

  useForceGraph(canvasRef, nodes, edges);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: Event Stream */}
      <div className="w-56 shrink-0">
        <EventStream />
      </div>

      {/* Right: Graph + Metrics */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Metrics bar */}
        <div className="shrink-0 px-3 py-1.5 border-b border-border flex items-center gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-center gap-1.5">
              <span className="text-[9px] text-text-muted tracking-wider">{m.label}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: m.colour }}>
                {m.value}
              </span>
            </div>
          ))}
        </div>

        {/* Force graph canvas */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ background: "#0a0a0a" }}
          />
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-text-muted text-[10px]">Loading graph...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
