/**
 * Explicit Seedance model registry.
 *
 * Model capabilities must be added deliberately. Prefix matching would make an
 * unknown future SKU inherit today's duration, reference, FPS, storyboard, and
 * prompt contracts before that SKU has been integrated or validated.
 */
export const SEEDANCE_VIDEO_MODEL_IDS = Object.freeze({
  standard: 'seedance-2-0',
  mini: 'seedance-2-0-mini',
  v25: 'seedance-2-5',
} as const);

export type SeedanceVideoModelId =
  (typeof SEEDANCE_VIDEO_MODEL_IDS)[keyof typeof SEEDANCE_VIDEO_MODEL_IDS];

const SEEDANCE_VIDEO_MODEL_ID_SET: ReadonlySet<string> = new Set(
  Object.values(SEEDANCE_VIDEO_MODEL_IDS),
);

const SEEDANCE_VIDEO_MODEL_ALIASES: Readonly<Record<string, SeedanceVideoModelId>> =
  Object.freeze({
    // Public skill selectors are explicit aliases for the same three vendor
    // contracts. Keep this list aligned with VIDEO_MODEL_ALIASES; do not
    // replace it with a Seedance prefix match.
    seedance2: SEEDANCE_VIDEO_MODEL_IDS.standard,
    'seedance2-t2v': SEEDANCE_VIDEO_MODEL_IDS.standard,
    'seedance2-ia2v': SEEDANCE_VIDEO_MODEL_IDS.standard,
    'seedance2-v2v': SEEDANCE_VIDEO_MODEL_IDS.standard,
    'seedance2-mini': SEEDANCE_VIDEO_MODEL_IDS.mini,
    'seedance2-mini-t2v': SEEDANCE_VIDEO_MODEL_IDS.mini,
    'seedance2-5': SEEDANCE_VIDEO_MODEL_IDS.v25,
    'seedance2-5-t2v': SEEDANCE_VIDEO_MODEL_IDS.v25,
    'seedance2-5-ia2v': SEEDANCE_VIDEO_MODEL_IDS.v25,
    'seedance2-5-v2v': SEEDANCE_VIDEO_MODEL_IDS.v25,
    // Retired backend id retained as an explicit compatibility alias. Mini is
    // its supported replacement; this is not a family-prefix fallback.
    'seedance-2-0-fast': SEEDANCE_VIDEO_MODEL_IDS.mini,
    'seedance2-fast': SEEDANCE_VIDEO_MODEL_IDS.mini,
    'seedance2-fast-t2v': SEEDANCE_VIDEO_MODEL_IDS.mini,
  });

export function resolveSeedanceVideoModelId(
  modelId: string | null | undefined,
): SeedanceVideoModelId | null {
  if (!modelId) return null;
  const normalized = modelId.trim().toLowerCase();
  if (SEEDANCE_VIDEO_MODEL_ID_SET.has(normalized)) {
    return normalized as SeedanceVideoModelId;
  }
  return SEEDANCE_VIDEO_MODEL_ALIASES[normalized] ?? null;
}

export function isSeedanceVideoModelId(modelId: string | null | undefined): boolean {
  return resolveSeedanceVideoModelId(modelId) !== null;
}

export function isSeedance25VideoModelId(modelId: string | null | undefined): boolean {
  return resolveSeedanceVideoModelId(modelId) === SEEDANCE_VIDEO_MODEL_IDS.v25;
}
