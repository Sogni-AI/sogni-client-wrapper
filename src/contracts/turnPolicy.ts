export type SignalSource = 'planner' | 'regex' | 'classifier' | 'session_state';

/**
 * A Signal is a typed observation about the current turn, emitted by
 * intent classifiers. Signals fan in to the planner; decisions fan out
 * (per CLAUDE.md regex-discipline).
 */
export interface Signal {
  /** Signal name (e.g. 'mentions_aspect_ratio', 'asks_about_previous_error'). */
  kind: string;
  /** Optional matched value (e.g. '16:9' for an aspect-ratio signal). */
  value?: string;
  /** Where the signal came from. Regex must remain advisory; planner/runtime state owns decisions. */
  source: SignalSource;
}

/**
 * A ContextHint is a structured datum injected into the LLM-visible
 * <turn-context> block (e.g. asset manifest summary, active persona).
 */
export interface ContextHint {
  kind: string;
  body: string;
}

/**
 * The output of `classifyTurn`. Consumed by `compileToolsForTurn` and
 * `dispatchToolCall`. Plain data, JSON-serializable, recomputed each round.
 */
export interface TurnPolicy {
  signals: Signal[];
  visibleTools: string[];
  forbiddenTools: string[];
  /**
   * Maps each forbidden tool name to the policyId that forbade it.
   * When multiple policies forbid the same tool, last-write-wins.
   * Used by `computeDispatch` to attribute rejections to the correct policy.
   */
  forbiddenToolPolicies: Record<string, string>;
  requiredTools: string[];
  contextHints: ContextHint[];
  appliedPolicies: string[];
  rationale: string;
}

export function emptyTurnPolicy(): TurnPolicy {
  return {
    signals: [],
    visibleTools: [],
    forbiddenTools: [],
    forbiddenToolPolicies: {},
    requiredTools: [],
    contextHints: [],
    appliedPolicies: [],
    rationale: '',
  };
}
