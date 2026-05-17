import { extractDynamicPromptBranches } from './dynamicPromptBranches.js';

const RANDOM_DYNAMIC_PROMPT_PHRASE_PATTERN =
  /\b(?:random(?:ly|ize)?|surprise me|pick (?:one|either)|either one|one of (?:them|these|those|the (?:two|three|four|five|six|seven|eight|nine|ten)))\b/i;

function coerceInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

/**
 * Aligns `numberOfVariations` to a single Dynamic Prompt branch's option count
 * when the LLM emitted both but mismatched them. The canonical bad pattern is
 * `prompt="{A | B}"` with `numberOfVariations=1`, which produces ONE image
 * with a random branch pick instead of the K outputs the model clearly
 * intended. This generalises to any K != N mismatch on a single top-level
 * branch with 2..16 options. Skips when the user explicitly asked for a
 * random pick from the branch.
 *
 * Generic and prompt-agnostic — does not require scene/batch context detection,
 * so it catches casual follow-ups like "draw 2 more" where broader
 * batch-required guards have nothing to anchor on.
 */
export function maybeAlignNumberOfVariationsToDynamicBranchCount(
  toolName: string,
  args: Record<string, unknown>,
  latestUserText: string,
): Record<string, unknown> | null {
  if (toolName !== 'generate_image' && toolName !== 'edit_image') return null;
  const prompt = typeof args.prompt === 'string' ? args.prompt : '';
  if (!prompt) return null;
  if (RANDOM_DYNAMIC_PROMPT_PHRASE_PATTERN.test(latestUserText)) return null;

  const branches = extractDynamicPromptBranches(prompt);
  if (branches.length !== 1) return null;
  const optionCount = branches[0].options.length;
  if (optionCount < 2 || optionCount > 16) return null;

  const currentVariations = coerceInteger(args.numberOfVariations) ?? 1;
  if (currentVariations === optionCount) return null;

  return { ...args, numberOfVariations: optionCount };
}
