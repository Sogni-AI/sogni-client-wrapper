const CACHE = new Map();
const CACHE_MAX = 32;
export function hashImageBytes(data) {
    const len = Math.min(data.length, 4096);
    let hash = 2166136261;
    for (let i = 0; i < len; i++) {
        hash ^= data[i];
        hash = (hash * 16777619) >>> 0;
    }
    return `${hash.toString(16)}:${data.length}`;
}
export function getCachedVisionDescription(key) {
    return CACHE.get(key);
}
export function setCachedVisionDescription(key, description) {
    if (CACHE.size >= CACHE_MAX) {
        const firstKey = CACHE.keys().next().value;
        if (firstKey !== undefined)
            CACHE.delete(firstKey);
    }
    CACHE.set(key, description);
}
export function clearVisionDescriptionCache() {
    if (CACHE.size > 0) {
        console.log(`[VISION CACHE] Cleared ${CACHE.size} cached scene description(s)`);
        CACHE.clear();
    }
}
//# sourceMappingURL=visionDescriptionCache.js.map