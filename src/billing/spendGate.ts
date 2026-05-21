/**
 * SpendGate — v2 state machine that pauses a run before any paid tool
 * call (or workflow run) until the user (or an authorization umbrella)
 * confirms. One gate per scope: per-`tool_call` for chat runs, per-
 * `workflow_run` for workflow umbrellas (which then settle per-stage via
 * the existing sogni-socket project + N jobs path — see
 * `workflowAuthorization.ts`).
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

/** One line item in the cost breakdown surfaced to the user. */
export interface SpendGateCostBreakdownEntry {
  model: string;
  units: number;
  tokenType: SpendGateTokenType;
}

/**
 * Request payload for a gate transition. Captured once when the run hits
 * a paid action; the gate state machine consumes it on every transition.
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

/** Live gate. `request` is set when `state !== 'not_required'`. */
export interface SpendGate {
  state: SpendGateState;
  request?: SpendGateRequest;
  /** ISO timestamp of the most recent transition. */
  decidedAt?: string;
  /** Who/what decided (user id, automated authorization id, etc.). */
  decidedBy?: string;
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

export function isSpendGateCostBreakdownEntry(value: unknown): value is SpendGateCostBreakdownEntry {
  if (!isRecord(value)) return false;
  if (typeof value.model !== 'string') return false;
  if (typeof value.units !== 'number' || !Number.isFinite(value.units)) return false;
  if (!isSpendGateTokenType(value.tokenType)) return false;
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
  if (value.request !== undefined && !isSpendGateRequest(value.request)) return false;
  if (value.decidedAt !== undefined && typeof value.decidedAt !== 'string') return false;
  if (value.decidedBy !== undefined && typeof value.decidedBy !== 'string') return false;
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
