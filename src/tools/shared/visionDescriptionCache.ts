/**
 * Module-level cache for vision LLM scene descriptions, keyed by image
 * content hash. Vision descriptions are deterministic for the same image —
 * caching them eliminates repeated LLM calls (~5s + tokens each) for images
 * we've already analyzed.
 *
 * Pure logic — used by all three consumers of the shared package.
 */

const CACHE = new Map<string, string>();
const CACHE_MAX = 32;

/**
 * FNV-1a hash on the first 4KB of an image, combined with byte length for
 * stronger collision resistance. Two images must hit the same 32-bit hash
 * AND have byte-identical lengths to collide — negligible for the cache size
 * cap.
 */
export function hashImageBytes(data: Uint8Array): string {
  const len = Math.min(data.length, 4096);
  let hash = 2166136261;
  for (let i = 0; i < len; i++) {
    hash ^= data[i];
    hash = (hash * 16777619) >>> 0;
  }
  return `${hash.toString(16)}:${data.length}`;
}

export function getCachedVisionDescription(key: string): string | undefined {
  return CACHE.get(key);
}

export function setCachedVisionDescription(key: string, description: string): void {
  if (CACHE.size >= CACHE_MAX) {
    const firstKey = CACHE.keys().next().value;
    if (firstKey !== undefined) CACHE.delete(firstKey);
  }
  CACHE.set(key, description);
}

/** Clear the entire cache. Call on logout / user change to avoid cross-user leaks. */
export function clearVisionDescriptionCache(): void {
  if (CACHE.size > 0) {
    console.log(`[VISION CACHE] Cleared ${CACHE.size} cached scene description(s)`);
    CACHE.clear();
  }
}
