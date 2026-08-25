/**
 * Alibaba Wan 3 loose-reference limits shared by chat, hosted runtimes, and
 * CLI consumers. Native first/last-frame endpoints are a separate mode and
 * must not be mixed with these loose Image/Video/Audio references.
 */

export interface Wan3ReferenceLimits {
  readonly images: number;
  readonly videos: number;
  readonly audios: number;
  readonly assets: number;
}

export const WAN3_LOOSE_REFERENCE_LIMITS: Wan3ReferenceLimits = Object.freeze({
  images: 10,
  videos: 5,
  audios: 5,
  assets: 20,
});

export type Wan3ReferenceLimitKind = keyof Wan3ReferenceLimits;

export class Wan3ReferenceLimitError extends Error {
  readonly code = 'wan3_reference_limit_exceeded' as const;
  readonly limitKind: Wan3ReferenceLimitKind;
  readonly requestedCount: number;
  readonly maxCount: number;

  constructor(
    limitKind: Wan3ReferenceLimitKind,
    requestedCount: number,
    maxCount: number,
  ) {
    const label = limitKind === 'assets'
      ? 'total loose references'
      : `${limitKind.slice(0, -1)} references`;
    super(
      `Wan 3 can use up to ${maxCount} ${label} per video; this request included ${requestedCount}. ` +
      'No media was generated. Please choose fewer references or split the story into multiple clips.',
    );
    this.name = 'Wan3ReferenceLimitError';
    this.limitKind = limitKind;
    this.requestedCount = requestedCount;
    this.maxCount = maxCount;
  }
}

export interface Wan3ReferenceCounts {
  readonly images: number;
  readonly videos: number;
  readonly audios: number;
}

/** Validate per-modality limits before the combined loose-reference cap. */
export function validateWan3ReferenceCounts(counts: Wan3ReferenceCounts): void {
  const images = Math.max(0, Math.floor(counts.images));
  const videos = Math.max(0, Math.floor(counts.videos));
  const audios = Math.max(0, Math.floor(counts.audios));

  if (images > WAN3_LOOSE_REFERENCE_LIMITS.images) {
    throw new Wan3ReferenceLimitError('images', images, WAN3_LOOSE_REFERENCE_LIMITS.images);
  }
  if (videos > WAN3_LOOSE_REFERENCE_LIMITS.videos) {
    throw new Wan3ReferenceLimitError('videos', videos, WAN3_LOOSE_REFERENCE_LIMITS.videos);
  }
  if (audios > WAN3_LOOSE_REFERENCE_LIMITS.audios) {
    throw new Wan3ReferenceLimitError('audios', audios, WAN3_LOOSE_REFERENCE_LIMITS.audios);
  }

  const total = images + videos + audios;
  if (total > WAN3_LOOSE_REFERENCE_LIMITS.assets) {
    throw new Wan3ReferenceLimitError('assets', total, WAN3_LOOSE_REFERENCE_LIMITS.assets);
  }
}
