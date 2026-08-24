/**
 * Unit tests for SEEDANCE_REFERENCE_LIMITS, SeedanceReferenceLimitError, and
 * validateSeedanceReferenceCounts().
 */
import {
  SEEDANCE_REFERENCE_LIMITS,
  SEEDANCE_REFERENCE_LIMITS_BY_MODEL,
  getSeedanceReferenceLimits,
  SeedanceReferenceLimitError,
  validateSeedanceReferenceCounts,
} from '../src/tools/index';

let testsPassed = 0;
let testsFailed = 0;

function expect<T>(label: string, actual: T, expected: T) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`✅ PASS: ${label}`);
    testsPassed++;
  } else {
    console.error(`❌ FAIL: ${label}`);
    console.error(`   expected: ${JSON.stringify(expected)}`);
    console.error(`   actual:   ${JSON.stringify(actual)}`);
    testsFailed++;
  }
}

function expectThrows(
  label: string,
  fn: () => void,
  predicate: (err: unknown) => boolean,
) {
  try {
    fn();
    console.error(`❌ FAIL: ${label} — expected throw, got none`);
    testsFailed++;
  } catch (err) {
    if (predicate(err)) {
      console.log(`✅ PASS: ${label}`);
      testsPassed++;
    } else {
      console.error(`❌ FAIL: ${label} — wrong error shape: ${(err as Error)?.message}`);
      testsFailed++;
    }
  }
}

