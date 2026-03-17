import { NextResponse } from "next/server";
import { searchEntities } from "@/lib/rag";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = (await searchEntities("RECON scanner status", undefined, 5)) as {
      entities?: Array<{
        name: string;
        description: string;
        last_updated: string | null;
      }>;
    };

    const entities = result?.entities ?? [];
    const reconEntity = entities.find(
      (e) =>
        e.name.toLowerCase().includes("recon") &&
        !e.name.includes("pending-gap"),
    );

    let lastRun = "";
    let signalsFound = 0;
    let authStatus: "ok" | "error" | "unknown" = "unknown";
    let queueDepth = 0;

    if (reconEntity) {
      const desc = reconEntity.description ?? "";
      lastRun = reconEntity.last_updated ?? "";

      try {
        const parsed = JSON.parse(desc);
        signalsFound = parsed.signals_found ?? parsed.last_signals ?? 0;
        authStatus = parsed.auth_status ?? (parsed.authenticated ? "ok" : "unknown");
        queueDepth = parsed.queue_depth ?? 0;
      } catch {
        // Extract from text
        const signalMatch = desc.match(/(\d+)\s+signal/i);
        if (signalMatch) signalsFound = parseInt(signalMatch[1]);
        authStatus = desc.toLowerCase().includes("auth") ? "ok" : "unknown";
      }
    }

    return NextResponse.json({
      lastRun,
      signalsFound,
      authStatus,
      queueDepth,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
