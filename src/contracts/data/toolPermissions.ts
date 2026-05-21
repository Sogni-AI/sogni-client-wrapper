/**
 * Per-tool permission contract.
 *
 * Promotes the legacy `sideEffectLevel` registry tag (which conflated
 * cost and side-effect into one string) into a typed,
 * cross-consumer contract that the dispatcher can enforce. The
 * permission is derived from the per-tool risk level shipped in
 * `toolCostMetadata.ts`, plus a small extra field set the dispatcher
 * cares about (whether the user must approve before invocation).
 *
 * Three permission decisions a host can act on at dispatch time:
 *   - 'allow'                  — no extra gate. Safe / free tools.
 *   - 'require_user_approval'  — paid tools that consume credits or
 *                                 hit a worker. Existing chat-side
 *                                 paid-job confirmation popup already
 *                                 enforces this; hosted-chat tracks
 *                                 the same shape so audits agree.
 *   - 'require_explicit_intent' — destructive tools that mutate
 *                                 persistent user state. Requires a
 *                                 stronger signal than a generic
 *                                 "spend credits" approval.
 */

import {
  TOOL_COST_METADATA,
  type ToolCostMetadata,
  type ToolRiskLevel,
} from './toolCostMetadata.js';
import type { ContractRegistry } from '../registry.js';
import type { SignalProvenance } from '../../agent/turnAnalysis.js';

export type ToolPermissionDecision =
  | 'allow'
  | 'require_user_approval'
  | 'require_explicit_intent';

export interface ToolPermission {
  /** Canonical tool name. */
  tool: string;
  /** Permission verdict the host should enforce. */
  decision: ToolPermissionDecision;
  /** Echoed riskLevel for convenience (matches toolCostMetadata). */
  riskLevel: ToolRiskLevel;
  /** True when the host must surface a confirmation UI / explicit
   *  user signal before invoking. Equivalent to
   *  decision !== 'allow'. */
  requiresUserApproval: boolean;
  /** Short label the host can show in approval popups / replay
   *  viewer. Sourced from the tool cost metadata. */
  userVisibleCost: string;
}

export interface PermissionGateOutcome {
  /** True when the call is allowed to proceed to the handler. */
  allowed: boolean;
  /** When false, a friendly explanation the dispatcher can surface. */
  reason?: string;
  /** Echoed decision for telemetry. */
  decision: ToolPermissionDecision;
}

export interface PermissionGateInput {
  toolName: string;
  /** Most recent user message text. */
  latestUserText: string;
  /** True when the assistant is already asking a clarification question. */
  alreadyAskingClarification?: boolean;
  /**
   * Provenance of the planner/classifier signal that proposed this tool
   * call. When `'user_explicit'`, the v2 gate accepts destructive tools
   * without further checks. When missing, the v2 gate falls back to a
   * clarifying-question requirement; the legacy regex fallback can be
   * re-enabled via `INTEL_PERMISSION_GATE_LEGACY_REGEX=true` for one
   * release.
   */
  plannerProvenance?: SignalProvenance;
}

function decisionForRisk(level: ToolRiskLevel): ToolPermissionDecision {
  switch (level) {
    case 'safe':
      return 'allow';
    case 'paid':
      return 'require_user_approval';
    case 'destructive':
      return 'require_explicit_intent';
  }
}

function makePermission(entry: ToolCostMetadata): ToolPermission {
  const decision = decisionForRisk(entry.riskLevel);
  return {
    tool: entry.tool,
    decision,
    riskLevel: entry.riskLevel,
    requiresUserApproval: decision !== 'allow',
    userVisibleCost: entry.userVisibleCost,
  };
}

/** Frozen list, derived from TOOL_COST_METADATA at module load. */
export const TOOL_PERMISSIONS: ReadonlyArray<ToolPermission> =
  TOOL_COST_METADATA.map(makePermission);

const PERMISSION_BY_TOOL = new Map<string, ToolPermission>(
  TOOL_PERMISSIONS.map((entry) => [entry.tool, entry]),
);

/**
 * Lookup. Returns undefined for unknown tool names; callers decide
 * the default (typically `allow` for read-only utilities, but the
 * dispatcher MUST refuse to fabricate a permission for an unknown
 * tool when the loop is in strict mode).
 */
export function getToolPermission(toolName: string): ToolPermission | undefined {
  return PERMISSION_BY_TOOL.get(toolName);
}

/**
 * Returns true when the host must surface an approval UI before
 * invoking. Convenience wrapper so call sites don't have to look up
 * the full record.
 */
