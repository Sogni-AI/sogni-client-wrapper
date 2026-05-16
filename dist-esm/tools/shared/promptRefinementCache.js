const REFINEMENT_VERSION = 'v3';
const AUDIO_ID_VERSION = 'v1';
const REFINEMENT_CACHE_MAX = 32;
const AUDIO_ID_CACHE_MAX = 32;
const refinementCache = new Map();
const audioIdCache = new Map();
const refinementInflight = new Map();
const audioIdInflight = new Map();
function hashString(s) {
    let hash = 2166136261;
    for (let i = 0; i < s.length; i++) {
        hash ^= s.charCodeAt(i);
        hash = (hash * 16777619) >>> 0;
    }
    return hash.toString(16);
}
function normalize(s) {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
function lruInsert(cache, key, value, max) {
    if (cache.size >= max) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined)
            cache.delete(firstKey);
    }
    cache.set(key, value);
}
export function refinementCacheKey(prompt, duration, isI2V, sceneDescription) {
    return `${REFINEMENT_VERSION}|${duration}|${isI2V ? 1 : 0}|${hashString(normalize(prompt))}|${hashString(normalize(sceneDescription))}`;
}
export function getCachedRefinement(key) {
    return refinementCache.get(key);
}
export function setCachedRefinement(key, value) {
    lruInsert(refinementCache, key, value, REFINEMENT_CACHE_MAX);
}
export function dedupeRefinement(key, factory) {
    const existing = refinementInflight.get(key);
    if (existing)
        return existing;
    const p = factory().finally(() => refinementInflight.delete(key));
    refinementInflight.set(key, p);
    return p;
}
export function audioIdCacheKey(composedPrompt) {
    return `${AUDIO_ID_VERSION}|${hashString(normalize(composedPrompt))}`;
}
export function getCachedAudioIdFormat(key) {
    return audioIdCache.get(key);
}
export function setCachedAudioIdFormat(key, value) {
    lruInsert(audioIdCache, key, value, AUDIO_ID_CACHE_MAX);
}
export function dedupeAudioIdFormat(key, factory) {
    const existing = audioIdInflight.get(key);
    if (existing)
        return existing;
    const p = factory().finally(() => audioIdInflight.delete(key));
    audioIdInflight.set(key, p);
    return p;
}
export function clearPromptRefinementCaches() {
    const total = refinementCache.size + audioIdCache.size;
    if (total > 0) {
        console.log(`[PROMPT CACHE] Cleared ${refinementCache.size} refinement + ${audioIdCache.size} audio ID entries`);
        refinementCache.clear();
        audioIdCache.clear();
    }
}
//# sourceMappingURL=promptRefinementCache.js.map