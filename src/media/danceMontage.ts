/** Shared duration and segmentation planning for the dance_montage tool. */

/** Max duration for a single WAN Animate Move clip. */
export const DANCE_MONTAGE_MAX_CLIP_DURATION_SECONDS = 20;

/** Max overall montage duration before the reference dance video is exhausted. */
export const DANCE_MONTAGE_MAX_DURATION_SECONDS = 30;

/** Preferred split size for longer dance montages. */
export const DANCE_MONTAGE_PREFERRED_SEGMENT_DURATION_SECONDS = 10;

/** Minimum segment duration; avoids creating unusably short clips. */
export const DANCE_MONTAGE_MIN_SEGMENT_DURATION_SECONDS = 5;

export interface DanceSegmentPlanInput {
  /** Requested total duration before clamping. */
  requestedDuration: number;
  /** Number of distinct source images to alternate across. */
  imageCount: number;
  /** Reference dance video length in seconds. Caps the montage. */
  presetMaxDuration: number;
  /** When true, force a single unsplit clip when duration allows. */
  singleClip?: boolean;
}

export interface DanceSegmentPlan {
  /** Final clamped total duration the montage will play for. */
  duration: number;
  /** Number of clips the montage will be split into. */
  segmentCount: number;
  /** Length of each clip in seconds. */
  segmentDuration: number;
}

export function normalizeDanceMontageDurationArg(requestedDuration: number | null): number | undefined {
  if (typeof requestedDuration !== 'number' || !Number.isFinite(requestedDuration)) return undefined;
  return Math.min(DANCE_MONTAGE_MAX_DURATION_SECONDS, Math.max(8, requestedDuration));
}

/**
 * Pure planning logic for dance montage segmenting.
 *
 * Shared so hosted workflows, tests, and chat all preserve the same duration
 * clamping and fan-out behavior.
 */
export function planDanceMontageSegments(input: DanceSegmentPlanInput): DanceSegmentPlan {
  const { imageCount, singleClip = false } = input;
  let duration = Math.min(
    input.requestedDuration,
    input.presetMaxDuration,
    DANCE_MONTAGE_MAX_DURATION_SECONDS,
  );

  let segmentCount: number;
  if (singleClip && duration <= DANCE_MONTAGE_MAX_CLIP_DURATION_SECONDS) {
    segmentCount = 1;
  } else {
    const minRequired = Math.max(
      imageCount,
      Math.ceil(duration / DANCE_MONTAGE_MAX_CLIP_DURATION_SECONDS),
    );
    const maxForMinDuration = Math.floor(duration / DANCE_MONTAGE_MIN_SEGMENT_DURATION_SECONDS);
    const preferredCount = Math.ceil(duration / DANCE_MONTAGE_PREFERRED_SEGMENT_DURATION_SECONDS);
    segmentCount = Math.min(maxForMinDuration, Math.max(minRequired, preferredCount));
    segmentCount = Math.max(segmentCount, minRequired);
  }

  let segmentDuration = Math.round((duration / segmentCount) * 4) / 4;
  segmentDuration = Math.max(
    DANCE_MONTAGE_MIN_SEGMENT_DURATION_SECONDS,
    Math.min(DANCE_MONTAGE_MAX_CLIP_DURATION_SECONDS, segmentDuration),
  );
  duration = segmentDuration * segmentCount;

  return { duration, segmentCount, segmentDuration };
}