export function runSeedanceReferencesTests(): { passed: number; failed: number } {
  console.log('\n🧪 seedance reference limits\n');

  // Constants from protocol catalog
  expect(
    'SEEDANCE_REFERENCE_LIMITS.images = 9',
    SEEDANCE_REFERENCE_LIMITS.images,
    9,
  );
  expect(
    'SEEDANCE_REFERENCE_LIMITS.videos = 3',
    SEEDANCE_REFERENCE_LIMITS.videos,
    3,
  );
  expect(
    'SEEDANCE_REFERENCE_LIMITS.audios = 3',
    SEEDANCE_REFERENCE_LIMITS.audios,
    3,
  );
  expect(
    'SEEDANCE_REFERENCE_LIMITS.assets = 12',
    SEEDANCE_REFERENCE_LIMITS.assets,
    12,
  );

  // Within limits
  expect(
    'validate: 0/0/0 ok',
    (() => { validateSeedanceReferenceCounts({ images: 0, videos: 0, audios: 0 }); return 'ok'; })(),
    'ok',
  );
  expect(
    'validate: at-cap 9/3/0 ok',
    (() => { validateSeedanceReferenceCounts({ images: 9, videos: 3, audios: 0 }); return 'ok'; })(),
    'ok',
  );
  expect(
    'validate: assets total 12 ok',
    (() => { validateSeedanceReferenceCounts({ images: 6, videos: 3, audios: 3 }); return 'ok'; })(),
    'ok',
  );

  // Per-modality overflow
  expectThrows(
    'validate: 10 images throws images limit error',
    () => validateSeedanceReferenceCounts({ images: 10, videos: 0, audios: 0 }),
    (err) => err instanceof SeedanceReferenceLimitError
      && err.limitKind === 'images'
      && err.requestedCount === 10
      && err.maxCount === 9
      && err.code === 'seedance_reference_limit_exceeded',
  );
  expectThrows(
    'validate: 4 videos throws videos limit error',
    () => validateSeedanceReferenceCounts({ images: 0, videos: 4, audios: 0 }),
    (err) => err instanceof SeedanceReferenceLimitError && err.limitKind === 'videos',
  );
  expectThrows(
    'validate: 4 audios throws audios limit error',
    () => validateSeedanceReferenceCounts({ images: 0, videos: 0, audios: 4 }),
    (err) => err instanceof SeedanceReferenceLimitError && err.limitKind === 'audios',
  );

  // Combined-total overflow (per-modality OK)
  expectThrows(
    'validate: 9 images + 3 videos + 1 audio = 13 throws assets limit error',
    () => validateSeedanceReferenceCounts({ images: 9, videos: 3, audios: 1 }),
    (err) => err instanceof SeedanceReferenceLimitError
      && err.limitKind === 'assets'
      && err.requestedCount === 13
      && err.maxCount === 12,
  );

  // Per-modality check fires before total check
  expectThrows(
    'validate: 10 images + 3 videos + 3 audios throws images error (not assets)',
    () => validateSeedanceReferenceCounts({ images: 10, videos: 3, audios: 3 }),
    (err) => err instanceof SeedanceReferenceLimitError && err.limitKind === 'images',
  );

  // Error message text matches sogni-chat contract
  expectThrows(
    'error message format includes "Seedance can use up to N ... per video"',
    () => validateSeedanceReferenceCounts({ images: 12, videos: 0, audios: 0 }),
    (err) => err instanceof SeedanceReferenceLimitError
      && /^Seedance can use up to 9 image references per video; this request included 12\. /.test(err.message)
      && /No media was generated\. Please choose fewer references or split the story into multiple clips\.$/.test(err.message),
  );
  expectThrows(
    'error message labels "total references" for assets cap',
    () => validateSeedanceReferenceCounts({ images: 9, videos: 3, audios: 3 }),
    (err) => err instanceof SeedanceReferenceLimitError
      && /Seedance can use up to 12 total references per video; this request included 15\./.test(err.message),
  );

  // Per-model caps: Seedance 2.5 is NOT bounded by the 2.0 family numbers.
  expect(
    'per-model: seedance-2-0 is 9/3/3/12',
    getSeedanceReferenceLimits('seedance-2-0'),
    { images: 9, videos: 3, audios: 3, assets: 12 },
  );
  expect(
    'per-model: seedance-2-0-mini is 9/3/3/12',
    getSeedanceReferenceLimits('seedance-2-0-mini'),
    { images: 9, videos: 3, audios: 3, assets: 12 },
  );
  expect(
    'legacy alias: retired seedance-2-0-fast resolves to the Mini caps (9/3/3/12)',
    getSeedanceReferenceLimits('seedance-2-0-fast'),
    { images: 9, videos: 3, audios: 3, assets: 12 },
  );
  expect(
    'per-model: seedance-2-5 is 30/10/10/50',
    getSeedanceReferenceLimits('seedance-2-5'),
    { images: 30, videos: 10, audios: 10, assets: 50 },
  );
  expectThrows(
    'per-model: unknown model throws instead of defaulting',
    () => getSeedanceReferenceLimits('seedance-9-9'),
    (err) => err instanceof Error && /No Seedance reference limits are defined/.test(err.message),
  );

  // A 2.5 request that would be rejected under the 2.0 caps must pass.
  expect(
    'validate: 20/5/5 ok on seedance-2-5',
    (() => {
      validateSeedanceReferenceCounts({ images: 20, videos: 5, audios: 5 }, 'seedance-2-5');
      return 'ok';
    })(),
    'ok',
  );
  expect(
    'validate: at-cap 30/0/0 ok on seedance-2-5',
    (() => {
      validateSeedanceReferenceCounts({ images: 30, videos: 0, audios: 0 }, 'seedance-2-5');
      return 'ok';
    })(),
    'ok',
  );
  expect(
    'validate: all per-modality caps totaling 50 are valid on seedance-2-5',
    (() => {
      validateSeedanceReferenceCounts({ images: 30, videos: 10, audios: 10 }, 'seedance-2-5');
      return 'ok';
    })(),
    'ok',
  );
  expectThrows(
    'validate: 31 images rejected on seedance-2-5',
    () => validateSeedanceReferenceCounts({ images: 31, videos: 0, audios: 0 }, 'seedance-2-5'),
    (err) => err instanceof SeedanceReferenceLimitError && err.maxCount === 30,
  );
  expectThrows(
    'validate: 10 images still rejected on seedance-2-0',
    () => validateSeedanceReferenceCounts({ images: 10, videos: 0, audios: 0 }, 'seedance-2-0'),
    (err) => err instanceof SeedanceReferenceLimitError && err.maxCount === 9,
  );

  // Constants are frozen
  expect(
    'SEEDANCE_REFERENCE_LIMITS is frozen',
    Object.isFrozen(SEEDANCE_REFERENCE_LIMITS),
    true,
  );
  expect(
    'SEEDANCE_REFERENCE_LIMITS_BY_MODEL is frozen',
    Object.isFrozen(SEEDANCE_REFERENCE_LIMITS_BY_MODEL),
    true,
  );

  console.log(`\nseedance references: ${testsPassed} passed, ${testsFailed} failed`);
  return { passed: testsPassed, failed: testsFailed };
}
