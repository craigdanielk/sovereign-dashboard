import { NextResponse } from "next/server";
import { searchEntities } from "@/lib/rag";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [deliveryResult, gateResult] = await Promise.all([
      searchEntities("delivery demo deployed", "delivery", 20),
      searchEntities("Demo-Library-Gate-Status", undefined, 3),
    ]);

    const deliveryEntities =
      (
        deliveryResult as {
          entities?: Array<{
            name: string;
            description: string;
            last_updated: string | null;
          }>;
        }
      )?.entities ?? [];

    // Deduplicate
    const seen = new Map<
      string,
      { name: string; description: string; last_updated: string | null }
    >();
    for (const e of deliveryEntities) {
      const existing = seen.get(e.name);
      if (
        !existing ||
        (e.last_updated ?? "") > (existing.last_updated ?? "")
      ) {
        seen.set(e.name, e);
      }
    }

    const demos = Array.from(seen.values()).map((e) => {
      const desc = e.description ?? "";
      let url = "";
      let whatItDoes = "";
      let problemSolved = "";

      // Try to extract Vercel URL
      const urlMatch = desc.match(
        /https:\/\/[a-z0-9-]+\.vercel\.app[^\s)"]*/i,
      );
      if (urlMatch) url = urlMatch[0];

      // Try JSON parse
      try {
        const parsed = JSON.parse(desc);
        url = url || parsed.url || parsed.vercel_url || parsed.live_url || "";
        whatItDoes = parsed.what_it_does || parsed.description || "";
        problemSolved = parsed.problem_solved || parsed.problem || "";
      } catch {
        whatItDoes = desc.slice(0, 400);
      }

      return {
        name: e.name,
        url,
        whatItDoes,
        problemSolved,
        lastUpdated: e.last_updated,
      };
    });

    // Parse gate status
    const gateEntities =
      (
        gateResult as {
          entities?: Array<{ name: string; description: string }>;
        }
      )?.entities ?? [];

    const gateEntity = gateEntities.find(
      (e) =>
        e.name === "Demo-Library-Gate-Status" ||
        e.name.includes("Gate-Status"),
    );
    let gateStatus = { current: 0, required: 5, approved: false };
    if (gateEntity) {
      try {
        const parsed = JSON.parse(gateEntity.description);
        gateStatus = {
          current: parsed.current ?? parsed.demos_ready ?? demos.length,
          required: parsed.required ?? parsed.demos_needed ?? 5,
          approved: parsed.outreach_approved ?? false,
        };
      } catch {
        gateStatus.current = demos.length;
      }
    } else {
      gateStatus.current = demos.length;
    }

    return NextResponse.json({
      demos,
      gateStatus,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg, demos: [], gateStatus: { current: 0, required: 5, approved: false } },
      { status: 500 },
    );
  }
}
