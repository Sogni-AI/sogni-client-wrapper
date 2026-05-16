export const MAX_GENERATED_VIDEO_CONTENT_SECONDS = 20 * 60;
export const MAX_GENERATED_VIDEO_CONTENT_MINUTES = MAX_GENERATED_VIDEO_CONTENT_SECONDS / 60;

export interface GeneratedVideoContentEstimate {
  tool: string;
  seconds: number;
  field: string;
  outputCount?: number;
  perOutputDuration?: number;
  segmentCount?: number;
}

function coercePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function coercePositiveInteger(value: unknown): number | null {
  const numeric = coercePositiveNumber(value);
  if (numeric === null) return null;
  const rounded = Math.floor(numeric);
  return rounded > 0 ? rounded : null;
}

function sumPositiveDurations(values: unknown): { seconds: number; count: number } | null {
  if (!Array.isArray(values)) return null;
  const durations = values
    .map(coercePositiveNumber)
    .filter((duration): duration is number => duration !== null);
  if (durations.length === 0) return null;
  return {
    seconds: durations.reduce((sum, duration) => sum + duration, 0),
    count: durations.length,
  };
}

function estimateSeedanceLongVideoPlan(value: unknown): Omit<GeneratedVideoContentEstimate, 'tool'> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const plan = value as {
    totalDuration?: unknown;
    segmentDurations?: unknown;
    segments?: unknown;
  };

  const candidates: Array<{ seconds: number; field: string; segmentCount?: number }> = [];
  const totalDuration = coercePositiveNumber(plan.totalDuration);
  if (totalDuration !== null) {
    candidates.push({ seconds: totalDuration, field: '__seedanceLongVideoPlan.totalDuration' });
  }

  const segmentDurations = sumPositiveDurations(plan.segmentDurations);
  if (segmentDurations) {
    candidates.push({
      seconds: segmentDurations.seconds,
      field: '__seedanceLongVideoPlan.segmentDurations',
      segmentCount: segmentDurations.count,
    });
  }

  if (Array.isArray(plan.segments)) {
    const segmentSeconds = plan.segments
      .map((segment) => (
        segment && typeof segment === 'object' && !Array.isArray(segment)
          ? coercePositiveNumber((segment as { duration?: unknown }).duration)
          : null
      ))
      .filter((duration): duration is number => duration !== null);
    if (segmentSeconds.length > 0) {
      candidates.push({
        seconds: segmentSeconds.reduce((sum, duration) => sum + duration, 0),
        field: '__seedanceLongVideoPlan.segments[].duration',
        segmentCount: segmentSeconds.length,
      });
    }
  }

  candidates.sort((a, b) => b.seconds - a.seconds);
  const estimate = candidates[0];
  return estimate
    ? {
        seconds: estimate.seconds,
        field: estimate.field,
        ...(estimate.segmentCount ? { segmentCount: estimate.segmentCount } : {}),
      }
    : null;
}

function estimateSeedanceAudioSegments(value: unknown): Omit<GeneratedVideoContentEstimate, 'tool'> | null {
  if (!Array.isArray(value)) return null;
  const segmentSeconds = value
    .map((segment) => (
      segment && typeof segment === 'object' && !Array.isArray(segment)
        ? coercePositiveNumber((segment as { duration?: unknown }).duration)
        : null
    ))
    .filter((duration): duration is number => duration !== null);
  if (segmentSeconds.length === 0) return null;
  return {
    seconds: segmentSeconds.reduce((sum, duration) => sum + duration, 0),
    field: '__seedanceAudioSegments[].duration',
    segmentCount: segmentSeconds.length,
  };
}

function variationCount(args: Record<string, unknown>): number {
  return coercePositiveInteger(args.numberOfVariations) ?? 1;
}

function fanoutCount(args: Record<string, unknown>): number {
  const counts = [variationCount(args)];
  for (const key of ['sourceImageIndices', 'sourceVideoIndices', 'prompts', 'endImageIndices']) {
    const value = args[key];
    if (Array.isArray(value) && value.length > 0) counts.push(value.length);
  }
  return Math.max(...counts);
}

function estimateDurationTimesCount(
  tool: string,
  args: Record<string, unknown>,
  count: number,
): GeneratedVideoContentEstimate | null {
  const duration = coercePositiveNumber(args.duration);
  if (duration === null) return null;
  return {
    tool,
    seconds: duration * Math.max(1, count),
    field: count > 1 ? 'duration*count' : 'duration',
    outputCount: Math.max(1, count),
    perOutputDuration: duration,
  };
}

export function estimateGeneratedVideoContentSeconds(
  tool: string,
  args: Record<string, unknown>,
): GeneratedVideoContentEstimate | null {
  const requestedGeneratedSeconds = coercePositiveNumber(args.__requestedGeneratedVideoContentSeconds);
  if (requestedGeneratedSeconds !== null) {
    return {
      tool,
      seconds: requestedGeneratedSeconds,
      field: '__requestedGeneratedVideoContentSeconds',
    };
  }

  if (tool === 'generate_video') {
    const longVideoEstimate = estimateSeedanceLongVideoPlan(args.__seedanceLongVideoPlan);
    if (longVideoEstimate) return { tool, ...longVideoEstimate };
    return estimateDurationTimesCount(tool, args, variationCount(args));
  }

  if (tool === 'sound_to_video') {
    const audioSegmentEstimate = estimateSeedanceAudioSegments(args.__seedanceAudioSegments);
    if (audioSegmentEstimate) return { tool, ...audioSegmentEstimate };
    return estimateDurationTimesCount(tool, args, variationCount(args));
  }

  if (tool === 'animate_photo' || tool === 'video_to_video') {
    return estimateDurationTimesCount(tool, args, fanoutCount(args));
  }

  if (
    tool === 'dance_montage'
    || tool === 'orbit_video'
    || tool === 'extend_video'
    || tool === 'replace_video_segment'
  ) {
    return estimateDurationTimesCount(tool, args, 1);
  }

  return null;
}

export function generatedVideoContentExceedsLimit(
  estimate: GeneratedVideoContentEstimate | null,
): estimate is GeneratedVideoContentEstimate {
  return !!estimate && estimate.seconds > MAX_GENERATED_VIDEO_CONTENT_SECONDS;
}

export function formatVideoDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (minutes > 0 && remainder > 0) return `${minutes}m ${remainder}s`;
  if (minutes > 0) return `${minutes}m`;
  return `${rounded}s`;
}

export function formatGeneratedVideoContentLimitMessage(estimate: GeneratedVideoContentEstimate): string {
  return `This request would generate ${formatVideoDuration(estimate.seconds)} of video content, which exceeds the ${MAX_GENERATED_VIDEO_CONTENT_MINUTES}-minute safety limit. Ask the user for a shorter total duration of ${MAX_GENERATED_VIDEO_CONTENT_MINUTES} minutes or less.`;
}
