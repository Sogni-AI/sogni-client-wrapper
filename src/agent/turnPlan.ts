/**
 * TurnPlan — L2 Planner output consumed by the runtime executor. The
 * planner proposes; the validator validates; the executor runs. NO tools
 * are exposed to the planner itself.
 *
 * Audit fix (2026-05-20): the canonical TS for the v2 planner output had
 * no home. `sogni-creative-agent-v2/src/agent/planner.ts` ships a local
 * `TurnPlan` (lines 32-55) with a TODO to import from
 * `@sogni-ai/sogni-intelligence-client` once published. This file is
 * that canonical home.
 *
 * Naming note: the planner's spend estimate intentionally does NOT reuse
 * the name `SpendGateRequest` — that name belongs to the billing module
 * (`billing/spendGate.ts`) and describes the live gate state machine's
 * input shape. Mixing the names cost the planner schema some clarity in
 * the consumer copy. We name the planner-side shape
 * `PlannerSpendEstimate` and keep the two contracts independent. A
 * downstream caller is free to feed a `PlannerSpendEstimate` into the
 * SpendGate request constructor when it has more information.
 *
 * Plan: docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7 + §10.
 */

import { isArtifactType, type ArtifactType } from './intentInput.js';

/**
 * Reference to a single artifact the planner resolved from the user's
 * prose to a concrete `artifactId`. The optional `artifactType` mirrors
 * the `ArtifactType` union so consumers don't have to look the kind up
 * via the ArtifactGraph just to render an icon.
 */
export interface PlannerArtifactRef {
  artifactId: string;
  artifactType?: ArtifactType;
}

/**
 * Optional workflow proposal — when the planner decides one workflow
 * run is more appropriate than a list of atomic tool calls.
 */
export interface PlannerProposedWorkflow {
  /** Workflow template id the executor should consider running. */
  templateId: string;
  /** Inputs the executor should bind into the workflow run. */
  inputs: Record<string, unknown>;
  /** Optional human-readable explanation for telemetry / UI. */
  reason?: string;
}

/**
 * Narrow spend-estimate shape the planner emits. Distinct from
 * `billing/spendGate.SpendGateRequest`: the planner only knows what its
 * proposed plan would cost (or that no estimate is available); the
 * SpendGate state machine layers on `gateId`, `scope`,
 * `pendingToolCalls`, transition timestamps, etc.
 *
 * `estimateAvailable` is the disambiguator: when `false`, both
 * `tokenCost` and `usdCost` should be ignored. When `true`, either or
 * both may be populated (some models price in tokens only, others in
 * USD only).
 */
export interface PlannerSpendEstimate {
  /**
   * Best-effort capacity-unit cost (sparks or sogni). Null when the
   * planner can't estimate.
   */
  tokenCost: number | null;
  /**
   * Best-effort USD cost. Null when the planner can't estimate.
   */
  usdCost: number | null;
  /**
   * Disambiguator. False = "no estimate available — UI should not show
   * a number". True = `tokenCost` and/or `usdCost` carry signal.
   */
  estimateAvailable: boolean;
  /**
   * Optional preferred model id the planner is costing against. Lets
   * consumers attribute the estimate without re-running the planner.
   */
  preferredModel?: string;
}

/**
 * Top-level Planner output. Field set matches the local `TurnPlan` in
 * `sogni-creative-agent-v2/src/agent/planner.ts` so the upcoming switch
 * to `import type { TurnPlan } from '@sogni-ai/sogni-intelligence-client'`
 * is a drop-in.
 */
export interface TurnPlan {
  /**
   * Tool names the executor should consider for this turn. Use names
   * exactly as they appear in `IntentInput.availableCapabilitiesSummary`.
   * Empty when execution is not warranted or when `proposedWorkflow` is
   * set instead.
   */
  proposedTools: string[];
  proposedWorkflow?: PlannerProposedWorkflow;
  /**
   * Artifacts the user explicitly pointed at, resolved to stable
   * `artifactId`s. Empty when none.
   */
  resolvedReferences: PlannerArtifactRef[];
  /**
   * When set the executor should pause and ask the user before
   * spending any compute. `proposedTools` should be empty.
   */
  needsClarification?: { question: string };
  spendEstimate?: PlannerSpendEstimate;
  /** Planner confidence in this plan, in [0, 1]. */
  confidence: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isPlannerArtifactRef(value: unknown): value is PlannerArtifactRef {
  if (!isRecord(value)) return false;
  if (typeof value.artifactId !== 'string' || value.artifactId.length === 0) return false;
  if (value.artifactType !== undefined && !isArtifactType(value.artifactType)) return false;
  return true;
}

export function isPlannerProposedWorkflow(value: unknown): value is PlannerProposedWorkflow {
  if (!isRecord(value)) return false;
  if (typeof value.templateId !== 'string' || value.templateId.length === 0) return false;
  if (!isRecord(value.inputs)) return false;
  if (value.reason !== undefined && typeof value.reason !== 'string') return false;
  return true;
}

export function isPlannerSpendEstimate(value: unknown): value is PlannerSpendEstimate {
  if (!isRecord(value)) return false;
  const { tokenCost, usdCost, estimateAvailable, preferredModel } = value;
  if (tokenCost !== null && (typeof tokenCost !== 'number' || !Number.isFinite(tokenCost))) {
    return false;
  }
  if (usdCost !== null && (typeof usdCost !== 'number' || !Number.isFinite(usdCost))) {
    return false;
  }
  if (typeof estimateAvailable !== 'boolean') return false;
  if (preferredModel !== undefined && typeof preferredModel !== 'string') return false;
  return true;
}

export function isTurnPlan(value: unknown): value is TurnPlan {
  if (!isRecord(value)) return false;
  if (!isStringArray(value.proposedTools)) return false;
  if (value.proposedWorkflow !== undefined && !isPlannerProposedWorkflow(value.proposedWorkflow)) {
    return false;
  }
  if (!Array.isArray(value.resolvedReferences) || !value.resolvedReferences.every(isPlannerArtifactRef)) {
    return false;
  }
  if (value.needsClarification !== undefined) {
    if (!isRecord(value.needsClarification)) return false;
    if (
      typeof value.needsClarification.question !== 'string' ||
      value.needsClarification.question.length === 0
    ) {
      return false;
    }
  }
  if (value.spendEstimate !== undefined && !isPlannerSpendEstimate(value.spendEstimate)) {
    return false;
  }
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence)) return false;
  if (value.confidence < 0 || value.confidence > 1) return false;
  return true;
}

/**
 * Stub validator. Returns `{ valid: true, errors: [] }` while the public
 * API surface stabilizes; real Ajv/zod wiring lands when
 * `@sogni-ai/sogni-protocol` codegens the schema. Signature is stable so
 * downstream consumers can adopt it now without a churn cycle later.
 */
export function validateTurnPlan(_value: unknown): { valid: boolean; errors: string[] } {
  return { valid: true, errors: [] };
}
