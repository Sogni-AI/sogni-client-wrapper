/**
 * Alibaba Wan 3 loose-reference limits shared by chat, hosted runtimes, and
 * CLI consumers. Native first/last-frame endpoints are a separate mode and
 * must not be mixed with these loose Image/Video/Audio references.
 */

export interface Wan3ReferenceLimits {
  readonly images: number;
  readonly videos: number;
  readonly audios: number;
  readonly files: number;
  readonly links: number;
}

export const WAN3_LOOSE_REFERENCE_LIMITS: Wan3ReferenceLimits = Object.freeze({
  images: 10,
  videos: 5,
  audios: 5,
  files: 1,
  links: 1,
});

export const WAN3_REFERENCE_DURATION_LIMITS = Object.freeze({
  minimum: 1,
  maximum: 15,
  totalMaximum: 15,
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
    const label = `${limitKind.slice(0, -1)} references`;
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

export class Wan3ReferenceDurationError extends Error {
  readonly code = 'wan3_reference_duration_invalid' as const;
  readonly modality: 'video' | 'audio';

  constructor(modality: 'video' | 'audio', message: string) {
    super(`Wan 3 reference ${modality} duration is invalid: ${message}`);
    this.name = 'Wan3ReferenceDurationError';
    this.modality = modality;
  }
}

export interface Wan3ReferenceCounts {
  readonly images: number;
  readonly videos: number;
  readonly audios: number;
  readonly files?: number;
  readonly links?: number;
}

/** Validate each official per-modality limit plus file/link exclusivity. */
export function validateWan3ReferenceCounts(counts: Wan3ReferenceCounts): void {
  const images = Math.max(0, Math.floor(counts.images));
  const videos = Math.max(0, Math.floor(counts.videos));
  const audios = Math.max(0, Math.floor(counts.audios));
  const files = Math.max(0, Math.floor(counts.files ?? 0));
  const links = Math.max(0, Math.floor(counts.links ?? 0));

  if (images > WAN3_LOOSE_REFERENCE_LIMITS.images) {
    throw new Wan3ReferenceLimitError('images', images, WAN3_LOOSE_REFERENCE_LIMITS.images);
  }
  if (videos > WAN3_LOOSE_REFERENCE_LIMITS.videos) {
    throw new Wan3ReferenceLimitError('videos', videos, WAN3_LOOSE_REFERENCE_LIMITS.videos);
  }
  if (audios > WAN3_LOOSE_REFERENCE_LIMITS.audios) {
    throw new Wan3ReferenceLimitError('audios', audios, WAN3_LOOSE_REFERENCE_LIMITS.audios);
  }

  if (files > WAN3_LOOSE_REFERENCE_LIMITS.files) {
    throw new Wan3ReferenceLimitError('files', files, WAN3_LOOSE_REFERENCE_LIMITS.files);
  }
  if (links > WAN3_LOOSE_REFERENCE_LIMITS.links) {
    throw new Wan3ReferenceLimitError('links', links, WAN3_LOOSE_REFERENCE_LIMITS.links);
  }
  if (files > 0 && links > 0) {
    throw new Error('Wan 3 accepts either one reference file or one reference link, not both.');
  }
}

/**
 * Validate every duration that is known before dispatch. URL-only references
 * may not have local metadata, so Alibaba remains the final authority for
 * those assets.
 */
export function validateWan3ReferenceDurations(
  modality: 'video' | 'audio',
  durations: ReadonlyArray<number | undefined>,
): void {
  const known = durations.filter(
    (duration): duration is number => typeof duration === 'number' && Number.isFinite(duration),
  );
  for (const duration of known) {
    if (
      duration < WAN3_REFERENCE_DURATION_LIMITS.minimum ||
      duration > WAN3_REFERENCE_DURATION_LIMITS.maximum
    ) {
      throw new Wan3ReferenceDurationError(
        modality,
        `each clip must be 1–15 seconds; received ${duration.toFixed(2)} seconds`,
      );
    }
  }
  const total = known.reduce((sum, duration) => sum + duration, 0);
  if (total > WAN3_REFERENCE_DURATION_LIMITS.totalMaximum) {
    throw new Wan3ReferenceDurationError(
      modality,
      `all clips together must be at most 15 seconds; received ${total.toFixed(2)} seconds`,
    );
  }
}
