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
  perModel?: Record<string, SeedanceReferenceLimits>;
}

const catalog = seedanceReferenceLimitsCatalog as SeedanceReferenceLimitsCatalogShape;

/**
 * Default caps. These are the Seedance 2.0-family numbers and remain the value
 * of this export for backwards compatibility. Prefer
 * `getSeedanceReferenceLimits(modelId)` — the caps are NOT uniform across the
 * family and applying these to Seedance 2.5 under-permits it by a wide margin.
 */
export const SEEDANCE_REFERENCE_LIMITS: SeedanceReferenceLimits = Object.freeze(catalog.limits);

/**
 * Per-model caps, keyed by canonical Seedance model id. Sourced from the same
 * protocol catalog. Seedance 2.5 accepts 30 images / 10 videos / 10 audios with
 * 50 reference files total; the 2.0 family accepts 9 / 3 / 3 with 12 total.
 */
export const SEEDANCE_REFERENCE_LIMITS_BY_MODEL: Readonly<
  Record<string, SeedanceReferenceLimits>
> = Object.freeze(
  Object.fromEntries(
    Object.entries(catalog.perModel ?? {}).map(([modelId, limits]) => [
      modelId,
      Object.freeze({ ...limits }),
    ]),
  ),
);

/**
 * Resolve the caps for a canonical Seedance model id.
 *
 * Throws for an unknown model rather than silently falling back to the 2.0
 * numbers: a wrong cap either rejects a valid request or lets an invalid one
 * reach the vendor, and both are worse than a loud failure.
 */
export function getSeedanceReferenceLimits(modelId: string): SeedanceReferenceLimits {
  // legacy alias: Seedance 2.0 Fast was retired 2026-08; Mini replaced it
  const canonicalModelId = modelId === 'seedance-2-0-fast' ? 'seedance-2-0-mini' : modelId;
  const limits = SEEDANCE_REFERENCE_LIMITS_BY_MODEL[canonicalModelId];
  if (!limits) {
    throw new Error(
      `No Seedance reference limits are defined for model "${modelId}". ` +
      'Add it to catalogs/seedance-reference-limits.json in @sogni-ai/sogni-protocol.',
    );
  }
  return limits;
}

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
 *
 * `modelId` selects the per-model caps. It is optional only so existing
 * callers keep compiling; omitting it applies the conservative Seedance 2.0
 * numbers and will under-permit a Seedance 2.5 request, so pass it.
 */
export function validateSeedanceReferenceCounts(
  counts: SeedanceReferenceCounts,
  modelId?: string,
): void {
  const limits = modelId ? getSeedanceReferenceLimits(modelId) : SEEDANCE_REFERENCE_LIMITS;
  const images = Math.max(0, Math.floor(counts.images));
  const videos = Math.max(0, Math.floor(counts.videos));
  const audios = Math.max(0, Math.floor(counts.audios));

  if (images > limits.images) {
    throw new SeedanceReferenceLimitError('images', images, limits.images);
  }
  if (videos > limits.videos) {
    throw new SeedanceReferenceLimitError('videos', videos, limits.videos);
  }
  if (audios > limits.audios) {
    throw new SeedanceReferenceLimitError('audios', audios, limits.audios);
  }
  const total = images + videos + audios;
  if (total > limits.assets) {
    throw new SeedanceReferenceLimitError('assets', total, limits.assets);
  }
}
