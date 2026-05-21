/**
 * WorkflowAuthorization — umbrella consent the user grants once at workflow
 * start so the workflow runner doesn't have to pause for cost approval on
 * every stage.
 *
 * **Authorize once at workflow start; per-job settlement continues through
 * the existing sogni-socket "project + N identical jobs" path. The workflow
 * layer is an authorization umbrella, not a new transaction ledger.**
 * (Codex Reconciliation override §1.A.) Stage-level settlements here are
 * bookkeeping mirrors of the real sogni-socket project + jobs settlement;
 * we do not re-implement transaction state.
 *
 * Plan: docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7 + §13.1.
 */

/**
 * Capacity unit denomination. Named separately from `SpendGateTokenType`
 * so workflow code can import without pulling the SpendGate types.
 */
export type WorkflowSpendTokenType = 'spark' | 'sogni';

/**
 * Cost preview shown to the user before they confirm a workflow run.
 * Generated from the template inputs and the planner's stage breakdown;
 * `validityUntil` lets the runner reject a confirmation that arrives
 * after upstream pricing changed.
 */
export interface WorkflowCostPreview {
  templateId: string;
  inputs: Record<string, unknown>;
  totalEstimatedCapacityUnits: number;
  perStageBreakdown: Array<{
    stageId: string;
    units: number;
    /** Assumptions used to compute this stage's estimate (model picks, batch sizes, etc.). */
    assumptions: string[];
  }>;
  tokenType: WorkflowSpendTokenType;
  /** Optional caller-supplied cap (mirrors `SpendGateRequest.maxAcceptableUnits`). */
  maxAcceptableUnits?: number;
  /** Expected wall-clock duration the UI surfaces alongside cost. */
  expectedDurationSeconds: number;
  /** ISO timestamp; runner rejects confirmations received after this. */
  validityUntil: string;
}

/**
 * User decision on a workflow cost preview. The accepted preview is
 * captured verbatim so audit logs can show exactly what the user agreed to.
 */
export interface WorkflowRunConfirmation {
  workflowRunId: string;
  decision: 'confirm' | 'cancel';
  acceptedCostPreview: WorkflowCostPreview;
}

/**
 * Per-stage settlement state. **Bookkeeping only** — the real
 * transaction state lives on the sogni-socket project + jobs that the
 * stage dispatches. `projectId` / `jobIds` are the back-references into
 * that authoritative ledger.
 */
export type StageSettlementStatus = 'pending' | 'in_flight' | 'settled' | 'failed' | 'cancelled';

export interface StageSettlement {
  stageId: string;
  /** Sogni project id this stage dispatched (when known). */
  projectId?: string;
  /** Sogni job ids this stage dispatched. */
  jobIds: string[];
  estimatedUnits: number;
  /** Final settled units from the project + jobs payload, if available. */
  settledUnits?: number;
  status: StageSettlementStatus;
}

/**
 * Live workflow authorization. `cumulativeSettledUnits` and
 * `cumulativeReservedUnits` are derived from `stageSettlements`; the
 * runner updates them as the per-stage sogni-socket projects settle.
 */
export interface WorkflowAuthorization {
  workflowRunId: string;
  authorizedCapacityUnits: number;
  tokenType: WorkflowSpendTokenType;
  authorizedAt: string;
  /** ISO timestamp after which the authorization must be re-confirmed. */
  expiresAt: string;
  cumulativeSettledUnits: number;
  cumulativeReservedUnits: number;
  stageSettlements: StageSettlement[];
}

const WORKFLOW_TOKEN_TYPES: ReadonlySet<WorkflowSpendTokenType> = new Set<WorkflowSpendTokenType>([
  'spark',
  'sogni',
]);

