export const DANCE_MONTAGE_MAX_CLIP_DURATION_SECONDS = 20;
export const DANCE_MONTAGE_MAX_DURATION_SECONDS = 30;
export const DANCE_MONTAGE_PREFERRED_SEGMENT_DURATION_SECONDS = 10;
export const DANCE_MONTAGE_MIN_SEGMENT_DURATION_SECONDS = 5;
export function normalizeDanceMontageDurationArg(requestedDuration) {
    if (typeof requestedDuration !== 'number' || !Number.isFinite(requestedDuration))
        return undefined;
    return Math.min(DANCE_MONTAGE_MAX_DURATION_SECONDS, Math.max(8, requestedDuration));
}
export function planDanceMontageSegments(input) {
    const { imageCount, singleClip = false } = input;
    let duration = Math.min(input.requestedDuration, input.presetMaxDuration, DANCE_MONTAGE_MAX_DURATION_SECONDS);
    let segmentCount;
    if (singleClip && duration <= DANCE_MONTAGE_MAX_CLIP_DURATION_SECONDS) {
        segmentCount = 1;
    }
    else {
        const minRequired = Math.max(imageCount, Math.ceil(duration / DANCE_MONTAGE_MAX_CLIP_DURATION_SECONDS));
        const maxForMinDuration = Math.floor(duration / DANCE_MONTAGE_MIN_SEGMENT_DURATION_SECONDS);
        const preferredCount = Math.ceil(duration / DANCE_MONTAGE_PREFERRED_SEGMENT_DURATION_SECONDS);
        segmentCount = Math.min(maxForMinDuration, Math.max(minRequired, preferredCount));
        segmentCount = Math.max(segmentCount, minRequired);
    }
    let segmentDuration = Math.round((duration / segmentCount) * 4) / 4;
    segmentDuration = Math.max(DANCE_MONTAGE_MIN_SEGMENT_DURATION_SECONDS, Math.min(DANCE_MONTAGE_MAX_CLIP_DURATION_SECONDS, segmentDuration));
    duration = segmentDuration * segmentCount;
    return { duration, segmentCount, segmentDuration };
}
//# sourceMappingURL=danceMontage.js.map