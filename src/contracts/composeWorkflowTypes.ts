/**
 * Compose-workflow shared types (Phase 8.5-prep).
 *
 * `ComposeWorkflowDestinationModels` is the only piece of
 * `prompts/composeWorkflow.ts` that needs to ship in the PUBLIC bucket
 * of the upcoming `@sogni-ai/sogni-intelligence-client` carve-out — it's
 * a small, pure data shape used by `buildComposeWorkflowToolArgs`
 * (extracted to `contracts/hostedComposition.ts`) and by sogni-web's
 * llmHelpers.
 *
 * Extracting just this type — rather than the whole `composeWorkflow.ts`
 * planner module, which contains a substantial private prompt-
 * composition catalog — keeps the public surface minimal while still
 * unblocking the PUBLIC-bucket consumers.
 *
 * `src/prompts/composeWorkflow.ts` re-exports this type for back-compat
 * with existing private consumers.
 */

export interface ComposeWorkflowDestinationModels {
  image?: string;
  video?: string;
  music?: string;
}