const STAGE_SETTLEMENT_STATUSES: ReadonlySet<StageSettlementStatus> = new Set<StageSettlementStatus>([
  'pending',
  'in_flight',
  'settled',
  'failed',
  'cancelled',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isWorkflowSpendTokenType(value: unknown): value is WorkflowSpendTokenType {
  return typeof value === 'string' && WORKFLOW_TOKEN_TYPES.has(value as WorkflowSpendTokenType);
}

export function isStageSettlementStatus(value: unknown): value is StageSettlementStatus {
  return typeof value === 'string' && STAGE_SETTLEMENT_STATUSES.has(value as StageSettlementStatus);
}

function isStageBreakdownEntry(value: unknown): value is WorkflowCostPreview['perStageBreakdown'][number] {
  if (!isRecord(value)) return false;
  if (typeof value.stageId !== 'string') return false;
  if (typeof value.units !== 'number' || !Number.isFinite(value.units)) return false;
  if (!isStringArray(value.assumptions)) return false;
  return true;
}

export function isWorkflowCostPreview(value: unknown): value is WorkflowCostPreview {
  if (!isRecord(value)) return false;
  if (typeof value.templateId !== 'string') return false;
  if (!isRecord(value.inputs)) return false;
  if (
    typeof value.totalEstimatedCapacityUnits !== 'number' ||
    !Number.isFinite(value.totalEstimatedCapacityUnits)
  ) {
    return false;
  }
  if (!Array.isArray(value.perStageBreakdown) || !value.perStageBreakdown.every(isStageBreakdownEntry)) {
    return false;
  }
  if (!isWorkflowSpendTokenType(value.tokenType)) return false;
  if (
    value.maxAcceptableUnits !== undefined &&
    (typeof value.maxAcceptableUnits !== 'number' || !Number.isFinite(value.maxAcceptableUnits))
  ) {
    return false;
  }
  if (
    typeof value.expectedDurationSeconds !== 'number' ||
    !Number.isFinite(value.expectedDurationSeconds)
  ) {
    return false;
  }
  if (typeof value.validityUntil !== 'string') return false;
  return true;
}

export function isWorkflowRunConfirmation(value: unknown): value is WorkflowRunConfirmation {
  if (!isRecord(value)) return false;
  if (typeof value.workflowRunId !== 'string') return false;
  if (value.decision !== 'confirm' && value.decision !== 'cancel') return false;
  if (!isWorkflowCostPreview(value.acceptedCostPreview)) return false;
  return true;
}

export function isStageSettlement(value: unknown): value is StageSettlement {
  if (!isRecord(value)) return false;
  if (typeof value.stageId !== 'string') return false;
  if (value.projectId !== undefined && typeof value.projectId !== 'string') return false;
  if (!isStringArray(value.jobIds)) return false;
  if (typeof value.estimatedUnits !== 'number' || !Number.isFinite(value.estimatedUnits)) return false;
  if (
    value.settledUnits !== undefined &&
    (typeof value.settledUnits !== 'number' || !Number.isFinite(value.settledUnits))
  ) {
    return false;
  }
  if (!isStageSettlementStatus(value.status)) return false;
  return true;
}

export function isWorkflowAuthorization(value: unknown): value is WorkflowAuthorization {
  if (!isRecord(value)) return false;
  if (typeof value.workflowRunId !== 'string') return false;
  if (
    typeof value.authorizedCapacityUnits !== 'number' ||
    !Number.isFinite(value.authorizedCapacityUnits)
  ) {
    return false;
  }
  if (!isWorkflowSpendTokenType(value.tokenType)) return false;
  if (typeof value.authorizedAt !== 'string') return false;
  if (typeof value.expiresAt !== 'string') return false;
  if (
    typeof value.cumulativeSettledUnits !== 'number' ||
    !Number.isFinite(value.cumulativeSettledUnits)
  ) {
    return false;
  }
  if (
    typeof value.cumulativeReservedUnits !== 'number' ||
    !Number.isFinite(value.cumulativeReservedUnits)
  ) {
    return false;
  }
  if (!Array.isArray(value.stageSettlements) || !value.stageSettlements.every(isStageSettlement)) {
    return false;
  }
  return true;
}

/**
 * Stub validator. Returns `{ valid: true, errors: [] }` while the public
 * API surface stabilizes; real Ajv/zod wiring lands when
 * `@sogni-ai/sogni-protocol` codegens the schema.
 */
export function validateWorkflowCostPreview(_value: unknown): { valid: boolean; errors: string[] } {
  return { valid: true, errors: [] };
}

/**
 * Stub validator. Returns `{ valid: true, errors: [] }` while the public
 * API surface stabilizes; real Ajv/zod wiring lands when
 * `@sogni-ai/sogni-protocol` codegens the schema.
 */
export function validateWorkflowAuthorization(_value: unknown): { valid: boolean; errors: string[] } {
  return { valid: true, errors: [] };
}
