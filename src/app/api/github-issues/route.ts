import { NextResponse } from "next/server";

const REPOS = [
  "craigdanielk/control-tower",
  "craigdanielk/scripts",
  "craigdanielk/sovereign-dashboard",
  "craigdanielk/aragon-engine",
  "craigdanielk/skills",
];

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  labels: { name: string; color: string }[];
  assignee: { login: string } | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface IssueItem {
  repo: string;
  number: number;
  title: string;
  state: string;
  labels: { name: string; color: string }[];
  assignee: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

async function fetchRepoIssues(
  repo: string,
  token: string
): Promise<IssueItem[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues?state=all&per_page=30&sort=updated`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) {
    console.error(`GitHub API error for ${repo}: ${res.status}`);
    return [];
  }

  const issues: GitHubIssue[] = await res.json();

  // Filter out pull requests (GitHub API returns PRs as issues)
  return issues
    .filter((i) => !("pull_request" in i))
    .map((i) => ({
      repo: repo.split("/")[1],
      number: i.number,
      title: i.title,
      state: i.state,
      labels: i.labels.map((l) => ({ name: l.name, color: l.color })),
      assignee: i.assignee?.login ?? null,
      created_at: i.created_at,
      updated_at: i.updated_at,
      html_url: i.html_url,
    }));
}

export async function GET() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN not configured" },
      { status: 500 }
    );
  }

  const results = await Promise.allSettled(
    REPOS.map((repo) => fetchRepoIssues(repo, token))
  );

  const issues: IssueItem[] = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : []
  );

  return NextResponse.json(issues, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
