/**
 * v2 billing contracts — `SpendGate` state machine for per-tool/per-
 * workflow consent, plus `WorkflowAuthorization` umbrella (authorize once
 * at workflow start; per-job settlement continues through the existing
 * sogni-socket project + N jobs path). See
 * docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7 + §13.1.
 */

export {
  type SpendGateState,
  type SpendGateScope,
  type SpendGateTokenType,
  type SpendGateDecision,
  type NormalizedSpendGateDecision,
  type SpendGateCostBreakdownEntry,
  type SpendGatePendingToolCallRef,
  type SpendGatePendingWorkflowPlanRef,
  type SpendGateEstimate,
  type SpendGateRequest,
  type SpendGate,
  isSpendGateState,
  isSpendGateScope,
  isSpendGateTokenType,
  isSpendGateDecision,
  isSpendGateCostBreakdownEntry,
  isSpendGatePendingToolCallRef,
  isSpendGatePendingWorkflowPlanRef,
  isSpendGateEstimate,
  isSpendGateRequest,
  isSpendGate,
  normalizeSpendDecision,
  validateSpendGateRequest,
  validateSpendGate,
  type SpendGateValidationError,
  type SpendGateValidationResult,
} from './spendGate.js';

export {
  type WorkflowSpendTokenType,
  type WorkflowCostPreview,
  type WorkflowRunConfirmation,
  type StageSettlementStatus,
  type StageSettlement,
  type WorkflowAuthorization,
  isWorkflowSpendTokenType,
  isStageSettlementStatus,
  isWorkflowCostPreview,
  isWorkflowRunConfirmation,
  isStageSettlement,
  isWorkflowAuthorization,
  validateWorkflowCostPreview,
  validateWorkflowAuthorization,
  type WorkflowAuthorizationValidationError,
  type WorkflowAuthorizationValidationResult,
} from './workflowAuthorization.js';
