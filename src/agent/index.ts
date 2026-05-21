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
  type IntentInput,
  type LegacyIntentInputV0,
  isArtifactType,
  isIntentInputPendingActionRef,
  isIntentInputLastToolResultRef,
  isIntentInputActiveState,
  isIntentInputArtifactState,
  isIntentInputRecentTurn,
  isIntentInput,
  validateIntentInput,
} from './intentInput.js';

export {
  type TurnKind,
  type TurnIntent,
  type TurnExecutionMode,
  type SignalProvenance,
  type TurnAnalysis,
  isTurnKind,
  isTurnIntent,
  isTurnExecutionMode,
  isSignalProvenance,
  isTurnAnalysis,
  validateTurnAnalysis,
} from './turnAnalysis.js';
