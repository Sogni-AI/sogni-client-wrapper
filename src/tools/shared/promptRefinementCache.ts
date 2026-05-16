/**
 * Module-level caches for LLM prompt-refinement sub-calls and an in-flight
 * promise dedup layer to coalesce concurrent identical calls.
 *
 * Pure logic — used by browser chat, hosted chat in sogni-api, and the skill
 * runtime so refinement caching/dedup behaves identically everywhere.
 *
 * Why these caches exist:
 * - `refineVideoPrompt` is the most expensive LLM call in the video pipeline
 *   (~30-75s thinking-mode). Token-fallback retries and identical re-runs in
 *   the same session re-pay this cost every time without caching.
 * - `formatAudioIdPrompt` is a deterministic structural transform — close to
 *   ideal for caching.
 *
 * Why in-flight dedup matters even without caching:
 * - Two concurrent calls with the same input would each make a fresh LLM
 *   call. The in-flight Map lets the second call await the first instead.
 *
 * Both caches are cleared via `clearPromptRefinementCaches()` so prompt
 * content doesn't leak across sessions/users.
 */

/** Bump these when the corresponding system prompt or model behavior changes,
 *  so cached entries from the previous version aren't returned. */
const REFINEMENT_VERSION = 'v3';
const AUDIO_ID_VERSION = 'v1';

const REFINEMENT_CACHE_MAX = 32;
const AUDIO_ID_CACHE_MAX = 32;

const refinementCache = new Map<string, string>();
const audioIdCache = new Map<string, string>();

const refinementInflight = new Map<string, Promise<string>>();
const audioIdInflight = new Map<string, Promise<string>>();

/** FNV-1a hash on a string (lossy but stable, fast, and deterministic). */
function hashString(s: string): string {
  let hash = 2166136261;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16);
}

/** Normalize whitespace and case so trivial variations hit the same cache key. */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function lruInsert<V>(cache: Map<string, V>, key: string, value: V, max: number): void {
  if (cache.size >= max) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, value);
}

export function refinementCacheKey(
  prompt: string,
  duration: number,
  isI2V: boolean,
  sceneDescription: string,
): string {
  return `${REFINEMENT_VERSION}|${duration}|${isI2V ? 1 : 0}|${hashString(normalize(prompt))}|${hashString(normalize(sceneDescription))}`;
}

export function getCachedRefinement(key: string): string | undefined {
  return refinementCache.get(key);
}

export function setCachedRefinement(key: string, value: string): void {
  lruInsert(refinementCache, key, value, REFINEMENT_CACHE_MAX);
}

export function dedupeRefinement(key: string, factory: () => Promise<string>): Promise<string> {
  const existing = refinementInflight.get(key);
  if (existing) return existing;
  const p = factory().finally(() => refinementInflight.delete(key));
  refinementInflight.set(key, p);
  return p;
}

export function audioIdCacheKey(composedPrompt: string): string {
  return `${AUDIO_ID_VERSION}|${hashString(normalize(composedPrompt))}`;
}

export function getCachedAudioIdFormat(key: string): string | undefined {
  return audioIdCache.get(key);
}

export function setCachedAudioIdFormat(key: string, value: string): void {
  lruInsert(audioIdCache, key, value, AUDIO_ID_CACHE_MAX);
}

export function dedupeAudioIdFormat(key: string, factory: () => Promise<string>): Promise<string> {
  const existing = audioIdInflight.get(key);
  if (existing) return existing;
  const p = factory().finally(() => audioIdInflight.delete(key));
  audioIdInflight.set(key, p);
  return p;
}

/** Clear all prompt-refinement caches. Call on logout / user change to avoid
 *  leaking prompt content across users in the same browser tab. */
export function clearPromptRefinementCaches(): void {
  const total = refinementCache.size + audioIdCache.size;
  if (total > 0) {
    console.log(`[PROMPT CACHE] Cleared ${refinementCache.size} refinement + ${audioIdCache.size} audio ID entries`);
    refinementCache.clear();
    audioIdCache.clear();
  }
}
