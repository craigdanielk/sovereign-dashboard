/**
 * Deduplicates RAG entities by name, keeping the newest by last_updated.
 * Ghost vectors in Qdrant produce stale duplicates — this filters them out.
 */
export function dedupByName<
  T extends { name: string; last_updated?: string | null },
>(entities: T[]): T[] {
  const best = new Map<string, T>();
  for (const e of entities) {
    const existing = best.get(e.name);
    if (!existing) {
      best.set(e.name, e);
      continue;
    }
    const existingDate = existing.last_updated ?? "";
    const newDate = e.last_updated ?? "";
    if (newDate > existingDate) {
      best.set(e.name, e);
    }
  }
  return Array.from(best.values());
}
