/**
 * Workflow primitive helpers — pure logic shared across frontends.
 *
 * Each primitive ships TWO halves:
 *   1. **Helpers** (this directory) — pure prompt builders, parsers,
 *      evaluators, arg validators. No LLM client, no IO. Reusable by
 *      any consumer of `@sogni-ai/sogni-intelligence-client`.
 *   2. **Handlers** (per-frontend) — wire the helpers to that
 *      frontend's LLM client + tool callback API. Lives in the
 *      frontend codebase because the LLM client is environment-specific.
 *
 * Naming convention for stage tools that route through a primitive:
 * `wf:<primitive_name>` (e.g. `wf:validate_with_rubric`). The `wf:`
 * prefix signals "workflow-only step, not a chat tool".
 *
 * Primitives currently published:
 *   - `retryUntilCondition` — wrap any tool with a bounded retry loop
 *     until a predicate passes
 *   - `validateWithRubric` — LLM-judge an artifact against a rubric,
 *     with an SSRF allow-list for `artifactUrl`
 *   - `sanitizer` — canonical untrusted-input sanitizer +
 *     `<UNTRUSTED_USER_INPUT>` wrapper (replaces drifted local
 *     implementations in sogni-api + sogni-creative-agent)
 */

export * from './retryUntilCondition.js';
export * from './validateWithRubric.js';
export * from './sanitizer.js';
