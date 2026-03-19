import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { NextResponse } from "next/server";

interface CacheResult<T> {
  data: T;
  stale: boolean;
  cachedAt?: string;
}

const CACHE_DIR = join(tmpdir(), "sovereign-dashboard-cache");

function getCachePath(routeName: string): string {
  return join(CACHE_DIR, `dashboard-cache-${routeName}.json`);
}

/**
 * Wraps an async fetcher with file-based cache fallback.
 * On success: caches response and returns fresh data.
 * On failure: reads from cache and returns stale data with timestamp.
 */
export async function withCache<T>(
  routeName: string,
  fetcher: () => Promise<T>,
): Promise<CacheResult<T>> {
  try {
    const data = await fetcher();

    // Cache the successful response
    const cacheEntry = {
      data,
      cachedAt: new Date().toISOString(),
    };

    try {
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(getCachePath(routeName), JSON.stringify(cacheEntry), "utf-8");
    } catch {
      // Cache write failure is non-fatal
    }

    return { data, stale: false };
  } catch (err) {
    // Fetcher failed — try to serve from cache
    try {
      const raw = readFileSync(getCachePath(routeName), "utf-8");
      const cached = JSON.parse(raw) as { data: T; cachedAt: string };
      return {
        data: cached.data,
        stale: true,
        cachedAt: cached.cachedAt,
      };
    } catch {
      // No cache available — re-throw the original error
      throw err;
    }
  }
}

/**
 * Build a NextResponse with stale-data headers when serving cached data.
 */
export function jsonResponse<T>(
  data: T,
  cacheResult: { stale: boolean; cachedAt?: string },
): NextResponse {
  const response = NextResponse.json(data);
  if (cacheResult.stale && cacheResult.cachedAt) {
    response.headers.set("X-Data-Stale", "true");
    response.headers.set("X-Cached-At", cacheResult.cachedAt);
  }
  return response;
}
