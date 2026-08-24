/**
 * v2 agent contracts — IntentInput packet and TurnAnalysis output. See
 * docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7.
 */

export {
  type ArtifactType,
  type IntentInputPendingActionRef,
  type IntentInputLastToolResultRef,
  type IntentInputActiveState,
  type IntentInputArtifactState,
  type IntentInputRecentTurn,
  type IntentInputSurface,
  type IntentInputCurrentMessageDetails,
  type IntentInputRuntimeFlags,
  type IntentInput,
  type LegacyIntentInputV0,
  isArtifactType,
  isIntentInputPendingActionRef,
  isIntentInputLastToolResultRef,
  isIntentInputActiveState,
  isIntentInputArtifactState,
  isIntentInputRecentTurn,
  isIntentInputSurface,
  isIntentInputCurrentMessageDetails,
  isIntentInputRuntimeFlags,
  isIntentInput,
  validateIntentInput,
  type IntentInputValidationError,
  type IntentInputValidationResult,
} from './intentInput.js';

export {
  type TurnKind,
  type TurnIntent,
  type TurnExecutionMode,
  type SignalProvenance,
  type TurnTextArtifact,
  type TurnAnalysis,
  isTurnKind,
  isTurnIntent,
  isTurnExecutionMode,
  isSignalProvenance,
  isTurnTextArtifact,
  isTurnAnalysis,
  validateTurnAnalysis,
  type TurnAnalysisValidationError,
  type TurnAnalysisValidationResult,
} from './turnAnalysis.js';

export {
  type PlannerArtifactRef,
  type PlannerProposedWorkflow,
  type PlannerSpendEstimate,
  type TurnPlan,
  isPlannerArtifactRef,
  isPlannerProposedWorkflow,
  isPlannerSpendEstimate,
  isTurnPlan,
  validateTurnPlan,
  type TurnPlanValidationError,
  type TurnPlanValidationResult,
} from './turnPlan.js';

export {
  type ToolFamily,
  type ToolExecutionMode,
  type ToolCostClass,
  type ToolLatencyClass,
  type ToolConfirmationPolicy,
  type ToolRetrySafety,
  type ToolMetadata,
  isToolFamily,
  isToolExecutionMode,
  isToolCostClass,
  isToolLatencyClass,
  isToolConfirmationPolicy,
  isToolRetrySafety,
  isToolMetadata,
  validateToolMetadata,
  type ToolMetadataValidationError,
  type ToolMetadataValidationResult,
} from './toolMetadata.js';
