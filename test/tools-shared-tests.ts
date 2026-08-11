/**
 * Unit tests for the public-safe tool-arg normalization helpers.
 */
import {
  generateImageDefinition,
  extractDynamicPromptBranches,
  getModelOptions,
  isStoryboardKeyframeBatchPrompt,
  maybeAlignNumberOfVariationsToDynamicBranchCount,
  textExplicitlyRequestsMultipleImageOutputs,
} from '../src/tools/index';
import { validateAndNormalizeHostedToolArguments } from '../src/contracts/index';

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

  expect(
    'model registry: edit_image includes Krea identity edit models',
    getModelOptions('edit_image').map(option => option.key).includes('krea-identity-edit')
      && getModelOptions('edit_image').map(option => option.key).includes('dark-beast-krea2-identity-edit'),
    true,
  );
  expect(
    'model registry: generate_image includes Dark Beast Krea 2',
    getModelOptions('generate_image').map(option => option.key).includes('dark-beast-krea2'),
    true,
  );
  const generateVideoModelKeys = getModelOptions('generate_video').map(option => option.key);
  const animatePhotoModelKeys = getModelOptions('animate_photo').map(option => option.key);
  expect(
    'model registry: generate_video includes only the H3 T2V Turbo selector',
    {
      t2vTurbo: generateVideoModelKeys.includes('minimax-h3-t2v-turbo'),
      r2vTurbo: generateVideoModelKeys.includes('minimax-h3-r2v-turbo'),
    },
    { t2vTurbo: true, r2vTurbo: false },
  );
  expect(
    'model registry: animate_photo includes H3 I2V and FLF2V Turbo selectors',
    {
      i2vTurbo: animatePhotoModelKeys.includes('minimax-h3-i2v-turbo'),
      flf2vTurbo: animatePhotoModelKeys.includes('minimax-h3-flf2v-turbo'),
      r2vTurbo: animatePhotoModelKeys.includes('minimax-h3-r2v-turbo'),
    },
    { i2vTurbo: true, flf2vTurbo: true, r2vTurbo: false },
  );
  const generateImageProperties = generateImageDefinition.function.parameters.properties ?? {};
  expect(
    'generate_image exposes ordered LoRA arrays',
    {
      loras: generateImageProperties.loras?.maxItems,
      loraStrengths: generateImageProperties.loraStrengths?.maxItems,
    },
    { loras: 8, loraStrengths: 8 },
  );
  const mismatchedLoras = validateAndNormalizeHostedToolArguments(
    [generateImageDefinition],
    'generate_image',
    {
      prompt: 'portrait',
      model: 'krea-2-turbo',
      loras: ['krea2-detail-enhancer', 'krea2-amateur'],
      loraStrengths: [-2],
    },
  );
  expect('generate_image rejects mismatched LoRA arrays', mismatchedLoras.ok, false);
  const bipolarLoras = validateAndNormalizeHostedToolArguments(
    [generateImageDefinition],
    'generate_image',
    {
      prompt: 'portrait',
      model: 'krea-2-turbo',
      loras: ['krea2-detail-enhancer', 'krea2-amateur'],
      loraStrengths: [3, -2],
    },
  );
  expect('generate_image accepts ordered bipolar LoRA strengths', bipolarLoras.ok, true);

  const openNestedPayload = {
    id: 'wf_existing',
    version: 7,
    stages: [{ id: 'storyboard', tool: 'generate_image' }],
    nullableNote: null,
  };
  const openNestedResult = validateAndNormalizeHostedToolArguments(
    [{
      function: {
        name: 'compose_workflow_template',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            brief: { type: 'string' },
            existing_template: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
      },
    }],
    'compose_workflow_template',
    {
      brief: 'Change the saved template to portrait.',
      existing_template: openNestedPayload,
      invented_top_level_field: 'strip me',
    },
    { stripUnknownProperties: true },
  );
  expect(
    'hosted validation preserves explicitly open nested objects while stripping closed parent fields',
    openNestedResult.cleaned,
    {
      brief: 'Change the saved template to portrait.',
      existing_template: openNestedPayload,
    },
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
