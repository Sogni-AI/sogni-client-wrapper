import { parseAspectRatio } from './imageDimensions.js';
function normalizePositiveNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
        return undefined;
    return Math.round(value);
}
function normalizeAspectRatio(value) {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return parseAspectRatio(trimmed) ? trimmed : undefined;
}
export function validateGenerationJobOverrides(overrides) {
    if (!overrides)
        return { valid: true };
    if (overrides.dimensionMode === 'dimensions') {
        const width = normalizePositiveNumber(overrides.width);
        const height = normalizePositiveNumber(overrides.height);
        if (width === undefined || height === undefined) {
            return { valid: false, message: 'Enter both width and height before starting generation.' };
        }
    }
    else if (overrides.dimensionMode === 'aspect_ratio') {
        if (!normalizeAspectRatio(overrides.aspectRatio)) {
            return { valid: false, message: 'Choose or enter a valid aspect ratio before starting generation.' };
        }
    }
    else if (overrides.dimensionMode === 'target_resolution') {
        const targetResolution = normalizePositiveNumber(overrides.targetResolution);
        if (targetResolution === undefined) {
            return { valid: false, message: 'Choose a short-side resolution before starting generation.' };
        }
        if (overrides.aspectRatio !== undefined && overrides.aspectRatio !== '' && !normalizeAspectRatio(overrides.aspectRatio)) {
            return { valid: false, message: 'Choose or enter a valid aspect ratio before starting generation.' };
        }
    }
    return { valid: true };
}
export function applyGenerationJobOverridesToArgs(args, overrides, options = {}) {
    if (!overrides)
        return args;
    const nextArgs = { ...args };
    if (overrides.qualityTier) {
        if (options.qualityArgKey) {
            nextArgs[options.qualityArgKey] = overrides.qualityTier === 'pro' ? 'hq' : overrides.qualityTier;
            if (options.clearModelArgOnQualityOverride ?? true) {
                delete nextArgs.model;
            }
        }
    }
    if (overrides.modelKey) {
        const modelArgKey = options.modelArgKey ?? 'model';
        nextArgs[modelArgKey] = overrides.modelKey;
    }
    if (overrides.dimensionMode === 'dimensions') {
        const width = normalizePositiveNumber(overrides.width);
        const height = normalizePositiveNumber(overrides.height);
        if (width !== undefined && height !== undefined) {
            nextArgs.width = width;
            nextArgs.height = height;
            delete nextArgs.aspectRatio;
            delete nextArgs.targetResolution;
        }
    }
    else if (overrides.dimensionMode === 'aspect_ratio') {
        const aspectRatio = normalizeAspectRatio(overrides.aspectRatio);
        if (aspectRatio) {
            nextArgs.aspectRatio = aspectRatio;
            delete nextArgs.width;
            delete nextArgs.height;
            delete nextArgs.targetResolution;
        }
    }
    else if (overrides.dimensionMode === 'target_resolution') {
        const targetResolution = normalizePositiveNumber(overrides.targetResolution);
        if (targetResolution !== undefined) {
            nextArgs.targetResolution = targetResolution;
            const aspectRatio = normalizeAspectRatio(overrides.aspectRatio);
            if (aspectRatio)
                nextArgs.aspectRatio = aspectRatio;
            delete nextArgs.width;
            delete nextArgs.height;
        }
    }
    return nextArgs;
}
//# sourceMappingURL=generationJob.js.map