export interface ExplicitSeedanceAudioWindow {
  startOffsetSeconds: number;
  maxDurationSeconds: number;
}

const TIME_TOKEN_PATTERN = String.raw`(?:(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:seconds?|secs?|sec|s)\b)`;
const AUDIO_WINDOW_CONTEXT_PATTERN = /\b(?:audio file|uploaded audio|attached audio|reference audio|music clip|song clip|soundtrack|background music|music track|music)\b/i;

export function parseExplicitTimeTokenSeconds(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map(part => Number(part));
    if (parts.length < 2 || parts.length > 3 || parts.some(part => !Number.isFinite(part) || part < 0)) {
      return null;
    }
    const seconds = parts.length === 3
      ? (parts[0] * 3600) + (parts[1] * 60) + parts[2]
      : (parts[0] * 60) + parts[1];
    return Number.isFinite(seconds) ? seconds : null;
  }

  const numeric = Number(trimmed.replace(/\s*(?:seconds?|secs?|sec|s)\b/i, ''));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

export function inferExplicitSeedanceAudioWindow(text: string): ExplicitSeedanceAudioWindow | null {
  if (!AUDIO_WINDOW_CONTEXT_PATTERN.test(text)) return null;

  const rangePattern = new RegExp(
    `(${TIME_TOKEN_PATTERN})\\s*(?:-|–|—|to|through|until)\\s*(${TIME_TOKEN_PATTERN})`,
    'ig',
  );
  for (const match of text.matchAll(rangePattern)) {
    const index = match.index ?? 0;
    const contextSnippet = text.slice(Math.max(0, index - 180), Math.min(text.length, index + 220));
    if (!AUDIO_WINDOW_CONTEXT_PATTERN.test(contextSnippet)) continue;

    const start = parseExplicitTimeTokenSeconds(match[1] || '');
    const end = parseExplicitTimeTokenSeconds(match[2] || '');
    if (start === null || end === null || end <= start) continue;

    return {
      startOffsetSeconds: Math.round(start * 1000) / 1000,
      maxDurationSeconds: Math.round((end - start) * 1000) / 1000,
    };
  }

  return null;
}

export function applyExplicitSeedanceAudioWindowArgs(
  args: Record<string, unknown>,
  intentText: string,
): boolean {
  const window = inferExplicitSeedanceAudioWindow(intentText);
  if (!window) return false;
  args.__seedanceReferenceAudioStartOffsetSeconds = window.startOffsetSeconds;
  args.__seedanceReferenceAudioMaxDurationSeconds = window.maxDurationSeconds;
  args.__seedanceReferenceAudioWindowIsExplicit = true;
  return true;
}
