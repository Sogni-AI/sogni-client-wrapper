/**
 * IntentInput — packet read by the v2 IntentClassifier and Planner at the
 * top of every new user turn. Lives here as a public-safe TypeScript mirror
 * until `@sogni-ai/sogni-protocol` codegens the canonical schema.
 *
 * Sizing principle (Qwen3 256k context budget): keep artifacts and recent
 * turns WHOLE by default; trim only on measured budget pressure. The
 * `artifactIds` and `recentTurns` arrays are intentionally UNBOUNDED — they
 * exist so the planner can reason over the full lineage and conversation
 * without having to re-fetch state. Truncation is a downstream optimization,
 * never a contract assumption.
 *
 * Plan: docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7.
 */

/** Coarse media/asset kind the planner uses for routing. */
export type ArtifactType = 'image' | 'video' | 'audio' | 'text' | 'workflow' | 'collection';

/**
 * Reference to a pending action that has not yet resolved at the time the
 * intent input is captured (e.g. a tool call awaiting the worker, a
 * workflow stage waiting on the user). Opaque payload so producers can
 * carry extra context without expanding the contract.
 */
export interface PendingActionRef {
  kind: string;
  toolName?: string;
  toolCallId?: string;
  workflowRunId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Reference to a prior tool result the planner can consult. Discriminated
 * by `status` so callers can skip failures/cancels without re-reading
 * envelopes.
 */
export interface ToolResultRef {
  toolCallId: string;
  toolName: string;
  status: 'ok' | 'err' | 'cancelled' | 'waiting_for_user';
  sequence?: number;
}

/** Active turn state — what the run/session is currently doing. */
export interface IntentInputActiveState {
  activeRunId?: string;
  activeWorkflowRunId?: string;
  pendingActions: PendingActionRef[];
  recentToolResults: ToolResultRef[];
}

/**
 * Artifact-graph snapshot. `artifactIds` is UNBOUNDED — keep the whole
 * lineage available by default; trim only on measured budget pressure.
 */
export interface IntentInputArtifactState {
  /**
   * All artifact ids the planner may reference. UNBOUNDED by design (see
   * the file header on the Qwen3 256k context budget).
   */
  artifactIds: string[];
  selectedArtifactId?: string;
  lastCreatedArtifactId?: string;
  byKind?: Partial<Record<ArtifactType, string[]>>;
}

/**
 * One prior user/assistant turn in chronological order. Stored as plain
 * text (post-sanitization) so the planner can read it without re-parsing
 * OpenAI content-part envelopes.
 */
export interface IntentInputRecentTurn {
  role: 'user' | 'assistant';
  content: string;
  sequence: number;
}

/**
 * Top-level IntentInput packet. Captured once per new user turn before any
 * tool surface is composed.
 */
export interface IntentInput {
  /** The user's latest text turn (already trimmed of tool-call markers). */
  userText: string;
  /**
   * Conversation history. UNBOUNDED by design (see file header). Downstream
   * code may compact when measured context pressure demands it.
   */
  recentTurns: IntentInputRecentTurn[];
  active: IntentInputActiveState;
  artifacts: IntentInputArtifactState;
  /** Optional caller-supplied locale hint. */
  locale?: string;
  /** Optional caller-supplied debug/correlation id. */
  correlationId?: string;
}

const ARTIFACT_TYPES: ReadonlySet<ArtifactType> = new Set([
  'image',
  'video',
  'audio',
  'text',
  'workflow',
  'collection',
]);

const TOOL_RESULT_STATUSES: ReadonlySet<ToolResultRef['status']> = new Set([
  'ok',
  'err',
  'cancelled',
  'waiting_for_user',
]);

const TURN_ROLES: ReadonlySet<IntentInputRecentTurn['role']> = new Set(['user', 'assistant']);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isArtifactType(value: unknown): value is ArtifactType {
  return typeof value === 'string' && ARTIFACT_TYPES.has(value as ArtifactType);
}

export function isPendingActionRef(value: unknown): value is PendingActionRef {
  if (!isRecord(value)) return false;
  if (typeof value.kind !== 'string') return false;
  if (value.toolName !== undefined && typeof value.toolName !== 'string') return false;
  if (value.toolCallId !== undefined && typeof value.toolCallId !== 'string') return false;
  if (value.workflowRunId !== undefined && typeof value.workflowRunId !== 'string') return false;
  if (value.payload !== undefined && !isRecord(value.payload)) return false;
  return true;
}

export function isToolResultRef(value: unknown): value is ToolResultRef {
  if (!isRecord(value)) return false;
  if (typeof value.toolCallId !== 'string') return false;
  if (typeof value.toolName !== 'string') return false;
  if (typeof value.status !== 'string' || !TOOL_RESULT_STATUSES.has(value.status as ToolResultRef['status'])) {
    return false;
  }
  if (value.sequence !== undefined && (typeof value.sequence !== 'number' || !Number.isFinite(value.sequence))) {
    return false;
  }
  return true;
}

export function isIntentInputActiveState(value: unknown): value is IntentInputActiveState {
  if (!isRecord(value)) return false;
  if (value.activeRunId !== undefined && typeof value.activeRunId !== 'string') return false;
  if (value.activeWorkflowRunId !== undefined && typeof value.activeWorkflowRunId !== 'string') return false;
  if (!Array.isArray(value.pendingActions) || !value.pendingActions.every(isPendingActionRef)) return false;
  if (!Array.isArray(value.recentToolResults) || !value.recentToolResults.every(isToolResultRef)) return false;
  return true;
}

export function isIntentInputArtifactState(value: unknown): value is IntentInputArtifactState {
  if (!isRecord(value)) return false;
  if (!isStringArray(value.artifactIds)) return false;
  if (value.selectedArtifactId !== undefined && typeof value.selectedArtifactId !== 'string') return false;
  if (value.lastCreatedArtifactId !== undefined && typeof value.lastCreatedArtifactId !== 'string') return false;
  if (value.byKind !== undefined) {
    if (!isRecord(value.byKind)) return false;
    for (const [k, v] of Object.entries(value.byKind)) {
      if (!isArtifactType(k)) return false;
      if (!isStringArray(v)) return false;
    }
  }
  return true;
}

export function isIntentInputRecentTurn(value: unknown): value is IntentInputRecentTurn {
  if (!isRecord(value)) return false;
  if (typeof value.role !== 'string' || !TURN_ROLES.has(value.role as IntentInputRecentTurn['role'])) return false;
  if (typeof value.content !== 'string') return false;
  if (typeof value.sequence !== 'number' || !Number.isFinite(value.sequence)) return false;
  return true;
}

export function isIntentInput(value: unknown): value is IntentInput {
  if (!isRecord(value)) return false;
  if (typeof value.userText !== 'string') return false;
  if (!Array.isArray(value.recentTurns) || !value.recentTurns.every(isIntentInputRecentTurn)) return false;
  if (!isIntentInputActiveState(value.active)) return false;
  if (!isIntentInputArtifactState(value.artifacts)) return false;
  if (value.locale !== undefined && typeof value.locale !== 'string') return false;
  if (value.correlationId !== undefined && typeof value.correlationId !== 'string') return false;
  return true;
}

/**
 * Stub validator. Returns `{ valid: true, errors: [] }` while the public
 * API surface stabilizes; real Ajv/zod wiring lands when
 * `@sogni-ai/sogni-protocol` codegens the schema. Signature is stable so
 * downstream consumers can adopt it now without a churn cycle later.
 */
export function validateIntentInput(_value: unknown): { valid: boolean; errors: string[] } {
  return { valid: true, errors: [] };
}
