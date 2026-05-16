/**
 * Video Generation Settings -- Dual Model Support (WAN 2.2 + LTX 2.3)
 */

import { parseAspectRatio } from "./imageDimensions.js";

// ============================================================================
// Model IDs & Types
// ============================================================================

export type VideoModelId = "wan22" | "ltx23" | "seedance2" | "seedance2-fast";
export type VideoQualityTier = "fast" | "hq" | "pro";
export type Ltx23Workflow = "t2v" | "i2v" | "a2v" | "ia2v";

export interface VideoModelConfig {
  model: string;
  /** Output fps sent to the worker. For WAN this is the interpolated playback rate. */
  fps: number;
  /**
   * Native generation fps used for frame-count math. When omitted, falls back to `fps`.
   * WAN 2.2 generates at 16fps internally and the worker interpolates up to `fps`.
   */
  internalFps?: number;
  steps?: number;
  guidance?: number;
  dimensionDivisor: number;
  minDimension: number;
  maxDimension: number;
  sampler?: string;
  scheduler?: string;
  /** WAN-specific: shift parameter */
  shift?: number;
  /** LTX 2.3-specific: I2V conditioning strength */
  strength?: number;
  /** Fixed shorter-side resolution tiers (e.g. LTX 2.3 snaps to 1088 or 768) */
  resolutionTiers?: number[];
  /** Source image shorter-side threshold: below this -> use lower tier */
  resolutionThreshold?: number;
}

export const LTX23_DISTILLED_MODEL_IDS: Record<Ltx23Workflow, string> = {
  t2v: "ltx23-22b-fp8_t2v_distilled",
  i2v: "ltx23-22b-fp8_i2v_distilled",
  a2v: "ltx23-22b-fp8_a2v_distilled",
  ia2v: "ltx23-22b-fp8_ia2v_distilled",
};

export const LTX23_DEV_MODEL_IDS: Record<Ltx23Workflow, string> = {
  t2v: "ltx23-22b-fp8_t2v_dev",
  i2v: "ltx23-22b-fp8_i2v_dev",
  a2v: "ltx23-22b-fp8_a2v_dev",
  ia2v: "ltx23-22b-fp8_ia2v_dev",
};

export function getLtx23WorkflowModelIdForQuality(
  workflow: Ltx23Workflow,
  qualityTier: VideoQualityTier | undefined = "fast",
): string {
  return qualityTier === "pro"
    ? LTX23_DEV_MODEL_IDS[workflow]
    : LTX23_DISTILLED_MODEL_IDS[workflow];
}

export function getLtx23ModelNameForQuality(
  workflowName: string,
  qualityTier: VideoQualityTier | undefined = "fast",
): string {
  return qualityTier === "pro"
    ? `LTX 2.3 22B ${workflowName} Dev`
    : `LTX 2.3 22B ${workflowName} Distilled`;
}

export function getLtx23StepsForQuality(
  qualityTier: VideoQualityTier | undefined = "fast",
): number {
  return qualityTier === "pro" ? 20 : 8;
}

export const VIDEO_MODEL_CONFIGS: Record<VideoModelId, VideoModelConfig> = {
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
  // Seedance 2.0 routes through Sogni Socket's vendor-job path to BytePlus.
  // The socket re-derives ratio from width/height and duration from
  // frames/fps for vendor models, so we use permissive constraints here
  // (dimensionDivisor: 1, generous min/max). The mapped SDK model ID is
  // the canonical Seedance socket tier.
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

/** Switch this to change the default video model everywhere */
export const DEFAULT_VIDEO_MODEL: VideoModelId = "ltx23";

// ============================================================================
// Derived Convenience Exports (use default model)
// ============================================================================

export function getVideoModelConfig(
  modelId: VideoModelId = DEFAULT_VIDEO_MODEL,
  qualityTier: VideoQualityTier | undefined = "fast",
): VideoModelConfig {
  const config = VIDEO_MODEL_CONFIGS[modelId];
  if (modelId !== "ltx23") return config;
  return {
    ...config,
    model: getLtx23WorkflowModelIdForQuality("i2v", qualityTier),
    steps: getLtx23StepsForQuality(qualityTier),
  };
}

/** Backward-compatible VIDEO_CONFIG using the default model */
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
} as const;

export type VideoQualityPreset = keyof typeof VIDEO_QUALITY_PRESETS;

// ============================================================================
// Dimension & Frame Calculations
// ============================================================================

