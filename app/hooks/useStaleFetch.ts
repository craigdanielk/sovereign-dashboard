"use client";

/**
 * Fetch wrapper that checks for X-Data-Stale / X-Cached-At headers.
 * Returns the parsed JSON plus stale metadata.
 */
export interface FetchResult<T> {
  data: T;
  stale: boolean;
  cachedAt: string | null;
}

export async function staleFetch<T>(url: string): Promise<FetchResult<T>> {
  const res = await fetch(url);
  const data: T = await res.json();
  const stale = res.headers.get("X-Data-Stale") === "true";
  const cachedAt = res.headers.get("X-Cached-At");
  return { data, stale, cachedAt };
}
