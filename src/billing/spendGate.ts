/**
 * SpendGate — v2 state machine that pauses a run before any paid tool
 * call (or workflow run) until the user (or an authorization umbrella)
 * confirms. One gate per scope: per-`tool_call` for chat runs, per-
 * `workflow_run` for workflow umbrellas (which then settle per-stage via
 * the existing sogni-socket project + N jobs path — see
 * `workflowAuthorization.ts`).
 *
 * Drift fix (audit 2026-05-20): pre-fix `SpendGate` shipped only `{state,
 * request?, decidedAt?, decidedBy?, failureReason?}` — far thinner than
 * the durable shape every downstream consumer (`sogni-creative-agent-v2`,
 * `sogni-api`, `sogni-chat`) actually persists. The schema in
 * `schemas/billing/spend-gate.schema.json` mandates `{gateId, scope,
 * estimate, state, lastTransitionAt}` plus scope-discriminated fields.
 * This file now exposes those fields as the canonical shape while keeping
 * the legacy `state` / `request?` / `failureReason?` keys present so
 * existing producers stay valid. `decidedBy?` was dropped — no consumer
 * uses it.
 *
 * Plan: docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7.
 */

/** Coarse state of the gate. */
export type SpendGateState =
  | 'not_required'
  | 'preview_required'
  | 'waiting_for_user'
  | 'confirmed'
  | 'cancelled'
  | 'insufficient_credit'
  | 'safety_review_required'
  | 'failed';

/** What the gate is authorizing. */
export type SpendGateScope = 'tool_call' | 'workflow_run';

/** Capacity unit denomination. */
export type SpendGateTokenType = 'spark' | 'sogni';

/**
 * Decision recorded on the gate when the user (or an authorization
 * umbrella) resolves it. Mirrors the `SpendGateDecision` enum in the
 * canonical JSON schema (`confirm` / `cancel`).
 */
export type SpendGateDecision = 'confirm' | 'cancel';

/** One line item in the cost breakdown surfaced to the user. */
export interface SpendGateCostBreakdownEntry {
  model: string;
  units: number;
  tokenType: SpendGateTokenType;
}

/**
 * Minimal reference to a tool call this gate covers. When scope =
 * `'tool_call'` the array typically has a single entry; when scope =
 * `'workflow_run'` it may be empty (the workflow plan is the unit of
 * authorization).
 */
export interface SpendGatePendingToolCallRef {
  toolCallId: string;
  toolName: string;
}

/**
 * Reference to the workflow run this gate authorizes. Only meaningful
 * when the gate scope is `'workflow_run'`.
 */
export interface SpendGatePendingWorkflowPlanRef {
  workflowRunId: string;
  templateId: string;
}

/**
 * Estimate payload carried on the gate itself. Field names mirror the
 * canonical schema: `capacityUnits` (sum of breakdown units), the typed
 * `breakdown[]`, the `tokenType` the breakdown is denominated in, and an
 * optional caller-supplied cap.
 */
export interface SpendGateEstimate {
  capacityUnits: number;
  breakdown: SpendGateCostBreakdownEntry[];
  tokenType: SpendGateTokenType;
  maxAcceptableUnits?: number;
}

/**
 * Request payload for a gate transition. Captured once when the run hits
 * a paid action; the gate state machine consumes it on every transition.
 * Field names are pre-2026-05-20; new code should prefer the
 * `SpendGate.estimate` object instead of these flat fields.
 */
export interface SpendGateRequest {
  scope: SpendGateScope;
  toolCallId?: string;
  workflowRunId?: string;
  /** Total estimated cost in capacity units (sum of breakdown). */
  estimateCapacityUnits: number;
  estimateCostBreakdown: SpendGateCostBreakdownEntry[];
  /** Optional cap from caller (e.g. runtimeConfig threshold). */
  maxAcceptableUnits?: number;
  /** Optional human-readable reason for the gate. */
  reason?: string;
}

