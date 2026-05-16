import { parseAspectRatio } from './imageDimensions.js';
export const DEFAULT_MAX_MEDIA_ASPECT_RATIO = 4;
export function validateMediaAspectRatio(width, height, maxAspectRatio = DEFAULT_MAX_MEDIA_ASPECT_RATIO) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return 'Resolution dimensions must be positive numbers.';
    }
    const ratio = Math.max(width, height) / Math.min(width, height);
    if (ratio > maxAspectRatio) {
        return `Aspect ratio ${width}:${height} is too extreme; use ${maxAspectRatio}:1 or less.`;
    }
    return null;
}
export function validateMediaDimensions(width, height, bounds) {
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
        return 'Resolution width and height must be whole pixel values.';
    }
    const label = bounds.label ? `${bounds.label} ` : '';
    if (width < bounds.minDimension || height < bounds.minDimension) {
        return `${label}resolution must be at least ${bounds.minDimension}px on each side.`;
    }
    if (width > bounds.maxDimension || height > bounds.maxDimension) {
        return `${label}resolution must be ${bounds.maxDimension}px or less on each side.`;
    }
    const aspectError = validateMediaAspectRatio(width, height, bounds.maxAspectRatio);
    if (aspectError)
        return aspectError;
    const pixels = width * height;
    if (bounds.minPixels !== undefined && pixels < bounds.minPixels) {
        return `${label}resolution must contain at least ${bounds.minPixels.toLocaleString()} total pixels.`;
    }
    if (bounds.maxPixels !== undefined && pixels > bounds.maxPixels) {
        return `${label}resolution must contain ${bounds.maxPixels.toLocaleString()} total pixels or fewer.`;
    }
    return null;
}
export function validateMediaDimensionValue(value, bounds, dimensionName = 'dimension') {
    if (!Number.isInteger(value)) {
        return `Resolution ${dimensionName} must be a whole pixel value.`;
    }
    const label = bounds.label ? `${bounds.label} ` : '';
    if (value < bounds.minDimension) {
        return `${label}resolution ${dimensionName} must be at least ${bounds.minDimension}px.`;
    }
    if (value > bounds.maxDimension) {
        return `${label}resolution ${dimensionName} must be ${bounds.maxDimension}px or less.`;
    }
    return null;
}
export function validateMediaAspectRatioString(aspectRatio, bounds) {
    const parsed = parseAspectRatio(aspectRatio);
    if (!parsed)
        return null;
    if (parsed.type === 'exact') {
        return validateMediaDimensions(parsed.width, parsed.height, bounds);
    }
    return validateMediaAspectRatio(parsed.ratioW, parsed.ratioH, bounds.maxAspectRatio);
}
export const ASPECT_RATIO_DESCRIPTION = `Do NOT set unless the user explicitly requests an aspect ratio, format, orientation, or exact pixel dimensions. When a reference/source image is used and the user did not ask to change its shape, omit this field so the handler preserves the selected source image's own ratio.

Formats: "16:9", "9:16", "4:5", "1:1", "4:3", "3:2", "21:9", or exact pixels like "1920x1080".

CRITICAL: When the user specifies exact pixel dimensions (e.g., "1280x720", "1080x1920", "1920x1080", "3840x2160") or an orientation-qualified named resolution (e.g., "720p landscape", "720p portrait"), use the exact pixel format, NOT a ratio like "16:9" or "9:16". Exact user-requested dimensions override the selected default media quality, including Pro/HQ defaults. A bare named video resolution like "720p resolution" is only a resolution tier/short-side request; do not turn it into landscape pixels and do not set aspectRatio unless the user also states landscape, portrait, vertical, horizontal, or exact pixels. If requested pixels are in bounds but not on the model's pixel step, still pass the user's exact pixel request; the handler snaps to the nearest supported size internally. Only use ratio format when the user says a generic format name without pixel dimensions.

Mappings (use ONLY when user does NOT specify pixel dimensions): landscape/widescreen/YouTube/cinematic → "16:9". portrait → "9:16". TikTok/Reels/IG Reels → "1080x1920". ultrawide/cinema scope → "21:9". Instagram post → "4:5". square → "1:1". standard/TV → "4:3". 720p landscape → "1280x720". 720p portrait → "720x1280". 1080p landscape → "1920x1080". 1080p portrait/HD portrait → "1080x1920". 4K landscape → "3840x2160". 4K portrait → "2160x3840". Never set for generic requests like "make a video".`;
//# sourceMappingURL=aspectRatio.js.map