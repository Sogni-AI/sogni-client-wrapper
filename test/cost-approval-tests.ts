/**
 * Unit tests for the cost-approval override allowlist + sanitizer
 * (src/chatRun/costApproval.ts). The allowlist is the contract between the
 * chat-side approval popup and the durable server dispatch surface — adding a
 * key here must stay in sync with what the popup is allowed to send.
 */
import {
  applyCostApprovalOverridesToToolArguments,
  sanitizeCostApprovalOverride,
  COST_APPROVAL_OVERRIDE_ALLOWLIST,
} from '../src/chatRun/costApproval';

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

export function runCostApprovalTests(): { passed: number; failed: number } {
  console.log('\n🧪 chatRun/costApproval prompt overrides\n');

  // prompt: non-empty string kept and merged onto the tool args
  let r = applyCostApprovalOverridesToToolArguments('{"prompt":"old","model":"m"}', { prompt: 'new' });
  expect('prompt kept + merged', JSON.parse(r.result), { prompt: 'new', model: 'm' });
  expect('prompt not rejected', r.rejected, []);

  // prompt: emptied/whitespace dropped (rejected), args left unchanged
  r = applyCostApprovalOverridesToToolArguments('{"prompt":"old"}', { prompt: '   ' });
  expect('empty prompt leaves args unchanged', JSON.parse(r.result), { prompt: 'old' });
  expect('empty prompt rejected', r.rejected, ['prompt']);

  // prompts: array of non-empty strings kept (full replace)
  r = applyCostApprovalOverridesToToolArguments('{"prompts":["a","b"]}', { prompts: ['x', 'y'] });
  expect('prompts array kept', JSON.parse(r.result), { prompts: ['x', 'y'] });

  // prompts: array containing an empty entry dropped
  r = applyCostApprovalOverridesToToolArguments('{"prompts":["a"]}', { prompts: ['x', ''] });
  expect('prompts with empty entry rejected', r.rejected, ['prompts']);
  expect('prompts with empty entry leaves args unchanged', JSON.parse(r.result), { prompts: ['a'] });

  // prompts: non-array dropped
  r = applyCostApprovalOverridesToToolArguments('{"prompts":["a"]}', { prompts: 'not-an-array' });
  expect('non-array prompts rejected', r.rejected, ['prompts']);

  // existing allow-listed key still works (regression guard)
  r = applyCostApprovalOverridesToToolArguments('{}', { qualityTier: 'fast' });
  expect('qualityTier still kept', JSON.parse(r.result), { qualityTier: 'fast' });

  // unknown / unsafe key still rejected
  r = applyCostApprovalOverridesToToolArguments('{}', { width: 9999 });
  expect('unknown key still rejected', r.rejected, ['width']);

  // allowlist + sanitizer surface
  expect('allowlist includes prompt', COST_APPROVAL_OVERRIDE_ALLOWLIST.has('prompt'), true);
  expect('allowlist includes prompts', COST_APPROVAL_OVERRIDE_ALLOWLIST.has('prompts'), true);
  expect('sanitize keeps non-empty prompt', sanitizeCostApprovalOverride('prompt', 'hi'), 'hi');
  expect('sanitize drops empty prompt', sanitizeCostApprovalOverride('prompt', '  '), undefined);
  expect('sanitize keeps prompts array', sanitizeCostApprovalOverride('prompts', ['a']), ['a']);
  expect('sanitize drops empty-entry prompts', sanitizeCostApprovalOverride('prompts', ['a', '']), undefined);

  return { passed: testsPassed, failed: testsFailed };
}

// Allow standalone execution: `node --import tsx test/cost-approval-tests.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { passed, failed } = runCostApprovalTests();
  console.log(`\npassed: ${passed}, failed: ${failed}`);
  if (failed > 0) process.exit(1);
}