export function calculateVideoDimensions(
  imageWidth: number,
  imageHeight: number,
  targetResolution?: number,
  modelId: VideoModelId = DEFAULT_VIDEO_MODEL,
  aspectRatio?: string,
): { width: number; height: number } {
  const config = VIDEO_MODEL_CONFIGS[modelId];
  const divisor = config.dimensionDivisor;
  const minDim = config.minDimension;
  const maxDim = config.maxDimension;

  // Aspect ratio override -- compute effective source dimensions from the target ratio
  const parsed = parseAspectRatio(aspectRatio);
  let effectiveW = imageWidth;
  let effectiveH = imageHeight;

  if (parsed?.type === "exact") {
    effectiveW = parsed.width;
    effectiveH = parsed.height;
  } else if (parsed?.type === "ratio") {
    // Preserve approximate pixel area while adopting the new ratio
    const srcArea = imageWidth * imageHeight;
    const ratio = parsed.ratioW / parsed.ratioH;
    effectiveW = Math.sqrt(srcArea * ratio);
    effectiveH = srcArea / effectiveW;
  }

  // Resolution tier logic: snap shorter side to a fixed tier (e.g. LTX 2.3: 1088 or 768)
  if (
    parsed?.type !== "exact" &&
    config.resolutionTiers &&
    config.resolutionTiers.length > 0 &&
    targetResolution === undefined
  ) {
    const srcShorter = Math.min(effectiveW, effectiveH);
    const threshold =
      config.resolutionThreshold ??
      config.resolutionTiers[config.resolutionTiers.length - 1];
    // Pick tier: use highest tier unless source is below threshold
    const tier =
      srcShorter < threshold
        ? config.resolutionTiers[config.resolutionTiers.length - 1] // lower tier (768)
        : config.resolutionTiers[0]; // higher tier (1088)

    let w: number, h: number;
    if (effectiveW <= effectiveH) {
      w = tier;
      h = Math.round((effectiveH * tier) / effectiveW / divisor) * divisor;
    } else {
      h = tier;
      w = Math.round((effectiveW * tier) / effectiveH / divisor) * divisor;
    }

    // Clamp longer side to maxDimension
    w = Math.min(maxDim, w);
    h = Math.min(maxDim, h);

    return { width: w, height: h };
  }

  // General logic for models without resolution tiers (WAN 2.2)
  let w = effectiveW;
  let h = effectiveH;

  // If a target resolution is specified, set the shorter side to it
  if (targetResolution !== undefined) {
    const roundedTarget = Math.round(targetResolution / divisor) * divisor;
    if (w <= h) {
      h = Math.round((h * roundedTarget) / w / divisor) * divisor;
      w = roundedTarget;
    } else {
      w = Math.round((w * roundedTarget) / h / divisor) * divisor;
      h = roundedTarget;
    }
  }

  // Scale down proportionally if the larger dimension exceeds max
  const larger = Math.max(w, h);
  if (larger > maxDim) {
    const scale = maxDim / larger;
    w *= scale;
    h *= scale;
  }

  // Scale up proportionally if the smaller dimension is below min
  const smaller = Math.min(w, h);
  if (smaller < minDim) {
    const scale = minDim / smaller;
    w *= scale;
    h *= scale;
  }

  // Round to nearest divisor
  w = Math.round(w / divisor) * divisor;
  h = Math.round(h / divisor) * divisor;

  // Final clamp
  w = Math.max(minDim, Math.min(maxDim, w));
  h = Math.max(minDim, Math.min(maxDim, h));

  return { width: w, height: h };
}

export function calculateVideoFrames(
  duration: number = 5,
  modelId: VideoModelId = DEFAULT_VIDEO_MODEL,
  qualityTier: VideoQualityTier | undefined = "fast",
): number {
  const config = getVideoModelConfig(modelId, qualityTier);
  // Use the native generation fps for frame counts. For WAN, output `fps` is
  // the interpolated playback rate while `internalFps` (16) is what the model
  // actually generates — counting frames against the output fps would double
  // the request beyond the worker's frame budget.
  const generationFps = config.internalFps ?? config.fps;
  // LTX 2.3 frames must satisfy (frames - 1) % 8 === 0
  // WAN 2.2 uses same formula for compatibility
  const rawFrames = generationFps * duration + 1;
  return Math.round((rawFrames - 1) / 8) * 8 + 1;
}