/**
 * Live gate. Canonical fields (`gateId`, `scope`, `estimate`, `reason`,
 * `createdAt`, `updatedAt`) match `schemas/billing/spend-gate.schema.json`
 * and the durable shape consumers persist; legacy fields (`request?`,
 * `failureReason?`) remain present so existing producers keep validating.
 *
 * All new canonical fields are optional in TypeScript on purpose: the
 * pre-2026-05-20 producers only set `state` and (sometimes) `request`,
 * and we don't want to break their type-checks in one cycle. Producers
 * targeting the canonical shape SHOULD populate `gateId`, `scope`,
 * `estimate`, `createdAt`, `updatedAt` (the JSON schema treats these as
 * required at the wire level).
 */
export interface SpendGate {
  state: SpendGateState;
  /** Stable id for the gate. Required at the wire level. */
  gateId?: string;
  /** What the gate is authorizing. Required at the wire level. */
  scope?: SpendGateScope;
  /** Optional back-reference to the run that opened the gate. */
  runId?: string;
  /** Canonical estimate payload (replaces the flat fields on `request`). */
  estimate?: SpendGateEstimate;
  /** Human-readable reason for the gate. */
  reason?: string;
  /** Pending tool calls this gate covers (scope = `'tool_call'`). */
  pendingToolCalls?: SpendGatePendingToolCallRef[];
  /** Pending workflow plan this gate authorizes (scope = `'workflow_run'`). */
  pendingWorkflowPlan?: SpendGatePendingWorkflowPlanRef;
  /** ISO timestamp when the gate was opened. */
  createdAt?: string;
  /** ISO timestamp of the most recent state transition. */
  updatedAt?: string;
  /** ISO timestamp when the gate was decided (confirmed/cancelled/etc.). */
  decidedAt?: string;
  /** Decision recorded when the gate left `waiting_for_user`. */
  decision?: SpendGateDecision;
  /**
   * @deprecated Pre-2026-05-20 flat request payload. New code SHOULD
   * populate `estimate` + `scope` + `pendingToolCalls?` /
   * `pendingWorkflowPlan?` directly. Retained so existing producers stay
   * valid for one release.
   */
  request?: SpendGateRequest;
  /** Optional structured failure code/text when state is `failed`. */
  failureReason?: string;
}

const SPEND_GATE_STATES: ReadonlySet<SpendGateState> = new Set<SpendGateState>([
  'not_required',
  'preview_required',
  'waiting_for_user',
  'confirmed',
  'cancelled',
  'insufficient_credit',
  'safety_review_required',
  'failed',
]);

const SPEND_GATE_SCOPES: ReadonlySet<SpendGateScope> = new Set<SpendGateScope>([
  'tool_call',
  'workflow_run',
]);

const SPEND_GATE_TOKEN_TYPES: ReadonlySet<SpendGateTokenType> = new Set<SpendGateTokenType>([
  'spark',
  'sogni',
]);

