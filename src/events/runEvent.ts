/**
 * RunEvent — unified event vocabulary for v2 chat runs and workflow runs.
 * Replaces the parallel event types that grew up in `chatRun/index.ts`
 * (chat) and `backboneDurableWorkflow.ts` (workflows) with one stream so
 * UI, SSE replay, billing, and quality-audit consumers don't have to
 * branch by run kind.
 *
 * The chat-run subset is already shipped on `ChatRunEvent.type` in
 * `chatRun/index.ts`; v2 keeps the same wire names so durable consumers
 * can migrate in place without touching the network layer.
 *
 * Drift fix (audit 2026-05-20): pre-fix the canonical union was missing
 * `spend_gate_opened`, the workflow-stage events (`stage_started`,
 * `stage_completed`, `stage_failed`, `stage_waiting_for_user`), and the
 * `runKind` discriminator. Consumers were emitting those event types and
 * carrying a `runKind` (notably `'tool_batch'` from
 * `sogni-creative-agent-v2/src/agent/sharedTypes.ts`) without canonical
 * coverage. The union is now a SUPERSET of every event type any current
 * consumer emits, and `runKind` is a first-class field on `RunEvent`.
 *
 * Plan: docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7 + §11 + §12 + §13.1.
 */

/**
 * Substrate discriminator (plan §13.5). `chat` and `workflow` runs share
 * persistence, lease, heartbeat, event log, waiting semantics,
 * cancellation, cost confirmation, and resume. `tool_batch` is used by
 * `sogni-creative-agent-v2` for fan-out tool-call runs that share the
 * same event substrate without being a full chat or workflow run.
 */
export type RunKind = 'chat' | 'workflow' | 'tool_batch';

/**
 * All event types in the v2 unified vocabulary. Grouped here by purpose
 * for readability; consumers may treat the union as opaque strings. The
 * superset includes every event type emitted by any current consumer
 * (`sogni-creative-agent-v2`, `sogni-chat`, `sogni-api`) plus the
 * schema-mandated set.
 */
export type RunEventType =
  // Lifecycle
  | 'run_created'
  | 'run_queued'
  | 'run_started'
  | 'run_resumed'
  | 'run_completed'
  | 'run_partial_failure'
  | 'run_failed'
  | 'run_cancelled'
  // LLM
  | 'llm_round_started'
  | 'llm_token'
  | 'llm_round_completed'
  | 'assistant_message_delta'
  | 'assistant_message_completed'
  // Tools
  | 'tool_call_proposed'
  | 'tool_call_dispatched'
  | 'tool_call_progress'
  | 'tool_call_resolved'
  // Artifacts
  | 'artifact_created'
  | 'artifact_updated'
  | 'artifact_referenced'
  // Media context (mirrors chat-run subset)
  | 'media_context_updated'
  | 'media_turn_intent_classified'
  | 'asset_manifest_updated'
  // Pauses
  | 'run_waiting_for_user'
  // Spend / billing
  | 'billing_preview_updated'
  | 'spend_gate_opened'
  | 'spend_preview_emitted'
  | 'spend_confirmed'
  | 'spend_cancelled'
  | 'spend_insufficient'
  | 'run_awaiting_cost_confirmation'
  | 'run_cost_confirmation_resolved'
  // Workflow stages
  | 'stage_started'
  | 'stage_completed'
  | 'stage_failed'
  | 'stage_waiting_for_user'
  // Audit
  | 'audit_evaluated'
  | 'repair_requested';

/**
 * Reason a run is paused in `run_waiting_for_user`. Mirrors
 * `ChatRunWaitingReason` plus workflow-only stop reasons from §13.1.
 */
export type RunWaitingReason =
  | 'ask_clarifying_question'
  | 'select_media_required'
  | 'cost_approval_required'
  | 'safety_review_required'
  | 'workflow_user_input_required'
  | 'insufficient_credit'
  | 'other';

/**
 * One event in a run's SSE-replayable event log. `sequence` is monotonic
 * within a single `runId`. `payload` is opaque — typed payloads are
 * declared per event-type elsewhere. `runKind` is the substrate
 * discriminator so consumers don't have to look up the parent run to
 * tell a chat tick from a workflow stage tick.
 */
export interface RunEvent {
  runId: string;
  /**
   * Substrate discriminator. Optional on the in-memory type so legacy
   * producers stay valid for one release; required at the wire level per
   * `schemas/events/run-event.schema.json`.
   */
  runKind?: RunKind;
  sequence: number;
  type: RunEventType;
  /** Optional status string (e.g. tool dispatch status, run status snapshot). */
  status?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  /** True when consumers may resume from this event with `Last-Event-ID`. */
  resumable?: boolean;
  /** True when this event terminates the run. */
  terminal?: boolean;
  /** Caller-supplied idempotency key for dedupe at the producer. */
  idempotencyKey?: string;
}

const RUN_EVENT_TYPES: ReadonlySet<RunEventType> = new Set<RunEventType>([
  'run_created',
  'run_queued',
  'run_started',
  'run_resumed',
  'run_completed',
  'run_partial_failure',
  'run_failed',
  'run_cancelled',
  'llm_round_started',
  'llm_token',
  'llm_round_completed',
  'assistant_message_delta',
  'assistant_message_completed',
  'tool_call_proposed',
  'tool_call_dispatched',
  'tool_call_progress',
  'tool_call_resolved',
  'artifact_created',
  'artifact_updated',
  'artifact_referenced',
  'media_context_updated',
  'media_turn_intent_classified',
  'asset_manifest_updated',
  'run_waiting_for_user',
  'billing_preview_updated',
  'spend_gate_opened',
  'spend_preview_emitted',
  'spend_confirmed',
  'spend_cancelled',
  'spend_insufficient',
  'run_awaiting_cost_confirmation',
  'run_cost_confirmation_resolved',
  'stage_started',
  'stage_completed',
  'stage_failed',
  'stage_waiting_for_user',
  'audit_evaluated',
  'repair_requested',
]);

