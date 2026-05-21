/**
 * IntentInput — packet read by the v2 IntentClassifier and Planner at the
 * top of every new user turn. Lives here as a public-safe TypeScript mirror
 * of `schemas/agent/intent-input.schema.json` in sogni-protocol-v2.
 *
 * Drift fix (audit 2026-05-20): pre-fix this file shipped a `userText` /
 * `active` / `artifacts` / `pendingActions[]` / `recentToolResults[]`
 * shape that disagreed with the JSON schema and with all three downstream
 * stub copies in `sogni-creative-agent-v2`, `sogni-chat`, and `sogni-api`.
 * The schema (and the consumer copies) use `currentMessage` (string),
 * `activeState` (with singular `pendingAction?` + `lastToolResult?`),
 * `artifactState` (with `selectedArtifactIds[]` + `artifactIds[]`), plus
 * `conversationSummary` and `availableCapabilitiesSummary`. This file now
 * matches that shape verbatim. The legacy shape is exported as
 * `LegacyIntentInputV0` for one release so any internal consumer of this
 * package can migrate without a churn cycle; new code MUST target
 * `IntentInput` directly.
 *
 * Sizing principle (Qwen3 256k context budget): keep artifacts and recent
 * turns WHOLE by default; trim only on measured budget pressure. The
 * `artifactIds`, `selectedArtifactIds`, and `recentTurns` arrays are
 * intentionally UNBOUNDED — they exist so the planner can reason over the
 * full lineage and conversation without having to re-fetch state.
 * Truncation is a downstream optimization, never a contract assumption.
 *
 * Plan: docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7.
 */

/** Coarse media/asset kind the planner uses for routing. */
export type ArtifactType = 'image' | 'video' | 'audio' | 'text' | 'workflow' | 'collection';

/**
 * Reference to the single pending action awaiting resolution at the time
 * the intent input is captured. Shape is intentionally opaque so producers
 * can carry runtime-specific context without expanding the schema. The
 * JSON schema mirrors this with `additionalProperties: true`.
 */
export interface IntentInputPendingActionRef {
  kind: string;
  toolName?: string;
  toolCallId?: string;
  workflowRunId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Reference to the most recent tool result the planner can consult. The
 * schema requires `toolName`, `toolCallId`, and `status`; this mirror
 * keeps `status` as `string` to match the schema's open enum (consumers
 * extend with their own status vocabulary).
 */
export interface IntentInputLastToolResultRef {
  toolName: string;
  toolCallId: string;
  status: string;
}

/**
 * Active turn state — what the run/session is currently doing. Populated
 * by the host (browser or cloud runner) from explicit runtime state. The
 * schema requires no individual fields, but every consumer populates the
 * struct itself — keep it required at the top level.
 */
export interface IntentInputActiveState {
  activeArtifactId?: string;
  activeArtifactType?: ArtifactType;
  pendingAction?: IntentInputPendingActionRef;
  awaitingConfirmation?: boolean;
  lastToolResult?: IntentInputLastToolResultRef;
  activeWorkflowRunId?: string;
}

/**
 * Artifact-graph snapshot. `selectedArtifactIds` and `artifactIds` are
 * required by the schema; both are UNBOUNDED by design. Optional `last*`
 * pointers reflect the runtime's "what just happened" focus.
 */
export interface IntentInputArtifactState {
  /** Artifacts the user or planner has explicitly focused. UNBOUNDED. */
  selectedArtifactIds: string[];
  /** All artifact ids the planner may reference. UNBOUNDED by design. */
  artifactIds: string[];
  lastGeneratedArtifactId?: string;
  lastEditedArtifactId?: string;
}

/** One prior user/assistant turn in chronological order. */
export interface IntentInputRecentTurn {
  role: 'user' | 'assistant';
  content: string;
  sequence: number;
}

/**
 * Top-level IntentInput packet. Captured once per new user turn before any
 * tool surface is composed. Field names + required set match
 * `schemas/agent/intent-input.schema.json` 2026-05-20.1 verbatim.
 */
export interface IntentInput {
  /** The user's latest text turn (already trimmed of tool-call markers). */
  currentMessage: string;
  activeState: IntentInputActiveState;
  artifactState: IntentInputArtifactState;
  /**
   * Conversation history. UNBOUNDED by design. Downstream code may
   * compact via `conversationSummary` when measured context pressure
   * demands it.
   */
  recentTurns: IntentInputRecentTurn[];
  /**
   * Rolling summary of the trimmed prefix. Empty string until the first
   * measured-budget-pressure trim event.
   */
  conversationSummary: string;
  /**
   * Short human-readable capability strings the planner can quote when
   * answering capability questions without invoking any tool.
   */
  availableCapabilitiesSummary: string[];
  /**
   * Free-form user preferences. Deliberate exception to the
   * `additionalProperties: false` rule — preferences evolve faster than
   * the schema, so the schema sets `additionalProperties: true` here.
   */
  userPreferences?: Record<string, unknown>;
}

