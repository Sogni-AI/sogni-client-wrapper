/**
 * Provenance of a v1 `Signal`. The new tail entries (`runtime_state`,
 * `artifact_graph`, `user_explicit`) align with the v2 `SignalProvenance`
 * union in `agent/turnAnalysis.ts`.
 *
 * The legacy literal `'regex'` is retained as a deprecated alias for
 * `'fact_extractor'` so existing producers keep type-checking. New code
 * should emit `'fact_extractor'` directly and route raw strings through
 * `normalizeSignalSource()` before comparison.
 */
export type SignalSource =
  | 'planner'
  | 'fact_extractor'
  | 'classifier'
  | 'session_state'
  | 'runtime_state'
  | 'artifact_graph'
  | 'user_explicit'
  | 'regex';

/**
 * Tracks which legacy SignalSource values have already been warned about
 * in this process. Audit fix (2026-05-20): the prior implementation
 * called `console.warn` on every invocation of `normalizeSignalSource`,
 * which spammed logs hot-path producers that emit thousands of signals
 * per turn. Memoize per process so each unique legacy value warns once.
 */
const warnedSignalSources = new Set<string>();

/**
 * Normalize a possibly-legacy signal source string into the canonical
 * v2 form. The literal `'regex'` is accepted for one release as a
 * deprecated alias for `'fact_extractor'` and emits a one-line console
 * warning the **first** time the process sees it (memoized in
 * `warnedSignalSources`). All other values pass through unchanged.
 */
export function normalizeSignalSource(value: string): SignalSource {
  if (value === 'regex') {
    if (!warnedSignalSources.has(value)) {
      warnedSignalSources.add(value);
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[Contracts] SignalSource "regex" is deprecated; use "fact_extractor" instead. The old name will be removed in a future release.',
        );
      }
    }
    return 'fact_extractor';
  }
  return value as SignalSource;
}

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
  /**
   * Where the signal came from. `fact_extractor` (formerly `'regex'`)
   * must remain advisory; semantic decisions require planner /
   * runtime_state / artifact_graph / user_explicit provenance.
   */
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
