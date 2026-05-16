import { parseAspectRatio } from './imageDimensions.js';

export interface GenerationJobDetail {
  label: string;
  value: string;
}

export type GenerationMediaKind = 'image' | 'video' | 'audio';
export type GenerationDimensionMode = 'current' | 'dimensions' | 'aspect_ratio' | 'target_resolution';
export type GenerationQualityTier = 'fast' | 'hq' | 'pro';
export type GenerationModelArgKey = 'model' | 'videoModel' | 'quality';

export interface GenerationJobOption {
  value: string;
  label: string;
}

export interface GenerationJobEditableSettings {
  toolName: string;
  mediaKind: GenerationMediaKind;
  qualityTier?: GenerationQualityTier;
  qualityOptions?: GenerationQualityTier[];
  modelKey?: string;
  modelArgKey?: GenerationModelArgKey;
  modelOptions?: GenerationJobOption[];
  width?: number;
  height?: number;
  aspectRatio?: string;
  targetResolution?: number;
  targetResolutionOptions?: number[];
  allowQuality?: boolean;
  allowModel?: boolean;
  allowDimensions?: boolean;
  allowAspectRatio?: boolean;
  allowTargetResolution?: boolean;
  estimate?: (overrides: GenerationJobOverrides | undefined) => Promise<GenerationJobEstimate>;
}

export interface GenerationJobOverrides {
  qualityTier?: GenerationQualityTier;
  modelKey?: string;
  dimensionMode?: GenerationDimensionMode;
  width?: number;
  height?: number;
  aspectRatio?: string;
  targetResolution?: number;
}

export interface GenerationCostConfirmResult {
  confirmed: boolean;
  action?: 'confirm' | 'apply_overrides';
  overrides?: GenerationJobOverrides;
  thresholdUsd?: number;
  dontAskAgainForSession?: boolean;
}

export type GenerationJobConfirmResult = GenerationCostConfirmResult;

/**
 * A renderable reference attached to a media-generation job. Producers
 * supply these so the confirmation popup can show the user thumbnails of
 * the source / context media being fed to the model. The modal renders
 * <img> for images, a metadata-preview <video> for video, and a styled
 * non-image tile for audio.
 */
export interface GenerationJobReference {
  /** Renderable URL (http(s) or data:). For audio refs, the URL is
   *  retained for completeness but the modal does not play it back. */
  url: string;
  /** Short caption shown beneath / on hover (e.g. "Source",
   *  "Persona: Mira", "End frame", "Reference 1"). */
  label?: string;
  /** Drives icon overlay and tile style. Defaults to 'image' when omitted. */
  kind?: 'image' | 'video' | 'audio';
}

export interface GenerationJobSummary {
  mediaKind?: GenerationMediaKind;
  toolName?: string;
  model?: string;
  details?: GenerationJobDetail[];
  editable?: GenerationJobEditableSettings;
  /** One-line, present-tense, tool-authored description of what the job
   *  does. Rendered above the cost band when present. Producers must
   *  build this from runtime-resolved settings, never hardcoded vendor
   *  names — see docs/superpowers/specs/2026-05-09-confirm-generation-context-design.md. */
  purpose?: string;
  /** Thumbnails of source / persona / context media. Order is meaningful;
   *  the producer decides priority. Modal renders nothing when absent. */
  references?: GenerationJobReference[];
  /** Composed / refined prompt at confirmation time. Modal renders a
   *  collapsed disclosure when present, nothing when absent. */
  prompt?: string;
}

export interface GenerationJobEstimate {
  estimatedTokens: number;
  estimatedUsd: number | null;
  jobSummary?: GenerationJobSummary;
}

export interface GenerationJobOverridesValidation {
  valid: boolean;
  message?: string;
}

export interface ApplyGenerationJobOverridesOptions {
  modelArgKey?: GenerationModelArgKey;
  qualityArgKey?: 'quality';
  clearModelArgOnQualityOverride?: boolean;
}

function normalizePositiveNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

function normalizeAspectRatio(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return parseAspectRatio(trimmed) ? trimmed : undefined;
}

export function validateGenerationJobOverrides(
  overrides: GenerationJobOverrides | undefined,
): GenerationJobOverridesValidation {
  if (!overrides) return { valid: true };

  if (overrides.dimensionMode === 'dimensions') {
    const width = normalizePositiveNumber(overrides.width);
    const height = normalizePositiveNumber(overrides.height);
    if (width === undefined || height === undefined) {
      return { valid: false, message: 'Enter both width and height before starting generation.' };
    }
  } else if (overrides.dimensionMode === 'aspect_ratio') {
    if (!normalizeAspectRatio(overrides.aspectRatio)) {
      return { valid: false, message: 'Choose or enter a valid aspect ratio before starting generation.' };
    }
  } else if (overrides.dimensionMode === 'target_resolution') {
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

export function applyGenerationJobOverridesToArgs(
  args: Record<string, unknown>,
  overrides: GenerationJobOverrides | undefined,
  options: ApplyGenerationJobOverridesOptions = {},
): Record<string, unknown> {
  if (!overrides) return args;

  const nextArgs: Record<string, unknown> = { ...args };

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
  } else if (overrides.dimensionMode === 'aspect_ratio') {
    const aspectRatio = normalizeAspectRatio(overrides.aspectRatio);
    if (aspectRatio) {
      nextArgs.aspectRatio = aspectRatio;
      delete nextArgs.width;
      delete nextArgs.height;
      delete nextArgs.targetResolution;
    }
  } else if (overrides.dimensionMode === 'target_resolution') {
    const targetResolution = normalizePositiveNumber(overrides.targetResolution);
    if (targetResolution !== undefined) {
      nextArgs.targetResolution = targetResolution;
      const aspectRatio = normalizeAspectRatio(overrides.aspectRatio);
      if (aspectRatio) nextArgs.aspectRatio = aspectRatio;
      delete nextArgs.width;
      delete nextArgs.height;
    }
  }

  return nextArgs;
}