/**
 * @deprecated Pre-2026-05-20 IntentInput shape. Retained for one release
 * so internal consumers can migrate without a churn cycle. New code MUST
 * target {@link IntentInput} directly. Will be removed in a future
 * minor version of `@sogni-ai/sogni-intelligence-client`.
 */
export interface LegacyIntentInputV0 {
  userText: string;
  recentTurns: IntentInputRecentTurn[];
  active: {
    activeRunId?: string;
    activeWorkflowRunId?: string;
    pendingActions: Array<{
      kind: string;
      toolName?: string;
      toolCallId?: string;
      workflowRunId?: string;
      payload?: Record<string, unknown>;
    }>;
    recentToolResults: Array<{
      toolCallId: string;
      toolName: string;
      status: 'ok' | 'err' | 'cancelled' | 'waiting_for_user';
      sequence?: number;
    }>;
  };
  artifacts: {
    artifactIds: string[];
    selectedArtifactId?: string;
    lastCreatedArtifactId?: string;
    byKind?: Partial<Record<ArtifactType, string[]>>;
  };
  locale?: string;
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

export function isIntentInputPendingActionRef(value: unknown): value is IntentInputPendingActionRef {
  if (!isRecord(value)) return false;
  if (typeof value.kind !== 'string') return false;
  if (value.toolName !== undefined && typeof value.toolName !== 'string') return false;
  if (value.toolCallId !== undefined && typeof value.toolCallId !== 'string') return false;
  if (value.workflowRunId !== undefined && typeof value.workflowRunId !== 'string') return false;
  if (value.payload !== undefined && !isRecord(value.payload)) return false;
  return true;
}

export function isIntentInputLastToolResultRef(
  value: unknown,
): value is IntentInputLastToolResultRef {
  if (!isRecord(value)) return false;
  if (typeof value.toolName !== 'string') return false;
  if (typeof value.toolCallId !== 'string') return false;
  if (typeof value.status !== 'string') return false;
  return true;
}

export function isIntentInputActiveState(value: unknown): value is IntentInputActiveState {
  if (!isRecord(value)) return false;
  if (value.activeArtifactId !== undefined && typeof value.activeArtifactId !== 'string') return false;
  if (value.activeArtifactType !== undefined && !isArtifactType(value.activeArtifactType)) return false;
  if (value.pendingAction !== undefined && !isIntentInputPendingActionRef(value.pendingAction)) {
    return false;
  }
  if (value.awaitingConfirmation !== undefined && typeof value.awaitingConfirmation !== 'boolean') {
    return false;
  }
  if (value.lastToolResult !== undefined && !isIntentInputLastToolResultRef(value.lastToolResult)) {
    return false;
  }
  if (value.activeWorkflowRunId !== undefined && typeof value.activeWorkflowRunId !== 'string') {
    return false;
  }
  return true;
}

export function isIntentInputArtifactState(value: unknown): value is IntentInputArtifactState {
  if (!isRecord(value)) return false;
  if (!isStringArray(value.selectedArtifactIds)) return false;
  if (!isStringArray(value.artifactIds)) return false;
  if (
    value.lastGeneratedArtifactId !== undefined &&
    typeof value.lastGeneratedArtifactId !== 'string'
  ) {
    return false;
  }
  if (value.lastEditedArtifactId !== undefined && typeof value.lastEditedArtifactId !== 'string') {
    return false;
  }
  return true;
}

export function isIntentInputRecentTurn(value: unknown): value is IntentInputRecentTurn {
  if (!isRecord(value)) return false;
  if (typeof value.role !== 'string' || !TURN_ROLES.has(value.role as IntentInputRecentTurn['role'])) return false;
  if (typeof value.content !== 'string') return false;
  if (typeof value.sequence !== 'number' || !Number.isFinite(value.sequence) || value.sequence < 0) {
    return false;
  }
  return true;
}

export function isIntentInput(value: unknown): value is IntentInput {
  if (!isRecord(value)) return false;
  if (typeof value.currentMessage !== 'string') return false;
  if (!isIntentInputActiveState(value.activeState)) return false;
  if (!isIntentInputArtifactState(value.artifactState)) return false;
  if (!Array.isArray(value.recentTurns) || !value.recentTurns.every(isIntentInputRecentTurn)) {
    return false;
  }
  if (typeof value.conversationSummary !== 'string') return false;
  if (!isStringArray(value.availableCapabilitiesSummary)) return false;
  if (value.userPreferences !== undefined && !isRecord(value.userPreferences)) return false;
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
