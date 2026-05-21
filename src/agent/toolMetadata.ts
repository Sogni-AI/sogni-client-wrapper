/**
 * ToolMetadata — public-safe TypeScript mirror of
 * `schemas/tools/tool-metadata.schema.json` in sogni-protocol-v2.
 *
 * Audit fix (2026-05-20): the JSON schema existed but there was no
 * canonical TS counterpart, so each consumer was free to invent its own
 * shape (and several did, with subtle field-name drift). This file gives
 * the planner, the gating policies, the spend gate, and downstream
 * dashboards one source of truth.
 *
 * Drives:
 * - tool surfacing decisions (`family`, `executionMode`, `hiddenFromModel`)
 * - spend gating (`costClass`, `requiresConfirmation`)
 * - retry behavior (`retrySafety`)
 * - durable-run observability (`mutatesData`, `producesArtifacts`)
 *
 * Schema-aligned field set + enums match `2026-05-20.1` exactly. Any
 * change here must be made in `sogni-protocol-v2` first.
 *
 * Plan: docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7 + §10.
 */

/**
 * Coarse grouping used by the planner to pick a minimal visible tool
 * subset. Mirrors the schema enum verbatim.
 */
export type ToolFamily =
  | 'creative'
  | 'composition'
  | 'artifact'
  | 'memory'
  | 'settings'
  | 'analysis'
  | 'control';

/**
 * Where the tool runs.
 * - `'hosted'` — sogni-api durable runner.
 * - `'client'` — browser tool dispatch.
 * - `'app'` — native shell.
 * - `'workflow'` — synthetic tool that creates a WorkflowRun.
 * - `'internal'` — runtime-only (e.g. L1 hidden resolver) — never
 *   surfaced to the LLM directly.
 */
export type ToolExecutionMode = 'hosted' | 'client' | 'app' | 'workflow' | 'internal';

/**
 * Indicative cost tier. Concrete unit estimates live on the SpendGate
 * request, not here.
 */
export type ToolCostClass = 'free' | 'low' | 'medium' | 'high' | 'variable';

/**
 * Indicative wall-clock tier. `'long_running'` tools generally belong
 * inside a Workflow Template, not a synchronous chat turn.
 */
export type ToolLatencyClass = 'inline' | 'interactive' | 'long_running';

/**
 * Confirmation policy.
 * - `'never'` — no confirmation required.
 * - `'paid'` — defers to SpendGate.
 * - `'destructive'` — requires an explicit user yes regardless of cost.
 * - `'always'` — reserved for atomic operations with no other gate.
 */
export type ToolConfirmationPolicy = 'never' | 'paid' | 'destructive' | 'always';

/**
 * Whether the runner may retry the tool call on a transient failure.
 * `'dedupe_key_required'` tools must be called with a stable dedupe
 * token (e.g. sogni-socket project id).
 */
export type ToolRetrySafety = 'idempotent' | 'dedupe_key_required' | 'not_safe';

/**
 * Tool catalog metadata. One record per tool definition. Field order +
 * required set match `schemas/tools/tool-metadata.schema.json`.
 */
export interface ToolMetadata {
  /**
   * Canonical tool name (snake_case, matches the OpenAI-format tool
   * definition exposed to the LLM).
   */
  name: string;
  family: ToolFamily;
  executionMode: ToolExecutionMode;
  /**
   * URI or repo-relative path. MUST resolve to a sogni-protocol tool
   * argument JSON Schema (e.g. `schemas/tools/generate_image.schema.json`).
   */
  inputSchemaRef: string;
  /**
   * URI or repo-relative path. MUST resolve to a sogni-protocol tool
   * result envelope schema.
   */
  outputSchemaRef: string;
  costClass: ToolCostClass;
  latencyClass: ToolLatencyClass;
  /**
   * True when the tool changes persisted user state (e.g.
   * `manage_memory` write, settings update).
   */
  mutatesData: boolean;
  /**
   * True when the tool emits one or more `ArtifactNode`s that must be
   * registered in the ArtifactGraph.
   */
  producesArtifacts: boolean;
  requiresConfirmation: ToolConfirmationPolicy;
  retrySafety: ToolRetrySafety;
  /**
   * Optional. L1 hidden context tools (`resolve_*`, `inspect_*`) set
   * this true so the runner can call them directly without surfacing
   * them to the LLM.
   */
  hiddenFromModel?: boolean;
}

const TOOL_FAMILIES: ReadonlySet<ToolFamily> = new Set<ToolFamily>([
  'creative',
  'composition',
  'artifact',
  'memory',
  'settings',
  'analysis',
  'control',
]);

const TOOL_EXECUTION_MODES: ReadonlySet<ToolExecutionMode> = new Set<ToolExecutionMode>([
  'hosted',
  'client',
  'app',
  'workflow',
  'internal',
]);

const TOOL_COST_CLASSES: ReadonlySet<ToolCostClass> = new Set<ToolCostClass>([
  'free',
  'low',
  'medium',
  'high',
  'variable',
]);

const TOOL_LATENCY_CLASSES: ReadonlySet<ToolLatencyClass> = new Set<ToolLatencyClass>([
  'inline',
  'interactive',
  'long_running',
]);

const TOOL_CONFIRMATION_POLICIES: ReadonlySet<ToolConfirmationPolicy> =
  new Set<ToolConfirmationPolicy>(['never', 'paid', 'destructive', 'always']);

