import { parseAspectRatio } from "./imageDimensions.js";
export const LTX23_DISTILLED_MODEL_IDS = {
    t2v: "ltx23-22b-fp8_t2v_distilled",
    i2v: "ltx23-22b-fp8_i2v_distilled",
    a2v: "ltx23-22b-fp8_a2v_distilled",
    ia2v: "ltx23-22b-fp8_ia2v_distilled",
};
export const LTX23_DEV_MODEL_IDS = {
    t2v: "ltx23-22b-fp8_t2v_dev",
    i2v: "ltx23-22b-fp8_i2v_dev",
    a2v: "ltx23-22b-fp8_a2v_dev",
    ia2v: "ltx23-22b-fp8_ia2v_dev",
};
export function getLtx23WorkflowModelIdForQuality(workflow, qualityTier = "fast") {
    return qualityTier === "pro"
        ? LTX23_DEV_MODEL_IDS[workflow]
        : LTX23_DISTILLED_MODEL_IDS[workflow];
}
export function getLtx23ModelNameForQuality(workflowName, qualityTier = "fast") {
    return qualityTier === "pro"
        ? `LTX 2.3 22B ${workflowName} Dev`
        : `LTX 2.3 22B ${workflowName} Distilled`;
}
export function getLtx23StepsForQuality(qualityTier = "fast") {
    return qualityTier === "pro" ? 20 : 8;
}
export const VIDEO_MODEL_CONFIGS = {
    wan22: {
        model: "wan_v2.2-14b-fp8_i2v_lightx2v",
        fps: 32,
        internalFps: 16,
        steps: 6,
        guidance: 5.0,
        dimensionDivisor: 16,
        minDimension: 480,
        maxDimension: 1536,
        sampler: "euler",
        scheduler: "simple",
        shift: 8.0,
    },
    ltx23: {
        model: LTX23_DISTILLED_MODEL_IDS.i2v,
        fps: 24,
        steps: getLtx23StepsForQuality("fast"),
        guidance: 1.0,
        dimensionDivisor: 64,
        minDimension: 640,
        maxDimension: 3840,
        sampler: "euler",
        scheduler: "simple",
        strength: 0.9,
        resolutionTiers: [1088, 768],
        resolutionThreshold: 720,
    },
    seedance2: {
        model: "seedance-2-0",
        fps: 24,
        dimensionDivisor: 1,
        minDimension: 1,
        maxDimension: 99999,
    },
    "seedance2-fast": {
        model: "seedance-2-0-fast",
        fps: 24,
        dimensionDivisor: 1,
        minDimension: 1,
        maxDimension: 1280,
    },
};
export const DEFAULT_VIDEO_MODEL = "ltx23";
export function getVideoModelConfig(modelId = DEFAULT_VIDEO_MODEL, qualityTier = "fast") {
    const config = VIDEO_MODEL_CONFIGS[modelId];
    if (modelId !== "ltx23")
        return config;
    return {
        ...config,
        model: getLtx23WorkflowModelIdForQuality("i2v", qualityTier),
        steps: getLtx23StepsForQuality(qualityTier),
    };
}
export const VIDEO_CONFIG = {
    get defaultFps() {
        return getVideoModelConfig().fps;
    },
    get defaultDuration() {
        return 5;
    },
    get dimensionDivisor() {
        return getVideoModelConfig().dimensionDivisor;
    },
    get minDimension() {
        return getVideoModelConfig().minDimension;
    },
    get maxDimension() {
        return getVideoModelConfig().maxDimension;
    },
    get defaultFrames() {
        return calculateVideoFrames(5);
    },
};
export const VIDEO_QUALITY_PRESETS = {
    fast: {
        get model() {
            return getVideoModelConfig().model;
        },
        get steps() {
            return getVideoModelConfig().steps;
        },
        label: "Fast",
        description: "Quick generation (~15-30s)",
    },
};
export function calculateVideoDimensions(imageWidth, imageHeight, targetResolution, modelId = DEFAULT_VIDEO_MODEL, aspectRatio) {
    const config = VIDEO_MODEL_CONFIGS[modelId];
    const divisor = config.dimensionDivisor;
    const minDim = config.minDimension;
    const maxDim = config.maxDimension;
    const parsed = parseAspectRatio(aspectRatio);
    let effectiveW = imageWidth;
    let effectiveH = imageHeight;
    if (parsed?.type === "exact") {
        effectiveW = parsed.width;
        effectiveH = parsed.height;
    }
    else if (parsed?.type === "ratio") {
        const srcArea = imageWidth * imageHeight;
        const ratio = parsed.ratioW / parsed.ratioH;
        effectiveW = Math.sqrt(srcArea * ratio);
        effectiveH = srcArea / effectiveW;
    }
    if (parsed?.type !== "exact" &&
        config.resolutionTiers &&
        config.resolutionTiers.length > 0 &&
        targetResolution === undefined) {
        const srcShorter = Math.min(effectiveW, effectiveH);
        const threshold = config.resolutionThreshold ??
            config.resolutionTiers[config.resolutionTiers.length - 1];
        const tier = srcShorter < threshold
            ? config.resolutionTiers[config.resolutionTiers.length - 1]
            : config.resolutionTiers[0];
        let w, h;
        if (effectiveW <= effectiveH) {
            w = tier;
            h = Math.round((effectiveH * tier) / effectiveW / divisor) * divisor;
        }
        else {
            h = tier;
            w = Math.round((effectiveW * tier) / effectiveH / divisor) * divisor;
        }
        w = Math.min(maxDim, w);
        h = Math.min(maxDim, h);
        return { width: w, height: h };
    }
    let w = effectiveW;
    let h = effectiveH;
    if (targetResolution !== undefined) {
        const roundedTarget = Math.round(targetResolution / divisor) * divisor;
        if (w <= h) {
            h = Math.round((h * roundedTarget) / w / divisor) * divisor;
            w = roundedTarget;
        }
        else {
            w = Math.round((w * roundedTarget) / h / divisor) * divisor;
            h = roundedTarget;
        }
    }
    const larger = Math.max(w, h);
    if (larger > maxDim) {
        const scale = maxDim / larger;
        w *= scale;
        h *= scale;
    }
    const smaller = Math.min(w, h);
    if (smaller < minDim) {
        const scale = minDim / smaller;
        w *= scale;
        h *= scale;
    }
    w = Math.round(w / divisor) * divisor;
    h = Math.round(h / divisor) * divisor;
    w = Math.max(minDim, Math.min(maxDim, w));
    h = Math.max(minDim, Math.min(maxDim, h));
    return { width: w, height: h };
}
export function calculateVideoFrames(duration = 5, modelId = DEFAULT_VIDEO_MODEL, qualityTier = "fast") {
    const config = getVideoModelConfig(modelId, qualityTier);
    const generationFps = config.internalFps ?? config.fps;
    const rawFrames = generationFps * duration + 1;
    return Math.round((rawFrames - 1) / 8) * 8 + 1;
}
//# sourceMappingURL=videoSettings.js.map