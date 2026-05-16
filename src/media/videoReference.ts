export const SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS = 15;
const TRIM_TOLERANCE_SECONDS = 0.15;

export interface PreparedReferenceVideo {
  data: Uint8Array;
  mimeType: string;
  sourceDuration: number | null;
  trimmed: boolean;
  trimStart: number;
  trimDuration: number | null;
}

export interface ReferenceVideoTrimRequest {
  data: Uint8Array;
  filename: string;
  inputMimeType: string;
  start: number;
  duration: number;
  sourceDuration: number | null;
  requestedDuration: number | null;
}

export interface ReferenceVideoTrimResult {
  data: Uint8Array;
  mimeType?: string | null;
}

export type ReferenceVideoTrimmer = (
  request: ReferenceVideoTrimRequest,
) => Promise<ReferenceVideoTrimResult>;

export interface PrepareSeedanceV2VSourceVideoOptions {
  trimVideo?: ReferenceVideoTrimmer;
}

export interface ShouldTrimSeedanceV2VSourceVideoInput {
  sourceDurationSeconds?: number | null;
  requestedDurationSeconds?: number | null;
  startOffsetSeconds?: number | null;
  maxDurationSeconds?: number;
}

function normalizeReferenceVideoMimeType(mimeType?: string | null): string {
  const trimmed = mimeType?.split(';')[0]?.trim().toLowerCase();
  return trimmed || 'application/octet-stream';
}

function finiteNonNegative(value: number | null | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

export function shouldTrimSeedanceV2VSourceVideo({
  sourceDurationSeconds,
  requestedDurationSeconds,
  startOffsetSeconds = 0,
  maxDurationSeconds = SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS,
}: ShouldTrimSeedanceV2VSourceVideoInput): boolean {
  const maxDuration = finiteNonNegative(maxDurationSeconds, SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS)
    || SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS;
  const sourceDuration = finiteNonNegative(sourceDurationSeconds, Number.NaN);
  const requestedDuration = finiteNonNegative(requestedDurationSeconds, maxDuration);
  const startOffset = finiteNonNegative(startOffsetSeconds, 0);
  if (startOffset > 0) return true;
  const effectiveDuration = Math.min(requestedDuration || maxDuration, maxDuration);
  return Number.isFinite(sourceDuration) && sourceDuration > effectiveDuration + TRIM_TOLERANCE_SECONDS;
}

export async function prepareSeedanceV2VSourceVideo(
  data: Uint8Array,
  mimeType?: string | null,
  filename = 'source-video.mp4',
  sourceDurationSeconds?: number | null,
  requestedDurationSeconds?: number | null,
  startOffsetSeconds = 0,
  options: PrepareSeedanceV2VSourceVideoOptions = {},
): Promise<PreparedReferenceVideo> {
  const normalizedMimeType = normalizeReferenceVideoMimeType(mimeType);
  const sourceDuration = Number.isFinite(Number(sourceDurationSeconds))
    ? Math.max(0, Number(sourceDurationSeconds))
    : null;
  const requestedDuration = Number.isFinite(Number(requestedDurationSeconds))
    ? Math.max(0, Number(requestedDurationSeconds))
    : null;
  const trimStart = finiteNonNegative(startOffsetSeconds, 0);
  const trimDuration = Math.min(
    requestedDuration && requestedDuration > 0
      ? requestedDuration
      : SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS,
    SEEDANCE_V2V_REFERENCE_MAX_DURATION_SECONDS,
  );

  if (!shouldTrimSeedanceV2VSourceVideo({
    sourceDurationSeconds: sourceDuration,
    requestedDurationSeconds: requestedDuration,
    startOffsetSeconds: trimStart,
  })) {
    return {
      data,
      mimeType: normalizedMimeType,
      sourceDuration,
      trimmed: false,
      trimStart: 0,
      trimDuration: null,
    };
  }

  if (!options.trimVideo) {
    throw new Error('Seedance 2.0 video-to-video references must be trimmed through a host adapter.');
  }

  const result = await options.trimVideo({
    data,
    filename,
    inputMimeType: normalizedMimeType,
    start: trimStart,
    duration: trimDuration,
    sourceDuration,
    requestedDuration,
  });
  if (!(result.data instanceof Uint8Array) || result.data.length === 0) {
    throw new Error('Seedance 2.0 source video trim did not return media bytes.');
  }

  return {
    data: result.data,
    mimeType: normalizeReferenceVideoMimeType(result.mimeType || 'video/mp4'),
    sourceDuration,
    trimmed: true,
    trimStart,
    trimDuration,
  };
}
