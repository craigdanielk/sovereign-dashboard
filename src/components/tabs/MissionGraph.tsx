
"use client";

import { useRef, useMemo, useEffect } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import SpriteText from "three-spritetext";

interface Node {
  id: string;
  name: string;
  val: number;
  color: string;
  type: 'agent' | 'mission' | 'system';
}

interface Link {
  source: string;
  target: string;
}

import { supabase, type Brief } from "@/lib/supabase";

export default function MissionGraph({ selectedBrief }: { selectedBrief: Brief | null }) {
  const graphRef = useRef<any>(null);

  const data = useMemo(() => {
    const nodes: Node[] = [
      { id: 'ns-core', name: 'NORTH STAR CORE', val: 20, color: '#7C3AED', type: 'system' }
    ];
    const links: Link[] = [];

    if (selectedBrief) {
      nodes.push({ id: `brief-${selectedBrief.id}`, name: selectedBrief.name, val: 15, color: '#10B981', type: 'mission' });
      links.push({ source: 'ns-core', target: `brief-${selectedBrief.id}` });

      const steps = selectedBrief.payload?.node_6_execution_plan?.steps || [];
      steps.forEach((step: any, i: number) => {
        const stepId = `step-${selectedBrief.id}-${i}`;
        nodes.push({ id: stepId, name: step.action, val: 8, color: '#3B82F6', type: 'system' });
        links.push({ source: `brief-${selectedBrief.id}`, target: stepId });

        if (step.agent) {
          const agentId = `agent-${step.agent}`;
          if (!nodes.find(n => n.id === agentId)) {
            nodes.push({ id: agentId, name: step.agent, val: 12, color: '#F59E0B', type: 'agent' });
          }
          links.push({ source: stepId, target: agentId });
        }
      });
    }

    return { nodes, links };
  }, [selectedBrief]);

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('link').distance(150);
      graphRef.current.d3Force('charge').strength(-200);
    }
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, opacity: 0.4, pointerEvents: 'none' }}>
      <ForceGraph3D
        ref={graphRef}
        graphData={data}
        nodeAutoColorBy="color"
        backgroundColor="#111111"
        showNavInfo={false}
        linkOpacity={0.2}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        nodeThreeObject={(node: any) => {
          const sprite = new SpriteText(node.name);
          sprite.color = node.color;
          sprite.textHeight = 4;
          return sprite;
        }}
      />
    </div>
  );
}
