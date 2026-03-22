import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST /api/promote
 *
 * Approves or rejects a staging demo.
 *
 * Body:
 *   { id: number, action: "approve" | "reject" }
 *
 * On approve:
 *   1. Looks up artifact to find repo + staging branch from summary metadata.
 *   2. Calls GitHub API to merge stagingBranch → main (production deploy via Vercel).
 *   3. Updates Supabase: status = "deployed", verified_by_human = true.
 *
 * On reject:
 *   1. Updates Supabase: status = "rejected", verified_by_human = false.
 *
 * Summary metadata format (executor must follow this when registering staging demos):
 *   { "whatItDoes": "...", "repo": "owner/reponame", "stagingBranch": "staging/name" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const artifactId = body?.id;
    const action: "approve" | "reject" = body?.action ?? "approve";

    if (!artifactId) {
      return NextResponse.json({ error: "Missing artifact id" }, { status: 400 });
    }

    // Fetch the artifact to get metadata
    const { data: artifact, error: fetchError } = await supabase
      .from("artifacts")
      .select("id, name, summary, vercel_url, status")
      .eq("id", artifactId)
      .single();

    if (fetchError || !artifact) {
      return NextResponse.json({ error: fetchError?.message ?? "Artifact not found" }, { status: 404 });
    }

    if (action === "reject") {
      const { error } = await supabase
        .from("artifacts")
        .update({ status: "rejected", verified_by_human: false })
        .eq("id", artifactId);

      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, id: artifactId, action: "rejected" });
    }

    // action === "approve" — try GitHub merge if metadata available
    let mergeResult: { merged: boolean; message: string } | null = null;
    let githubError: string | null = null;

    const summaryMeta = parseSummaryMeta(artifact.summary);
    const githubToken = process.env.GITHUB_TOKEN;

    if (summaryMeta?.repo && summaryMeta?.stagingBranch && githubToken) {
      try {
        mergeResult = await mergeToMain(
          summaryMeta.repo,
          summaryMeta.stagingBranch,
          githubToken,
          `chore: promote staging demo ${artifact.name} to production`,
        );
      } catch (err) {
        githubError = err instanceof Error ? err.message : String(err);
        console.error("[/api/promote] GitHub merge failed:", githubError);
        // Non-fatal — still mark as deployed in Supabase
      }
    } else if (!githubToken) {
      githubError = "GITHUB_TOKEN not configured — skipping merge, marking deployed in Supabase only";
      console.warn("[/api/promote]", githubError);
    }

    // Update Supabase regardless of GitHub merge outcome
    const { error: updateError } = await supabase
      .from("artifacts")
      .update({ status: "deployed", verified_by_human: true })
      .eq("id", artifactId);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      ok: true,
      id: artifactId,
      action: "approved",
      merged: mergeResult?.merged ?? false,
      mergeMessage: mergeResult?.message ?? null,
      githubError,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/promote]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Parse staging metadata from the artifact summary field.
 * Executor stores: JSON string or "whatItDoes||repo:owner/repo||branch:staging/name"
 */
function parseSummaryMeta(
  summary: string | null,
): { repo: string; stagingBranch: string; whatItDoes: string } | null {
  if (!summary) return null;

  // Try JSON first
  try {
    const parsed = JSON.parse(summary);
    if (parsed.repo && parsed.stagingBranch) {
      return {
        repo: parsed.repo,
        stagingBranch: parsed.stagingBranch,
        whatItDoes: parsed.whatItDoes ?? "",
      };
    }
  } catch {
    // Not JSON — try pipe-delimited format: "description||repo:owner/name||branch:staging/name"
    const repoPart = summary.match(/repo:([^\s||]+)/)?.[1];
    const branchPart = summary.match(/branch:([^\s||]+)/)?.[1];
    if (repoPart && branchPart) {
      return { repo: repoPart, stagingBranch: branchPart, whatItDoes: summary };
    }
  }

  return null;
}

/**
 * Merge stagingBranch into main via GitHub API.
 */
async function mergeToMain(
  repo: string,
  stagingBranch: string,
  token: string,
  commitMessage: string,
): Promise<{ merged: boolean; message: string }> {
  // repo is "owner/reponame"
  const url = `https://api.github.com/repos/${repo}/merges`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      base: "main",
      head: stagingBranch,
      commit_message: commitMessage,
    }),
  });

  if (res.status === 204) {
    // Already up-to-date — no new commits
    return { merged: false, message: "Branch already merged" };
  }

  if (res.status === 201) {
    return { merged: true, message: "Merged successfully" };
  }

  const errBody = await res.json().catch(() => ({}));
  throw new Error(
    `GitHub merge failed: ${res.status} — ${(errBody as { message?: string }).message ?? "unknown error"}`,
  );
}