const TOOL_RETRY_SAFETIES: ReadonlySet<ToolRetrySafety> = new Set<ToolRetrySafety>([
  'idempotent',
  'dedupe_key_required',
  'not_safe',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isToolFamily(value: unknown): value is ToolFamily {
  return typeof value === 'string' && TOOL_FAMILIES.has(value as ToolFamily);
}

export function isToolExecutionMode(value: unknown): value is ToolExecutionMode {
  return typeof value === 'string' && TOOL_EXECUTION_MODES.has(value as ToolExecutionMode);
}

export function isToolCostClass(value: unknown): value is ToolCostClass {
  return typeof value === 'string' && TOOL_COST_CLASSES.has(value as ToolCostClass);
}

export function isToolLatencyClass(value: unknown): value is ToolLatencyClass {
  return typeof value === 'string' && TOOL_LATENCY_CLASSES.has(value as ToolLatencyClass);
}

export function isToolConfirmationPolicy(value: unknown): value is ToolConfirmationPolicy {
  return typeof value === 'string' && TOOL_CONFIRMATION_POLICIES.has(value as ToolConfirmationPolicy);
}

export function isToolRetrySafety(value: unknown): value is ToolRetrySafety {
  return typeof value === 'string' && TOOL_RETRY_SAFETIES.has(value as ToolRetrySafety);
}

export function isToolMetadata(value: unknown): value is ToolMetadata {
  if (!isRecord(value)) return false;
  if (typeof value.name !== 'string' || value.name.length === 0) return false;
  if (!isToolFamily(value.family)) return false;
  if (!isToolExecutionMode(value.executionMode)) return false;
  if (typeof value.inputSchemaRef !== 'string' || value.inputSchemaRef.length === 0) return false;
  if (typeof value.outputSchemaRef !== 'string' || value.outputSchemaRef.length === 0) return false;
  if (!isToolCostClass(value.costClass)) return false;
  if (!isToolLatencyClass(value.latencyClass)) return false;
  if (typeof value.mutatesData !== 'boolean') return false;
  if (typeof value.producesArtifacts !== 'boolean') return false;
  if (!isToolConfirmationPolicy(value.requiresConfirmation)) return false;
  if (!isToolRetrySafety(value.retrySafety)) return false;
  if (value.hiddenFromModel !== undefined && typeof value.hiddenFromModel !== 'boolean') {
    return false;
  }
  return true;
}

/** One structured validation error (see intentInput for shape rationale). */
export interface ToolMetadataValidationError {
  path: string;
  message: string;
}

export interface ToolMetadataValidationResult {
  valid: boolean;
  errors: ToolMetadataValidationError[];
}

function pushError(
  errors: ToolMetadataValidationError[],
  path: string,
  message: string,
): void {
  errors.push({ path, message });
}

/**
 * Walk {@link ToolMetadata} and report each missing or wrong-typed
 * field as `{ path, message }`. Mirrors the field order of the
 * canonical JSON schema.
 */
export function validateToolMetadata(value: unknown): ToolMetadataValidationResult {
  const errors: ToolMetadataValidationError[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: [{ path: '/', message: 'must be an object' }] };
  }
  const name = (value as { name?: unknown }).name;
  if (typeof name !== 'string' || name.length === 0) {
    pushError(errors, '/name', 'must be a non-empty string');
  }
  if (!isToolFamily((value as { family?: unknown }).family)) {
    pushError(errors, '/family', 'must be a valid ToolFamily');
  }
  if (!isToolExecutionMode((value as { executionMode?: unknown }).executionMode)) {
    pushError(errors, '/executionMode', 'must be a valid ToolExecutionMode');
  }
  const inputRef = (value as { inputSchemaRef?: unknown }).inputSchemaRef;
  if (typeof inputRef !== 'string' || inputRef.length === 0) {
    pushError(errors, '/inputSchemaRef', 'must be a non-empty string');
  }
  const outputRef = (value as { outputSchemaRef?: unknown }).outputSchemaRef;
  if (typeof outputRef !== 'string' || outputRef.length === 0) {
    pushError(errors, '/outputSchemaRef', 'must be a non-empty string');
  }
  if (!isToolCostClass((value as { costClass?: unknown }).costClass)) {
    pushError(errors, '/costClass', 'must be a valid ToolCostClass');
  }
  if (!isToolLatencyClass((value as { latencyClass?: unknown }).latencyClass)) {
    pushError(errors, '/latencyClass', 'must be a valid ToolLatencyClass');
  }
  if (typeof (value as { mutatesData?: unknown }).mutatesData !== 'boolean') {
    pushError(errors, '/mutatesData', 'must be a boolean');
  }
  if (typeof (value as { producesArtifacts?: unknown }).producesArtifacts !== 'boolean') {
    pushError(errors, '/producesArtifacts', 'must be a boolean');
  }
  if (!isToolConfirmationPolicy((value as { requiresConfirmation?: unknown }).requiresConfirmation)) {
    pushError(errors, '/requiresConfirmation', 'must be a valid ToolConfirmationPolicy');
  }
  if (!isToolRetrySafety((value as { retrySafety?: unknown }).retrySafety)) {
    pushError(errors, '/retrySafety', 'must be a valid ToolRetrySafety');
  }
  const hidden = (value as { hiddenFromModel?: unknown }).hiddenFromModel;
  if (hidden !== undefined && typeof hidden !== 'boolean') {
    pushError(errors, '/hiddenFromModel', 'must be a boolean when present');
  }
  return { valid: errors.length === 0, errors };
}
