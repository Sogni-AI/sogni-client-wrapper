/**
 * Unit tests for the public-safe tool-arg normalization helpers.
 */
import {
  extractDynamicPromptBranches,
  isStoryboardKeyframeBatchPrompt,
  maybeAlignNumberOfVariationsToDynamicBranchCount,
  textExplicitlyRequestsMultipleImageOutputs,
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

export function runToolsSharedTests(): { passed: number; failed: number } {
  console.log('\n🧪 tools/shared helpers\n');

  // extractDynamicPromptBranches
  expect(
    'extractDynamicPromptBranches: 2-option branch',
    extractDynamicPromptBranches('a {pickle | cucumber} on a plate').map(b => b.options),
    [['pickle', 'cucumber']],
  );
  expect(
    'extractDynamicPromptBranches: no branch returns []',
    extractDynamicPromptBranches('just plain text'),
    [],
  );

  // isStoryboardKeyframeBatchPrompt
  expect(
    'isStoryboardKeyframeBatchPrompt: matching keyframe pattern',
    isStoryboardKeyframeBatchPrompt(
      '{scene 1 keyframe, single full-frame still, no storyboard grid | scene 2 keyframe, single full-frame still, no storyboard grid}',
    ),
    true,
  );
  expect(
    'isStoryboardKeyframeBatchPrompt: plain dynamic prompt is false',
    isStoryboardKeyframeBatchPrompt('{pickle | cucumber}'),
    false,
  );

  // textExplicitlyRequestsMultipleImageOutputs
  expect(
    'multiImageIntent: "draw 2 more"',
    textExplicitlyRequestsMultipleImageOutputs('draw 2 more'),
    true,
  );
  expect(
    'multiImageIntent: "another 3"',
    textExplicitlyRequestsMultipleImageOutputs('another 3'),
    true,
  );
  expect(
    'multiImageIntent: "two more"',
    textExplicitlyRequestsMultipleImageOutputs('two more'),
    true,
  );
  expect(
    'multiImageIntent: "give me 5 more variations"',
    textExplicitlyRequestsMultipleImageOutputs('give me 5 more variations'),
    true,
  );
  expect(
    'multiImageIntent: "make it bigger" (no multi-image signal)',
    textExplicitlyRequestsMultipleImageOutputs('make it bigger'),
    false,
  );

  // maybeAlignNumberOfVariationsToDynamicBranchCount
  expect(
    'align: generate_image with 2-branch + N=1 aligns to N=2',
    maybeAlignNumberOfVariationsToDynamicBranchCount(
      'generate_image',
      { prompt: '{a pickle | a cucumber}', numberOfVariations: 1 },
      'draw 2 more',
    ),
    { prompt: '{a pickle | a cucumber}', numberOfVariations: 2 },
  );
  expect(
    'align: aligned prompt + N=2 returns null',
    maybeAlignNumberOfVariationsToDynamicBranchCount(
      'generate_image',
      { prompt: '{a | b}', numberOfVariations: 2 },
      'draw 2 more',
    ),
    null,
  );
  expect(
    'align: random-pick phrasing skips alignment',
    maybeAlignNumberOfVariationsToDynamicBranchCount(
      'generate_image',
      { prompt: '{a | b}', numberOfVariations: 1 },
      'pick one randomly',
    ),
    null,
  );
  expect(
    'align: non-image tool returns null',
    maybeAlignNumberOfVariationsToDynamicBranchCount(
      'generate_video',
      { prompt: '{a | b}', numberOfVariations: 1 },
      'draw 2 more',
    ),
    null,
  );
  expect(
    'align: prompt with multiple branches returns null',
    maybeAlignNumberOfVariationsToDynamicBranchCount(
      'generate_image',
      { prompt: '{a | b} on a {table | shelf}', numberOfVariations: 1 },
      'draw 2 more',
    ),
    null,
  );

  console.log(`\ntools/shared: ${testsPassed} passed, ${testsFailed} failed`);
  return { passed: testsPassed, failed: testsFailed };
}