export function toolRequiresUserApproval(toolName: string): boolean {
  const entry = getToolPermission(toolName);
  return entry ? entry.requiresUserApproval : false;
}

/**
 * Default decision for an unknown tool. Defaults to 'allow' so the
 * chat product's safe / utility tools that don't appear in
 * TOOL_COST_METADATA do not block on permission. Hosted-chat or
 * other strict consumers can override this by checking
 * getToolPermission directly.
 */
export function getToolPermissionDecision(toolName: string): ToolPermissionDecision {
  return getToolPermission(toolName)?.decision ?? 'allow';
}

/**
 * Legacy per-tool regex for "the user explicitly asked for this destructive
 * action". Used only when `INTEL_PERMISSION_GATE_LEGACY_REGEX=true` is set
 * AND the planner did not supply a `plannerProvenance` for the call.
 *
 * In v2 the canonical authority for this gate is the L2 planner: when it
 * sees an explicit user statement in the IntentInput packet it emits
 * `provenance: 'user_explicit'`. The regex below remains as a one-release
 * safety net for hosts that have not yet wired the planner through; it
 * will be removed once those migrations land.
 */
const LEGACY_EXPLICIT_INTENT_PATTERNS: Record<string, RegExp> = {
  manage_memory:
    /\b(?:save|remember|store|note|memorize|forget|delete|remove|wipe|clear)\b[\s\S]{0,80}\b(?:memory|memories|note|notes|preference|preferences|fact|facts|profile|about\s+me)\b/i,
};

/**
 * Resolve the legacy permission-gate regex flag. When `true`, the gate
 * falls back to LEGACY_EXPLICIT_INTENT_PATTERNS for destructive tools
 * whose call does not carry a `plannerProvenance`. Default `false` in v2.
 */
function isLegacyPermissionGateRegexEnabled(): boolean {
  if (typeof process === 'undefined' || !process || !process.env) return false;
  const value = process.env.INTEL_PERMISSION_GATE_LEGACY_REGEX;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

/**
 * Evaluate whether one tool call can proceed under shared permission
 * contracts.
 *
 * - `safe` (`allow`) tools: always pass.
 * - `paid` (`require_user_approval`) tools: pass through here because the
 *   host's spend-confirmation UI enforces the gate.
 * - `destructive` (`require_explicit_intent`) tools: require typed
 *   evidence that the user actually asked for the destructive action.
 *
 * v2 contract for destructive tools: the L2 planner is the authority.
 * When the planner sees an explicit user statement in its IntentInput
 * packet it emits `provenance: 'user_explicit'`. The gate accepts that
 * provenance and proceeds. When the planner is not yet wired into a
 * given call site (`plannerProvenance` is missing), the gate requires a
 * clarifying question instead of falling back to English-keyword regex.
 *
 * For one release, hosts that need more time to wire the planner in can
 * set `INTEL_PERMISSION_GATE_LEGACY_REGEX=true` to restore the v1 regex
 * fallback. The flag — and the underlying
 * `LEGACY_EXPLICIT_INTENT_PATTERNS` table — will be removed in a future
 * release.
 */
export function evaluatePermissionGate(input: PermissionGateInput): PermissionGateOutcome {
  const perm = getToolPermission(input.toolName);
  if (!perm) {
    return { allowed: true, decision: 'allow' };
  }
  if (perm.decision === 'allow' || perm.decision === 'require_user_approval') {
    return { allowed: true, decision: perm.decision };
  }
  if (input.alreadyAskingClarification) {
    return { allowed: true, decision: perm.decision };
  }

  // v2 path: planner provenance is the authority for destructive tools.
  if (input.plannerProvenance === 'user_explicit') {
    return { allowed: true, decision: 'require_explicit_intent' };
  }

  // Legacy fallback: only when explicitly opted in via env flag AND the
  // planner did not supply a provenance. Will be removed next release.
  if (input.plannerProvenance === undefined && isLegacyPermissionGateRegexEnabled()) {
    const legacyPattern = LEGACY_EXPLICIT_INTENT_PATTERNS[input.toolName];
    if (legacyPattern && legacyPattern.test(input.latestUserText)) {
      return { allowed: true, decision: 'require_explicit_intent' };
    }
  }

  return {
    allowed: false,
    decision: 'require_explicit_intent',
    reason: `${input.toolName} requires explicit user intent. The planner has not confirmed this; please ask the user to confirm before invoking.`,
  };
}

/**
 * Populate a ContractRegistry's `permissions` collection. Idempotent.
 */
export function populateToolPermissions(registry: ContractRegistry): void {
  for (const permission of TOOL_PERMISSIONS) {
    registry.registerToolPermission(permission);
  }
}
