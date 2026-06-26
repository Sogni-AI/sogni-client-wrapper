/**
 * Alibaba HappyHorse 1.1 reference-input limits — single source of truth for
 * every consumer (skill CLI, browser chat orchestration, hosted runtime, future
 * non-JS SDKs). Sibling of `seedanceReferences.ts`.
 *
 * Unlike Seedance, HappyHorse limits are PER MODEL (mode), and HappyHorse does
 * NOT take loose video or audio references — its audio track is rendered
 * natively. The three modes are:
 *   - happyhorse-1.1-t2v  text-to-video, 0 image references
 *   - happyhorse-1.1-i2v  image-to-video, exactly 1 image (first_frame)
 *   - happyhorse-1.1-r2v  reference-to-video, up to 9 images (reference_image)
 *
 * These numbers are not sourced from `@sogni-ai/sogni-protocol` (which only
 * carries the Seedance catalog today); they are encoded directly here and are
 * the contract creative-agent/chat/skill import.
 */

export interface HappyHorseReferenceLimits {
  readonly images: number;
  readonly videos: number;
  readonly audios: number;
  /** Combined cap across all modalities (equals `images` since videos/audios are 0). */
  readonly assets: number;
}

export const HAPPYHORSE_REFERENCE_LIMITS: Readonly<Record<string, HappyHorseReferenceLimits>> =
  Object.freeze({
    'happyhorse-1.1-t2v': Object.freeze({ images: 0, videos: 0, audios: 0, assets: 0 }),
    'happyhorse-1.1-i2v': Object.freeze({ images: 1, videos: 0, audios: 0, assets: 1 }),
    'happyhorse-1.1-r2v': Object.freeze({ images: 9, videos: 0, audios: 0, assets: 9 }),
  });

export type HappyHorseReferenceLimitKind = keyof HappyHorseReferenceLimits;

/**
 * Resolve the reference limits for a HappyHorse model id. Returns `null` for a
 * non-HappyHorse or unknown id so callers can fall through to other vendors.
 */
export function getHappyHorseReferenceLimits(
  modelId: string | null | undefined,
): HappyHorseReferenceLimits | null {
  if (!modelId) return null;
  return HAPPYHORSE_REFERENCE_LIMITS[modelId] ?? null;
}

export class HappyHorseReferenceLimitError extends Error {
  readonly code = 'happyhorse_reference_limit_exceeded' as const;
  readonly modelId: string;
  readonly limitKind: HappyHorseReferenceLimitKind;
  readonly requestedCount: number;
  readonly maxCount: number;

  constructor(
    modelId: string,
    limitKind: HappyHorseReferenceLimitKind,
    requestedCount: number,
    maxCount: number,
  ) {
    const label = limitKind === 'assets' ? 'total references' : `${limitKind.slice(0, -1)} references`;
    super(
      `HappyHorse (${modelId}) can use up to ${maxCount} ${label} per video; this request included ${requestedCount}. ` +
      'No media was generated. Please choose fewer references or split the story into multiple clips.',
    );
    this.name = 'HappyHorseReferenceLimitError';
    this.modelId = modelId;
    this.limitKind = limitKind;
    this.requestedCount = requestedCount;
    this.maxCount = maxCount;
  }
}

export interface HappyHorseReferenceCounts {
  readonly images: number;
  readonly videos: number;
  readonly audios: number;
}

/**
 * Throws `HappyHorseReferenceLimitError` on the FIRST violated cap for the given
 * model, checking per-modality limits before the combined-total cap. Pass
 * concrete counts; candidate-collection logic is the caller's responsibility.
 * Throws on an unknown HappyHorse model id rather than silently passing.
 */
export function validateHappyHorseReferenceCounts(
  modelId: string,
  counts: HappyHorseReferenceCounts,
): void {
  const limits = HAPPYHORSE_REFERENCE_LIMITS[modelId];
  if (!limits) {
    throw new HappyHorseReferenceLimitError(modelId, 'assets', 0, 0);
  }

  const images = Math.max(0, Math.floor(counts.images));
  const videos = Math.max(0, Math.floor(counts.videos));
  const audios = Math.max(0, Math.floor(counts.audios));

  if (images > limits.images) {
    throw new HappyHorseReferenceLimitError(modelId, 'images', images, limits.images);
  }
  if (videos > limits.videos) {
    throw new HappyHorseReferenceLimitError(modelId, 'videos', videos, limits.videos);
  }
  if (audios > limits.audios) {
    throw new HappyHorseReferenceLimitError(modelId, 'audios', audios, limits.audios);
  }
  const total = images + videos + audios;
  if (total > limits.assets) {
    throw new HappyHorseReferenceLimitError(modelId, 'assets', total, limits.assets);
  }
}
