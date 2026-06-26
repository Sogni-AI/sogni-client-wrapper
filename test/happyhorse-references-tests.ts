/**
 * Unit tests for HAPPYHORSE_REFERENCE_LIMITS, HappyHorseReferenceLimitError,
 * getHappyHorseReferenceLimits(), and validateHappyHorseReferenceCounts().
 */
import {
  HAPPYHORSE_REFERENCE_LIMITS,
  HappyHorseReferenceLimitError,
  getHappyHorseReferenceLimits,
  validateHappyHorseReferenceCounts,
} from '../src/tools/index';
import {
  happyhorseTerminalGenerationFailurePayloadFromError,
  happyhorseTerminalPolicyPayloadFromError,
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

export function runHappyHorseReferencesTests(): { passed: number; failed: number } {
  console.log('\n🧪 HappyHorse reference limits\n');

  // Per-model limits
  expect('t2v images = 0', HAPPYHORSE_REFERENCE_LIMITS['happyhorse-1.1-t2v'].images, 0);
  expect('i2v images = 1', HAPPYHORSE_REFERENCE_LIMITS['happyhorse-1.1-i2v'].images, 1);
  expect('r2v images = 9', HAPPYHORSE_REFERENCE_LIMITS['happyhorse-1.1-r2v'].images, 9);
  expect('r2v videos = 0', HAPPYHORSE_REFERENCE_LIMITS['happyhorse-1.1-r2v'].videos, 0);
  expect('r2v audios = 0', HAPPYHORSE_REFERENCE_LIMITS['happyhorse-1.1-r2v'].audios, 0);

  expect(
    'getHappyHorseReferenceLimits(i2v).images = 1',
    getHappyHorseReferenceLimits('happyhorse-1.1-i2v')?.images,
    1,
  );
  expect(
    'getHappyHorseReferenceLimits(non-happyhorse) = null',
    getHappyHorseReferenceLimits('seedance-2-0'),
    null,
  );

  // Within limits
  expect(
    'validate r2v: 9/0/0 ok',
    (() => { validateHappyHorseReferenceCounts('happyhorse-1.1-r2v', { images: 9, videos: 0, audios: 0 }); return 'ok'; })(),
    'ok',
  );
  expect(
    'validate i2v: 1/0/0 ok',
    (() => { validateHappyHorseReferenceCounts('happyhorse-1.1-i2v', { images: 1, videos: 0, audios: 0 }); return 'ok'; })(),
    'ok',
  );
  expect(
    'validate t2v: 0/0/0 ok',
    (() => { validateHappyHorseReferenceCounts('happyhorse-1.1-t2v', { images: 0, videos: 0, audios: 0 }); return 'ok'; })(),
    'ok',
  );

  // Per-mode overflow
  expectThrows(
    'validate t2v: 1 image throws images limit error',
    () => validateHappyHorseReferenceCounts('happyhorse-1.1-t2v', { images: 1, videos: 0, audios: 0 }),
    (err) => err instanceof HappyHorseReferenceLimitError
      && err.limitKind === 'images'
      && err.maxCount === 0
      && err.code === 'happyhorse_reference_limit_exceeded',
  );
  expectThrows(
    'validate i2v: 2 images throws images limit error',
    () => validateHappyHorseReferenceCounts('happyhorse-1.1-i2v', { images: 2, videos: 0, audios: 0 }),
    (err) => err instanceof HappyHorseReferenceLimitError
      && err.limitKind === 'images'
      && err.requestedCount === 2
      && err.maxCount === 1,
  );
  expectThrows(
    'validate r2v: 10 images throws images limit error',
    () => validateHappyHorseReferenceCounts('happyhorse-1.1-r2v', { images: 10, videos: 0, audios: 0 }),
    (err) => err instanceof HappyHorseReferenceLimitError && err.limitKind === 'images' && err.maxCount === 9,
  );
  expectThrows(
    'validate r2v: any video reference throws videos limit error',
    () => validateHappyHorseReferenceCounts('happyhorse-1.1-r2v', { images: 0, videos: 1, audios: 0 }),
    (err) => err instanceof HappyHorseReferenceLimitError && err.limitKind === 'videos' && err.maxCount === 0,
  );
  expectThrows(
    'validate r2v: any audio reference throws audios limit error',
    () => validateHappyHorseReferenceCounts('happyhorse-1.1-r2v', { images: 0, videos: 0, audios: 1 }),
    (err) => err instanceof HappyHorseReferenceLimitError && err.limitKind === 'audios' && err.maxCount === 0,
  );

  // Unknown model id rejected
  expectThrows(
    'validate unknown model id throws',
    () => validateHappyHorseReferenceCounts('happyhorse-9.9-x2v', { images: 0, videos: 0, audios: 0 }),
    (err) => err instanceof HappyHorseReferenceLimitError,
  );

  // Limits frozen
  expect(
    'HAPPYHORSE_REFERENCE_LIMITS is frozen',
    Object.isFrozen(HAPPYHORSE_REFERENCE_LIMITS),
    true,
  );

  // Failure normalizer — verified live failure schema (output.code/output.message)
  const downloadFailure = happyhorseTerminalGenerationFailurePayloadFromError({
    name: 'Error',
    message: 'HappyHorse vendor job failed',
    output: { task_status: 'FAILED', code: 'InvalidParameter', message: 'Failed to download https://example.com/x.jpg' },
  });
  expect(
    'download failure → happyhorse_input_download_failed',
    downloadFailure?.error,
    'happyhorse_input_download_failed',
  );
  expect(
    'download failure carries vendor code',
    (downloadFailure as { vendorErrorCode?: string } | null)?.vendorErrorCode,
    'InvalidParameter',
  );

  const genericFailure = happyhorseTerminalGenerationFailurePayloadFromError(
    new Error('All 1 video generation jobs failed for happyhorse-1.1-t2v'),
  );
  expect(
    'generic vendor failure → happyhorse_generation_failed',
    genericFailure?.error,
    'happyhorse_generation_failed',
  );

  // Unrelated error → null (not misattributed)
  expect(
    'unrelated error → null',
    happyhorseTerminalGenerationFailurePayloadFromError(new Error('ltx2 worker disconnected')),
    null,
  );

  // Content-policy detection only when HappyHorse is named
  const policy = happyhorseTerminalPolicyPayloadFromError(
    new Error('HappyHorse rejected the request: sensitive content detected by moderation'),
  );
  expect('content-policy payload error code', policy?.error, 'happyhorse_content_policy');
  expect(
    'content-policy not attributed to unnamed vendor',
    happyhorseTerminalPolicyPayloadFromError(new Error('sensitive content detected by moderation')),
    null,
  );

  console.log(`\nhappyhorse references: ${testsPassed} passed, ${testsFailed} failed`);
  return { passed: testsPassed, failed: testsFailed };
}
