"use client";

import { useEffect, useState, useCallback } from "react";
import ComplianceCard, { type TrafficLight } from "./ComplianceCard";
import { supabase } from "@/lib/supabase";

interface QualityBucket {
  label: string;
  count: number;
  colour: string;
}

export default function RetrospectiveQualityPanel() {
  const [loading, setLoading] = useState(true);
  const [buckets, setBuckets] = useState<QualityBucket[]>([]);
  const [total, setTotal] = useState(0);

  const fetchRetros = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("session_retrospectives")
        .select("id, summary")
        .limit(1000);

      if (error || !data) {
        setLoading(false);
        return;
      }

      let hollow = 0;
      let partial = 0;
      let complete = 0;

      for (const row of data) {
        const len = (row.summary ?? "").length;
        if (len < 20) hollow++;
        else if (len <= 200) partial++;
        else complete++;
      }

      setBuckets([
        { label: "COMPLETE", count: complete, colour: "text-accent-green" },
        { label: "PARTIAL", count: partial, colour: "text-accent-yellow" },
        { label: "HOLLOW", count: hollow, colour: "text-accent-red" },
      ]);
      setTotal(data.length);
    } catch {
      // Silently degrade
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRetros();
  }, [fetchRetros]);

  const completeCount = buckets.find((b) => b.label === "COMPLETE")?.count ?? 0;
  const hollowCount = buckets.find((b) => b.label === "HOLLOW")?.count ?? 0;
  const completePct = total > 0 ? Math.round((completeCount / total) * 100) : 0;

  const light: TrafficLight =
    total === 0
      ? "grey"
      : completePct >= 70
        ? "green"
        : hollowCount > completeCount
          ? "red"
          : "amber";

  return (
    <div>
      <ComplianceCard
        title="Retrospective Quality"
        metric={loading ? "---" : `${completePct}% COMPLETE`}
        light={light}
        detail={
          loading
            ? "Loading..."
            : total === 0
              ? "No retrospectives recorded"
              : `${total} retrospectives analysed`
        }
        loading={loading}
      />
      {buckets.length > 0 && (
        <div className="border border-t-0 border-border bg-bg-card px-5 pb-4">
          <div className="flex gap-6">
            {buckets.map((b) => (
              <div key={b.label} className="flex items-baseline gap-1.5">
                <span className={`text-lg font-bold ${b.colour}`}>
                  {b.count}
                </span>
                <span className="text-[10px] text-text-secondary uppercase tracking-wider">
                  {b.label}
                </span>
              </div>
            ))}
          </div>
          {/* Simple bar */}
          {total > 0 && (
            <div className="mt-2 flex h-1.5 rounded-sm overflow-hidden">
              {buckets.map((b) => (
                <div
                  key={b.label}
                  className={
                    b.label === "COMPLETE"
                      ? "bg-accent-green"
                      : b.label === "PARTIAL"
                        ? "bg-accent-yellow"
                        : "bg-accent-red"
                  }
                  style={{ width: `${(b.count / total) * 100}%` }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
