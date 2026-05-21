import type { SignalSource } from './turnPolicy.js';

/**
 * A ToolGatingPolicy maps signal patterns to per-tool forbid/require
 * effects, evaluated each turn by `classifyTurn`. Replaces the prose
 * guards in chatService.ts and the regex predicates feeding them.
 */
export interface ToolGatingPolicyTrigger {
  /** All listed signals must be present for the trigger to fire. */
  allOf: string[];
  /** None of the listed signals may be present (optional). */
  noneOf?: string[];
  /**
   * Optional provenance constraints for listed signals. Use this for expensive
   * routing/repair gates so advisory regex/classifier signals cannot become
   * the sole authority for a tool decision.
   */
  sources?: Record<string, SignalSource | SignalSource[]>;
}

export interface ToolGatingPolicyEffect {
  /** Tools that must be removed from `visibleTools` when the policy fires. */
  forbid: string[];
  /** Tools the LLM should be steered toward (added to `requiredTools`). */
  require?: string[];
}

export interface ToolGatingPolicy {
  policyId: string;
  version: string;
  trigger: ToolGatingPolicyTrigger;
  effect: ToolGatingPolicyEffect;
  /** User-/LLM-facing explanation when the policy fires. */
  rationale: string;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isSignalSource(value: unknown): value is SignalSource {
  return value === 'planner'
    || value === 'fact_extractor'
    || value === 'classifier'
    || value === 'session_state'
    || value === 'runtime_state'
    || value === 'artifact_graph'
    || value === 'user_explicit'
    // Deprecated alias for 'fact_extractor'; kept for one release.
    || value === 'regex';
}

function isSourceConstraintMap(value: unknown): value is Record<string, SignalSource | SignalSource[]> {
  if (value === undefined) return true;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((constraint) =>
    isSignalSource(constraint)
    || (Array.isArray(constraint) && constraint.length > 0 && constraint.every(isSignalSource)),
  );
}

function isTrigger(value: unknown): value is ToolGatingPolicyTrigger {
  if (value === null || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  if (!isStringArray(t.allOf)) return false;
  if (t.noneOf !== undefined && !isStringArray(t.noneOf)) return false;
  // A trigger must carry at least one signal-based condition. An empty
  // `allOf` is allowed only when `noneOf` is non-empty — that expresses
  // "fire by default, suppressed by these signals" (category-lock shape).
  // Rejecting both-empty catches the authoring mistake of a turn-wide
  // forbid/require with no signal gate at all.
  const hasAllOf = t.allOf.length > 0;
  const hasNoneOf = Array.isArray(t.noneOf) && t.noneOf.length > 0;
  if (!hasAllOf && !hasNoneOf) return false;
  if (!isSourceConstraintMap(t.sources)) return false;
  return true;
}

function isEffect(value: unknown): value is ToolGatingPolicyEffect {
  if (value === null || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  if (!isStringArray(e.forbid)) return false;
  if (e.require !== undefined && !isStringArray(e.require)) return false;
  return true;
}

export function isToolGatingPolicy(value: unknown): value is ToolGatingPolicy {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.policyId !== 'string' || v.policyId.length === 0) return false;
  if (typeof v.version !== 'string' || v.version.length === 0) return false;
  if (!isTrigger(v.trigger)) return false;
  if (!isEffect(v.effect)) return false;
  if (typeof v.rationale !== 'string') return false;
  return true;
}