const SPEND_GATE_DECISIONS: ReadonlySet<SpendGateDecision> = new Set<SpendGateDecision>([
  'confirm',
  'cancel',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isSpendGateState(value: unknown): value is SpendGateState {
  return typeof value === 'string' && SPEND_GATE_STATES.has(value as SpendGateState);
}

export function isSpendGateScope(value: unknown): value is SpendGateScope {
  return typeof value === 'string' && SPEND_GATE_SCOPES.has(value as SpendGateScope);
}

export function isSpendGateTokenType(value: unknown): value is SpendGateTokenType {
  return typeof value === 'string' && SPEND_GATE_TOKEN_TYPES.has(value as SpendGateTokenType);
}

export function isSpendGateDecision(value: unknown): value is SpendGateDecision {
  return typeof value === 'string' && SPEND_GATE_DECISIONS.has(value as SpendGateDecision);
}

export function isSpendGateCostBreakdownEntry(value: unknown): value is SpendGateCostBreakdownEntry {
  if (!isRecord(value)) return false;
  if (typeof value.model !== 'string') return false;
  if (typeof value.units !== 'number' || !Number.isFinite(value.units)) return false;
  if (!isSpendGateTokenType(value.tokenType)) return false;
  return true;
}

export function isSpendGatePendingToolCallRef(
  value: unknown,
): value is SpendGatePendingToolCallRef {
  if (!isRecord(value)) return false;
  if (typeof value.toolCallId !== 'string') return false;
  if (typeof value.toolName !== 'string') return false;
  return true;
}

export function isSpendGatePendingWorkflowPlanRef(
  value: unknown,
): value is SpendGatePendingWorkflowPlanRef {
  if (!isRecord(value)) return false;
  if (typeof value.workflowRunId !== 'string') return false;
  if (typeof value.templateId !== 'string') return false;
  return true;
}

export function isSpendGateEstimate(value: unknown): value is SpendGateEstimate {
  if (!isRecord(value)) return false;
  if (typeof value.capacityUnits !== 'number' || !Number.isFinite(value.capacityUnits)) return false;
  if (!Array.isArray(value.breakdown) || !value.breakdown.every(isSpendGateCostBreakdownEntry)) {
    return false;
  }
  if (!isSpendGateTokenType(value.tokenType)) return false;
  if (
    value.maxAcceptableUnits !== undefined &&
    (typeof value.maxAcceptableUnits !== 'number' || !Number.isFinite(value.maxAcceptableUnits))
  ) {
    return false;
  }
  return true;
}

export function isSpendGateRequest(value: unknown): value is SpendGateRequest {
  if (!isRecord(value)) return false;
  if (!isSpendGateScope(value.scope)) return false;
  if (value.toolCallId !== undefined && typeof value.toolCallId !== 'string') return false;
  if (value.workflowRunId !== undefined && typeof value.workflowRunId !== 'string') return false;
  if (typeof value.estimateCapacityUnits !== 'number' || !Number.isFinite(value.estimateCapacityUnits)) {
    return false;
  }
  if (!Array.isArray(value.estimateCostBreakdown)) return false;
  if (!value.estimateCostBreakdown.every(isSpendGateCostBreakdownEntry)) return false;
  if (
    value.maxAcceptableUnits !== undefined &&
    (typeof value.maxAcceptableUnits !== 'number' || !Number.isFinite(value.maxAcceptableUnits))
  ) {
    return false;
  }
  if (value.reason !== undefined && typeof value.reason !== 'string') return false;
  return true;
}

export function isSpendGate(value: unknown): value is SpendGate {
  if (!isRecord(value)) return false;
  if (!isSpendGateState(value.state)) return false;
  if (value.gateId !== undefined && typeof value.gateId !== 'string') return false;
  if (value.scope !== undefined && !isSpendGateScope(value.scope)) return false;
  if (value.runId !== undefined && typeof value.runId !== 'string') return false;
  if (value.estimate !== undefined && !isSpendGateEstimate(value.estimate)) return false;
  if (value.reason !== undefined && typeof value.reason !== 'string') return false;
  if (
    value.pendingToolCalls !== undefined &&
    (!Array.isArray(value.pendingToolCalls) ||
      !value.pendingToolCalls.every(isSpendGatePendingToolCallRef))
  ) {
    return false;
  }
  if (
    value.pendingWorkflowPlan !== undefined &&
    !isSpendGatePendingWorkflowPlanRef(value.pendingWorkflowPlan)
  ) {
    return false;
  }
  if (value.createdAt !== undefined && typeof value.createdAt !== 'string') return false;
  if (value.updatedAt !== undefined && typeof value.updatedAt !== 'string') return false;
  if (value.decidedAt !== undefined && typeof value.decidedAt !== 'string') return false;
  if (value.decision !== undefined && !isSpendGateDecision(value.decision)) return false;
  if (value.request !== undefined && !isSpendGateRequest(value.request)) return false;
  if (value.failureReason !== undefined && typeof value.failureReason !== 'string') return false;
  return true;
}

/**
 * Stub validator. Returns `{ valid: true, errors: [] }` while the public
 * API surface stabilizes; real Ajv/zod wiring lands when
 * `@sogni-ai/sogni-protocol` codegens the schema.
 */
export function validateSpendGateRequest(_value: unknown): { valid: boolean; errors: string[] } {
  return { valid: true, errors: [] };
}