const TERMINAL_EVENT_TYPES: ReadonlySet<RunEventType> = new Set<RunEventType>([
  'run_completed',
  'run_failed',
  'run_partial_failure',
  'run_cancelled',
]);

const RESUMABLE_EVENT_TYPES: ReadonlySet<RunEventType> = new Set<RunEventType>([
  'run_waiting_for_user',
  'stage_waiting_for_user',
  'run_queued',
  'run_started',
  'run_resumed',
  'llm_round_started',
]);

const RUN_KINDS: ReadonlySet<RunKind> = new Set<RunKind>(['chat', 'workflow', 'tool_batch']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isRunKind(value: unknown): value is RunKind {
  return typeof value === 'string' && RUN_KINDS.has(value as RunKind);
}

export function isRunEventType(value: unknown): value is RunEventType {
  return typeof value === 'string' && RUN_EVENT_TYPES.has(value as RunEventType);
}

/** True for run types that finish a run (no further events expected). */
export function isTerminalEventType(type: RunEventType): boolean {
  return TERMINAL_EVENT_TYPES.has(type);
}

/** True for event types from which SSE consumers may resume. */
export function isResumableEventType(type: RunEventType): boolean {
  return RESUMABLE_EVENT_TYPES.has(type);
}

export function isRunWaitingReason(value: unknown): value is RunWaitingReason {
  return (
    value === 'ask_clarifying_question' ||
    value === 'select_media_required' ||
    value === 'cost_approval_required' ||
    value === 'safety_review_required' ||
    value === 'workflow_user_input_required' ||
    value === 'insufficient_credit' ||
    value === 'other'
  );
}

export function isRunEvent(value: unknown): value is RunEvent {
  if (!isRecord(value)) return false;
  if (typeof value.runId !== 'string') return false;
  if (value.runKind !== undefined && !isRunKind(value.runKind)) return false;
  if (typeof value.sequence !== 'number' || !Number.isFinite(value.sequence)) return false;
  if (!isRunEventType(value.type)) return false;
  if (value.status !== undefined && typeof value.status !== 'string') return false;
  if (!isRecord(value.payload)) return false;
  if (typeof value.createdAt !== 'string') return false;
  if (value.resumable !== undefined && typeof value.resumable !== 'boolean') return false;
  if (value.terminal !== undefined && typeof value.terminal !== 'boolean') return false;
  if (value.idempotencyKey !== undefined && typeof value.idempotencyKey !== 'string') return false;
  return true;
}

/** One structured validation error (see intentInput for shape rationale). */
export interface RunEventValidationError {
  path: string;
  message: string;
}

export interface RunEventValidationResult {
  valid: boolean;
  errors: RunEventValidationError[];
}

function pushError(
  errors: RunEventValidationError[],
  path: string,
  message: string,
): void {
  errors.push({ path, message });
}

/**
 * Walk a {@link RunEvent} and report each missing or wrong-typed field
 * as `{ path, message }`.
 */
export function validateRunEvent(value: unknown): RunEventValidationResult {
  const errors: RunEventValidationError[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: [{ path: '/', message: 'must be an object' }] };
  }
  if (typeof (value as { runId?: unknown }).runId !== 'string') {
    pushError(errors, '/runId', 'must be a string');
  }
  const runKind = (value as { runKind?: unknown }).runKind;
  if (runKind !== undefined && !isRunKind(runKind)) {
    pushError(errors, '/runKind', 'must be a valid RunKind when present');
  }
  const sequence = (value as { sequence?: unknown }).sequence;
  if (typeof sequence !== 'number' || !Number.isFinite(sequence)) {
    pushError(errors, '/sequence', 'must be a finite number');
  }
  if (!isRunEventType((value as { type?: unknown }).type)) {
    pushError(errors, '/type', 'must be a valid RunEventType');
  }
  const status = (value as { status?: unknown }).status;
  if (status !== undefined && typeof status !== 'string') {
    pushError(errors, '/status', 'must be a string when present');
  }
  const payload = (value as { payload?: unknown }).payload;
  if (!isRecord(payload)) {
    pushError(errors, '/payload', 'must be an object');
  }
  if (typeof (value as { createdAt?: unknown }).createdAt !== 'string') {
    pushError(errors, '/createdAt', 'must be a string');
  }
  const resumable = (value as { resumable?: unknown }).resumable;
  if (resumable !== undefined && typeof resumable !== 'boolean') {
    pushError(errors, '/resumable', 'must be a boolean when present');
  }
  const terminal = (value as { terminal?: unknown }).terminal;
  if (terminal !== undefined && typeof terminal !== 'boolean') {
    pushError(errors, '/terminal', 'must be a boolean when present');
  }
  const idempotencyKey = (value as { idempotencyKey?: unknown }).idempotencyKey;
  if (idempotencyKey !== undefined && typeof idempotencyKey !== 'string') {
    pushError(errors, '/idempotencyKey', 'must be a string when present');
  }
  return { valid: errors.length === 0, errors };
}
