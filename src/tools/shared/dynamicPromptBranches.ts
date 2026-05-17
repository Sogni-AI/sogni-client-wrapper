export interface DynamicPromptBranch {
  raw: string;
  options: string[];
}

export interface SceneDynamicPromptValidation {
  ok: boolean;
  reason?: string;
  branch?: DynamicPromptBranch;
  branchCount?: number;
  dynamicBranchCount?: number;
}

function splitTopLevelOptions(content: string): string[] {
  const options: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (char === '{') depth += 1;
    if (char === '}') depth = Math.max(0, depth - 1);
    if (char === '|' && depth === 0) {
      options.push(content.slice(start, i).trim());
      start = i + 1;
    }
  }

  options.push(content.slice(start).trim());
  return options
    .map((option, index) => {
      let normalized = option;
      if (index === 0) normalized = normalized.replace(/^[@~]\s*/, '');
      return normalized.replace(/^\d+(?:\.\d+)?::\s*/, '').trim();
    })
    .filter(Boolean);
}

export function extractDynamicPromptBranches(prompt: string): DynamicPromptBranch[] {
  const branches: DynamicPromptBranch[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < prompt.length; i += 1) {
    const char = prompt[i];
    if (char === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (char !== '}') continue;

    depth -= 1;
    if (depth === 0 && start >= 0) {
      const raw = prompt.slice(start, i + 1);
      const inner = prompt.slice(start + 1, i);
      if (inner.includes('|')) {
        branches.push({ raw, options: splitTopLevelOptions(inner) });
      }
      start = -1;
    }
  }

  return branches;
}

export function isolateDynamicPromptSlot(
  prompt: string,
  slotIndex: number,
  expectedCount: number,
): string {
  if (!Number.isInteger(slotIndex) || slotIndex < 0) return prompt;
  const branches = extractDynamicPromptBranches(prompt)
    .filter(branch => branch.options.length > slotIndex && (expectedCount <= 1 || branch.options.length === expectedCount));
  if (branches.length === 0) return prompt;

  let scoped = prompt;
  for (const branch of branches) {
    scoped = scoped.replace(branch.raw, branch.options[slotIndex]);
  }
  return scoped;
}

export function buildDynamicPromptSlotPrompts(
  prompt: string,
  expectedCount: number,
): string[] | undefined {
  if (!Number.isInteger(expectedCount) || expectedCount <= 1) return undefined;
  const prompts = Array.from({ length: expectedCount }, (_, index) => isolateDynamicPromptSlot(prompt, index, expectedCount));
  return prompts.some(slotPrompt => slotPrompt !== prompt) ? prompts : undefined;
}

function normalizeForDistinctness(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bscene\s*(?:#|number\s*)?\d+\b/g, 'scene')
    .replace(/\b(shot|keyframe|segment|clip)\s*(?:#|number\s*)?\d+\b/g, '$1')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sceneLabelCount(options: string[]): number {
  const labels = new Set<string>();
  for (const option of options) {
    const matches = option.matchAll(/\b(?:scene|shot|keyframe|segment|clip)\s*(?:#|number\s*)?(\d{1,2})\b/gi);
    for (const match of matches) labels.add(match[1]);
  }
  return labels.size;
}

function optionLooksLikeFullScenePrompt(option: string): boolean {
  const normalized = option.replace(/\s+/g, ' ').trim();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return normalized.length >= 80 && wordCount >= 12;
}

export function validateSceneDynamicPromptBatch(
  prompt: string,
  expectedCount: number,
): SceneDynamicPromptValidation {
  if (!Number.isInteger(expectedCount) || expectedCount < 2 || expectedCount > 16) {
    return { ok: false, reason: 'invalid_expected_count' };
  }

  const branches = extractDynamicPromptBranches(prompt);
  if (branches.length > 1) {
    const largestBranch = branches.reduce((max, branch) => Math.max(max, branch.options.length), 0);
    return {
      ok: false,
      reason: 'multiple_dynamic_prompt_branches',
      branchCount: largestBranch || undefined,
      dynamicBranchCount: branches.length,
    };
  }

  const matchingBranches = branches.filter(branch => branch.options.length === expectedCount);
  if (matchingBranches.length === 0) {
    const largestBranch = branches.reduce((max, branch) => Math.max(max, branch.options.length), 0);
    return {
      ok: false,
      reason: branches.length === 0 ? 'missing_dynamic_prompt_branch' : 'dynamic_prompt_count_mismatch',
      branchCount: largestBranch || undefined,
    };
  }

  for (const branch of matchingBranches) {
    const normalizedOptions = branch.options.map(normalizeForDistinctness);
    const distinctCount = new Set(normalizedOptions).size;
    if (distinctCount !== expectedCount) {
      return { ok: false, reason: 'duplicate_scene_options', branch, branchCount: branch.options.length };
    }

    const fullPromptCount = branch.options.filter(optionLooksLikeFullScenePrompt).length;
    if (fullPromptCount !== expectedCount) {
      return { ok: false, reason: 'scene_options_too_short', branch, branchCount: branch.options.length };
    }

    const labels = sceneLabelCount(branch.options);
    if (labels > 0 && labels !== expectedCount) {
      return { ok: false, reason: 'scene_label_count_mismatch', branch, branchCount: branch.options.length };
    }

    return { ok: true, branch, branchCount: branch.options.length };
  }

  return { ok: false, reason: 'invalid_scene_dynamic_prompt' };
}

export function validateSingleDynamicPromptBranch(
  prompt: string,
  expectedCount: number,
): SceneDynamicPromptValidation {
  if (!Number.isInteger(expectedCount) || expectedCount < 2 || expectedCount > 16) {
    return { ok: false, reason: 'invalid_expected_count' };
  }

  const branches = extractDynamicPromptBranches(prompt);
  if (branches.length > 1) {
    const largestBranch = branches.reduce((max, branch) => Math.max(max, branch.options.length), 0);
    return {
      ok: false,
      reason: 'multiple_dynamic_prompt_branches',
      branchCount: largestBranch || undefined,
      dynamicBranchCount: branches.length,
    };
  }

  const branch = branches[0];
  if (!branch) {
    return { ok: false, reason: 'missing_dynamic_prompt_branch' };
  }
  if (branch.options.length !== expectedCount) {
    return { ok: false, reason: 'dynamic_prompt_count_mismatch', branchCount: branch.options.length };
  }

  const normalizedOptions = branch.options.map(normalizeForDistinctness);
  const distinctCount = new Set(normalizedOptions).size;
  if (distinctCount !== expectedCount) {
    return { ok: false, reason: 'duplicate_scene_options', branch, branchCount: branch.options.length };
  }

  return { ok: true, branch, branchCount: branch.options.length };
}

export function promptHasStoryboardBatchLanguage(prompt: string): boolean {
  return /\b(?:screenplay|storyboard|shot list|multi-scene|scene batch|scene keyframes?|all\s+\d{1,2}\s+scenes?)\b/i.test(prompt);
}

export function promptHasLinkedVariantBatchLanguage(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const mentionsLinkedVariant =
    /\b(?:version set|versions?|variations?|variants?|alternate|transformed|ethnic|renamed?|new names?|common name)\b/.test(lower);
  const mentionsSourcePreservation =
    /\b(?:preserve|keep|maintain|same|exact|identity|likeness|recognizable|pose|placement|framing|composition|camera angle)\b/.test(lower);
  return mentionsLinkedVariant && mentionsSourcePreservation;
}

export function isStoryboardKeyframeBatchPrompt(prompt: string): boolean {
  const branches = extractDynamicPromptBranches(prompt.trim());
  if (branches.length !== 1) return false;

  const options = branches[0]?.options ?? [];
  if (options.length < 2) return false;

  return options.every(option => (
    /\bscene\s+\d+\s+keyframe\b/i.test(option)
    && /\bsingle\s+full[-\s]?frame\s+still\b/i.test(option)
    && /\bno\s+storyboard\s+grid\b/i.test(option)
  ));
}
