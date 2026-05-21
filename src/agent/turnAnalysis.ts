/**
 * TurnAnalysis — L1 IntentClassifier output consumed by the v2 Planner
 * to build a minimal `ToolSurfacePolicy`. The classifier itself is
 * no-tool: it only emits structured facts about the user's turn.
 *
 * `SignalProvenance` deliberately omits `'regex'` per Codex Reconciliation
 * (plan §1.A) and §9 of the v2 plan: semantic decisions in v2 must come
 * from `classifier | planner | runtime_state | artifact_graph |
 * user_explicit` sources. The legacy `SignalSource` union in
 * `contracts/turnPolicy.ts` still carries `'regex'` as a deprecated alias
 * for backwards compatibility with the v1 classifier path; new code
 * targets `SignalProvenance` instead.
 *
 * Plan: docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7.
 */

/**
 * Coarse domain the turn lives in. (Plan §7 spells this as `domain` on
 * the `TurnAnalysis` interface; the type name `TurnKind` is used here for
 * clarity at the call site.)
 */
export type TurnKind =
  | 'chat'
  | 'image'
  | 'video'
  | 'audio'
  | 'analysis'
  | 'workflow'
  | 'memory'
  | 'settings'
  | 'unknown';

/** What the user is asking the agent to do within that domain. */
export type TurnIntent =
  | 'generate'
  | 'edit'
  | 'analyze'
  | 'transform'
  | 'question'
  | 'capability'
  | 'continue'
  | 'reference'
  | 'configure'
  | 'clarify'
  | 'unknown';

/** How the planner expects the turn to execute. */
export type TurnExecutionMode = 'none' | 'tool' | 'multi_tool' | 'workflow';

/**
 * Source of a v2 signal/decision. Replaces the legacy
 * `contracts/turnPolicy.ts#SignalSource` for new code. **Does NOT** include
 * `'regex'` — regular expressions emit bounded facts only; routing
 * decisions must come from a classifier, planner, runtime state, the
 * artifact graph, or an explicit user statement.
 */
export type SignalProvenance =
  | 'classifier'
  | 'planner'
  | 'runtime_state'
  | 'artifact_graph'
  | 'user_explicit';

/**
 * Structured analysis of a single user turn. Produced by the L1 classifier
 * before any tool surface is composed.
 */
export interface TurnAnalysis {
  /** Plan §7 field name is `domain`; typed as `TurnKind`. */
  domain: TurnKind;
  intent: TurnIntent;
  executionMode: TurnExecutionMode;
  /** True when the user actually wants the agent to do something now. */
  userWantsExecution: boolean;
  /** True when the user is asking "can you …" rather than "do …". */
  isCapabilityQuestion: boolean;
  /** True when the user is describing a future/conditional action. */
  isFutureInstruction: boolean;
  /** True when the user is referencing an artifact without asking for a new action. */
  isReferenceOnly: boolean;
  /** True when answering this turn requires recalling prior context. */
  needsPriorContext: boolean;
  /** Artifact ids the user explicitly referenced. */
  referencedArtifacts: string[];
  /** Capability tags the planner should ensure are reachable. */
  requiredCapabilities: string[];
  /** True when the planner should ask a clarifying question instead of dispatching tools. */
  needsClarification: boolean;
  /** Classifier confidence in this analysis, in [0, 1]. */
  confidence: number;
  /** Where this analysis came from (classifier vs planner override, etc.). */
  provenance: SignalProvenance;
}

const TURN_KINDS: ReadonlySet<TurnKind> = new Set([
  'chat',
  'image',
  'video',
  'audio',
  'analysis',
  'workflow',
  'memory',
  'settings',
  'unknown',
]);

const TURN_INTENTS: ReadonlySet<TurnIntent> = new Set([
  'generate',
  'edit',
  'analyze',
  'transform',
  'question',
  'capability',
  'continue',
  'reference',
  'configure',
  'clarify',
  'unknown',
]);

const TURN_EXECUTION_MODES: ReadonlySet<TurnExecutionMode> = new Set([
  'none',
  'tool',
  'multi_tool',
  'workflow',
]);

const SIGNAL_PROVENANCES: ReadonlySet<SignalProvenance> = new Set([
  'classifier',
  'planner',
  'runtime_state',
  'artifact_graph',
  'user_explicit',
]);

export function isTurnKind(value: unknown): value is TurnKind {
  return typeof value === 'string' && TURN_KINDS.has(value as TurnKind);
}

export function isTurnIntent(value: unknown): value is TurnIntent {
  return typeof value === 'string' && TURN_INTENTS.has(value as TurnIntent);
}

export function isTurnExecutionMode(value: unknown): value is TurnExecutionMode {
  return typeof value === 'string' && TURN_EXECUTION_MODES.has(value as TurnExecutionMode);
}

export function isSignalProvenance(value: unknown): value is SignalProvenance {
  return typeof value === 'string' && SIGNAL_PROVENANCES.has(value as SignalProvenance);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isTurnAnalysis(value: unknown): value is TurnAnalysis {
  if (!isRecord(value)) return false;
  if (!isTurnKind(value.domain)) return false;
  if (!isTurnIntent(value.intent)) return false;
  if (!isTurnExecutionMode(value.executionMode)) return false;
  if (typeof value.userWantsExecution !== 'boolean') return false;
  if (typeof value.isCapabilityQuestion !== 'boolean') return false;
  if (typeof value.isFutureInstruction !== 'boolean') return false;
  if (typeof value.isReferenceOnly !== 'boolean') return false;
  if (typeof value.needsPriorContext !== 'boolean') return false;
  if (!isStringArray(value.referencedArtifacts)) return false;
  if (!isStringArray(value.requiredCapabilities)) return false;
  if (typeof value.needsClarification !== 'boolean') return false;
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence)) return false;
  if (!isSignalProvenance(value.provenance)) return false;
  return true;
}

/**
 * Stub validator. Returns `{ valid: true, errors: [] }` while the public
 * API surface stabilizes; real Ajv/zod wiring lands when
 * `@sogni-ai/sogni-protocol` codegens the schema. Signature is stable so
 * downstream consumers can adopt it now without a churn cycle later.
 */
export function validateTurnAnalysis(_value: unknown): { valid: boolean; errors: string[] } {
  return { valid: true, errors: [] };
}
