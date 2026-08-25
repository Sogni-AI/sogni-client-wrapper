import {
  WAN3_REFERENCE_LIMITS,
  WAN3_RESOLUTIONS,
  WAN3_SUPPORTED_RATIOS,
  WAN3_VIDEO_MODEL_ID,
  getVideoModelConfig,
} from '../src/media/videoSettings.js';
import {
  WAN3_WORKFLOW_MODEL,
  formatModelRef,
  getBuiltinVideoModelConfig,
  isWan3ModelSelection,
  resolveVideoModelAlias,
} from '../src/public-skill-runtime/index.js';
import { getModelRefFormatResolution } from '../src/skills/asset_reference_management/modelRefRegistry.js';
import { MODELS_BY_TOOL } from '../src/tools/shared/modelRegistry.js';
import { definition as videoToVideoDefinition } from '../src/tools/definitions/video-to-video/definition.js';
import { definition as soundToVideoDefinition } from '../src/tools/definitions/sound-to-video/definition.js';
import {
  WAN3_LOOSE_REFERENCE_LIMITS,
  WAN3_REFERENCE_DURATION_LIMITS,
  Wan3ReferenceDurationError,
  Wan3ReferenceLimitError,
  validateWan3ReferenceCounts,
  validateWan3ReferenceDurations,
} from '../src/tools/shared/wan3References.js';

let testsPassed = 0;
let testsFailed = 0;

function expect(name: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    testsFailed += 1;
    return;
  }
  testsPassed += 1;
}

export function runWan3VideoTests(): { passed: number; failed: number } {
  expect('canonical model id', WAN3_VIDEO_MODEL_ID, 'wan3.0-video');
  expect('runtime canonical model id', WAN3_WORKFLOW_MODEL, 'wan3.0-video');
  expect('wan3 alias', resolveVideoModelAlias('wan3'), 'wan3.0-video');
  expect('wan3.0 alias', resolveVideoModelAlias('wan3.0'), 'wan3.0-video');
  expect('wan3 exact selection', isWan3ModelSelection('wan3.0-video'), true);

  const runtime = getBuiltinVideoModelConfig('wan3');
  expect('runtime family', runtime?.family, 'wan3');
  expect('runtime fixed fps', runtime?.fps, 30);
  expect('runtime duration frame bounds', [runtime?.minFrames, runtime?.maxFrames], [61, 901]);

  const media = getVideoModelConfig('wan3.0-video');
  expect('media fixed fps', media.fps, 30);
  expect('media native audio', [media.nativeAudio, media.supportsAudioToggle], [true, true]);
  expect('resolutions', WAN3_RESOLUTIONS, ['480P', '720P', '1080P']);
  expect('ratios', WAN3_SUPPORTED_RATIOS, ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16']);
  expect('reference limits', WAN3_REFERENCE_LIMITS, {
    firstFrames: 1,
    lastFrames: 1,
    images: 10,
    videos: 5,
    audios: 5,
    files: 1,
    links: 1,
  });
  expect('loose reference limits', WAN3_LOOSE_REFERENCE_LIMITS, {
    images: 10,
    videos: 5,
    audios: 5,
    files: 1,
    links: 1,
  });
  expect('reference duration limits', WAN3_REFERENCE_DURATION_LIMITS, {
    minimum: 1,
    maximum: 15,
    totalMaximum: 15,
  });
  validateWan3ReferenceCounts({ images: 10, videos: 5, audios: 5 });
  let limitError: unknown;
  try {
    validateWan3ReferenceCounts({ images: 11, videos: 0, audios: 0 });
  } catch (error) {
    limitError = error;
  }
  expect('loose reference overflow is typed', limitError instanceof Wan3ReferenceLimitError, true);
  validateWan3ReferenceDurations('video', [5, 10, undefined]);
  let durationError: unknown;
  try {
    validateWan3ReferenceDurations('audio', [8, 8]);
  } catch (error) {
    durationError = error;
  }
  expect('reference duration overflow is typed', durationError instanceof Wan3ReferenceDurationError, true);

  expect('image prompt reference', formatModelRef('wan3', 2, 'image'), 'Image 2');
  expect('video prompt reference', formatModelRef('wan3.0-video', 3, 'video'), 'Video 3');
  expect('audio prompt reference', formatModelRef('wan3', 1, 'audio'), 'Audio 1');
  expect('reference registry does not fall back', getModelRefFormatResolution('wan3.0-video').fell_back, false);

  for (const toolName of ['generate_video', 'animate_photo', 'sound_to_video', 'video_to_video']) {
    expect(
      `${toolName} exposes Wan 3`,
      MODELS_BY_TOOL[toolName]?.some(option => option.key === 'wan3.0-video'),
      true,
    );
  }
  const videoToVideoProperties = videoToVideoDefinition.function.parameters.properties ?? {};
  expect('v2v exposes Wan 3 document context', 'referenceFileUrl' in videoToVideoProperties, true);
  expect('v2v exposes Wan 3 webpage context', 'referenceLinkUrl' in videoToVideoProperties, true);
  const soundToVideoProperties = soundToVideoDefinition.function.parameters.properties ?? {};
  expect('sound-to-video exposes Wan 3 document context', 'referenceFileUrl' in soundToVideoProperties, true);
  expect('sound-to-video exposes Wan 3 webpage context', 'referenceLinkUrl' in soundToVideoProperties, true);

  console.log(`\nwan3 video: ${testsPassed} passed, ${testsFailed} failed`);
  return { passed: testsPassed, failed: testsFailed };
}
