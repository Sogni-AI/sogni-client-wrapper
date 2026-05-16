/**
 * Literal-prompt override marker.
 *
 * Phase 8.2-prep extracts this sentinel string out of `src/prompts/` so
 * tool definitions in `src/tools/definitions/*` (which will ship in the
 * public bucket of the upcoming `@sogni-ai/sogni-intelligence-client`
 * carve-out) don't have to import from PRIVATE `prompts/`.
 *
 * The original declaration lived in `src/prompts/literalPrompt.ts` and
 * is re-exported there for back-compat so existing private consumers
 * keep working.
 */

export const LITERAL_PROMPT_OVERRIDE =
  'LITERAL PROMPT OVERRIDE: If the user explicitly says not to modify the prompt, or to use it exactly/verbatim/as-is, copy the identified prompt text verbatim instead of applying these construction rules unless a hard requirement is missing.';
