export const COST_CLASS_NUMERIC_WEIGHTS = {
    'free': 0,
    'image.standard': 1,
    'image.premium': 2,
    'image.external': 3,
    'video.standard': 5,
    'video.premium': 8,
    'video.vendor.standard': 6,
    'video.vendor.premium': 10,
    'audio.standard': 3,
    'compose.standard': 1,
    'compose.ffmpeg': 1,
};
export const UNKNOWN_COST_CLASS_FALLBACK_WEIGHT = 1;
export function getCostClassNumericWeight(costClass) {
    return COST_CLASS_NUMERIC_WEIGHTS[costClass];
}
//# sourceMappingURL=costEstimation.js.map