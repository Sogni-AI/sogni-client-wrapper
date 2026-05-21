/**
 * Seedance 2.0 multimodal loose-reference limits — single source of truth for
 * every consumer (skill CLI, browser chat orchestration, hosted runtime, future
 * non-JS SDKs). The numeric caps come from `@sogni-ai/sogni-protocol`'s
 * `catalogs/seedance-reference-limits.json` (machine-readable; non-JS SDKs read
 * the same JSON); this module exposes the typed JS surface plus the canonical
 * error class and a pure validation helper.
 *
 * Why this file does NOT include sogni-chat's `ReferenceCandidate` /
 * `prepareSeedanceReferences` orchestration: those depend on chat-specific
 * `UploadedFile` / `ToolExecutionContext` types and are not portable. Only the
 * constants, error class, and pure counter helper belong in the shared SDK.
 */
import { seedanceReferenceLimitsCatalog } from './_catalogs.generated.js';

export interface SeedanceReferenceLimits {
  readonly images: number;
  readonly videos: number;
  readonly audios: number;
  readonly assets: number;
}

interface SeedanceReferenceLimitsCatalogShape {
  limits: SeedanceReferenceLimits;
}

export const SEEDANCE_REFERENCE_LIMITS: SeedanceReferenceLimits =
  Object.freeze((seedanceReferenceLimitsCatalog as SeedanceReferenceLimitsCatalogShape).limits);

export type SeedanceReferenceLimitKind = keyof SeedanceReferenceLimits;

export class SeedanceReferenceLimitError extends Error {
  readonly code = 'seedance_reference_limit_exceeded' as const;
  readonly limitKind: SeedanceReferenceLimitKind;
  readonly requestedCount: number;
  readonly maxCount: number;

  constructor(limitKind: SeedanceReferenceLimitKind, requestedCount: number, maxCount: number) {
    const label = limitKind === 'assets' ? 'total references' : `${limitKind.slice(0, -1)} references`;
    super(
      `Seedance can use up to ${maxCount} ${label} per video; this request included ${requestedCount}. ` +
      'No media was generated. Please choose fewer references or split the story into multiple clips.',
    );
    this.name = 'SeedanceReferenceLimitError';
    this.limitKind = limitKind;
    this.requestedCount = requestedCount;
    this.maxCount = maxCount;
  }
}

export interface SeedanceReferenceCounts {
  readonly images: number;
  readonly videos: number;
  readonly audios: number;
}

/**
 * Throws `SeedanceReferenceLimitError` on the FIRST violated cap, checking
 * per-modality limits before the combined-total cap. Pass concrete counts;
 * candidate-collection logic is the caller's responsibility.
 */
export function validateSeedanceReferenceCounts(counts: SeedanceReferenceCounts): void {
  const images = Math.max(0, Math.floor(counts.images));
  const videos = Math.max(0, Math.floor(counts.videos));
  const audios = Math.max(0, Math.floor(counts.audios));

  if (images > SEEDANCE_REFERENCE_LIMITS.images) {
    throw new SeedanceReferenceLimitError('images', images, SEEDANCE_REFERENCE_LIMITS.images);
  }
  if (videos > SEEDANCE_REFERENCE_LIMITS.videos) {
    throw new SeedanceReferenceLimitError('videos', videos, SEEDANCE_REFERENCE_LIMITS.videos);
  }
  if (audios > SEEDANCE_REFERENCE_LIMITS.audios) {
    throw new SeedanceReferenceLimitError('audios', audios, SEEDANCE_REFERENCE_LIMITS.audios);
  }
  const total = images + videos + audios;
  if (total > SEEDANCE_REFERENCE_LIMITS.assets) {
    throw new SeedanceReferenceLimitError('assets', total, SEEDANCE_REFERENCE_LIMITS.assets);
  }
}
