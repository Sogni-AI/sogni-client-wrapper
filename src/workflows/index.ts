export * from './types.js';
export { summarizeWorkflowTemplate } from './summarize.js';
export type { SummarizeWorkflowTemplateOptions } from './summarize.js';
export * from './bindings.js';
export * from './validation.js';
export * from './executor-ports.js';
export * from './executor.js';

// Workflow primitives — pure helpers any frontend can use to implement
// the `wf:*` stage tools (validate-and-regenerate loops, bounded retry,
// dialogue rewriting, etc.). Exported under a `primitives` namespace so
// the surface stays self-documenting:
// `primitives.parseJudgeResponse(...)`,
// `primitives.parseRetryUntilArgs(...)`, etc.
export * as primitives from './primitives/index.js';

// Re-export the primitive types at the top level so TypeScript callers
// can `import type { RetryCondition, RubricJudgement } from
// '@sogni-ai/sogni-intelligence-client/workflows'` without traversing
// the namespace export.
export type {
  RetryUntilArgs,
  RetryCondition,
} from './primitives/retryUntilCondition.js';
export type {
  ValidateRubricInput,
  RubricJudgement,
} from './primitives/validateWithRubric.js';

// Sanitizer is a public canonical helper — surface its functions +
// types at the top level so consumers can drop their local copies
// without traversing the `primitives` namespace.
export {
  SanitizerError,
  HARD_STRIP_PATTERNS,
  sanitizeUntrustedString,
  escapeAttribute,
  wrapAsUntrustedUserInput,
} from './primitives/sanitizer.js';
export type { SanitizeUntrustedStringOptions } from './primitives/sanitizer.js';
