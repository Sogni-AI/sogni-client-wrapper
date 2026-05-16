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
 * Per-tool regex for "the user explicitly asked for this destructive action".
 *
 * Only enumerated for tools whose permission decision is
 * 'require_explicit_intent'; future destructive tools should be added here in
 * the same change that marks their cost metadata entry destructive.
 */
const EXPLICIT_INTENT_PATTERNS: Record<string, RegExp> = {
  manage_memory:
    /\b(?:save|remember|store|note|memorize|forget|delete|remove|wipe|clear)\b[\s\S]{0,80}\b(?:memory|memories|note|notes|preference|preferences|fact|facts|profile|about\s+me)\b/i,
};

/**
 * Evaluate whether one tool call can proceed under shared permission contracts.
 *
 * Paid tools pass through here because host-specific confirmation UI enforces
 * the spend gate. Destructive tools require explicit user wording.
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
  const pattern = EXPLICIT_INTENT_PATTERNS[input.toolName];
  if (!pattern) {
    return {
      allowed: false,
      decision: 'require_explicit_intent',
      reason: `${input.toolName} is destructive and requires explicit user instruction. Please ask the user to confirm before invoking it.`,
    };
  }
  if (pattern.test(input.latestUserText)) {
    return { allowed: true, decision: 'require_explicit_intent' };
  }
  return {
    allowed: false,
    decision: 'require_explicit_intent',
    reason: `${input.toolName} requires the user to explicitly ask for the action (e.g. "save this", "remember that", "forget X"). The latest message does not contain that intent; ask the user to confirm before invoking.`,
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
