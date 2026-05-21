/**
 * v2 unified run event vocabulary. See
 * docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7 + §11 + §12.
 */

export {
  type RunKind,
  type RunEventType,
  type RunWaitingReason,
  type RunEvent,
  isRunKind,
  isRunEventType,
  isRunWaitingReason,
  isRunEvent,
  isTerminalEventType,
  isResumableEventType,
  validateRunEvent,
  type RunEventValidationError,
  type RunEventValidationResult,
} from './runEvent.js';
