/**
 * Pure helpers for the wf:retry_until_condition primitive.
 *
 * The primitive lets a workflow author wrap any other tool call with a
 * bounded retry loop that fires until either:
 *   - the wrapped tool returns ToolOk AND the optional `condition`
 *     predicate evaluates truthy on its result, or
 *   - `maxAttempts` total tries have been spent.
 * Runtime handlers should surface the terminal attempt exactly as the
 * host executor does. In current workflow execution that means re-throwing
 * the final tool failure, not returning it as a successful primitive result.
 *
 * The predicate is a tiny safe-ish expression evaluator — workflow
 * authors don't get full JS, just dot-paths and a handful of
 * comparison operators. Keeps the contract explicit and pinnable.
 */

export interface RetryUntilArgs {
  /** The underlying tool name to invoke. Must NOT be `wf:retry_until_condition` (no recursion). */
  tool: string;
  /** Args to pass to the underlying tool. */
  toolArgs: Record<string, unknown>;
  /** Maximum total attempts (1-10). Always set by `parseRetryUntilArgs`. */
  maxAttempts: number;
  /**
   * Optional predicate that runs against the underlying tool's parsed
   * result. When supplied, a ToolOk that fails the predicate counts
   * as a retry-eligible attempt. When omitted, the loop just retries
   * on ToolErr.
   */
  condition?: RetryCondition;
  /**
   * Inter-attempt backoff in milliseconds. Always set by `parseRetryUntilArgs` (0 default).
   */
  backoffMs: number;
}

export type RetryCondition =
  | { kind: 'metadata_field_truthy'; path: string }
  | { kind: 'metadata_field_equals'; path: string; value: string | number | boolean }
  | { kind: 'metadata_field_gte'; path: string; value: number }
  | { kind: 'metadata_field_lte'; path: string; value: number };

export const RETRY_UNTIL_MAX_ATTEMPTS_CAP = 10;
export const DEFAULT_MAX_ATTEMPTS = 3;

export function resolveMaxAttempts(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_MAX_ATTEMPTS;
  return Math.min(RETRY_UNTIL_MAX_ATTEMPTS_CAP, Math.max(1, Math.round(raw)));
}

/**
 * Read a dot-separated path out of a parsed tool result. Returns
 * `undefined` if any segment is missing. Used by the condition
 * evaluator and exported so the regression can pin the lookup.
 */
export function readPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const segments = path.split('.');
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

export function evaluateRetryCondition(
  condition: RetryCondition,
  parsedResult: Record<string, unknown>,
): { passed: boolean; observed: unknown } {
  const observed = readPath(parsedResult, condition.path);
  switch (condition.kind) {
    case 'metadata_field_truthy':
      return { passed: Boolean(observed), observed };
    case 'metadata_field_equals':
      return { passed: observed === condition.value, observed };
    case 'metadata_field_gte':
      return {
        passed: typeof observed === 'number' && Number.isFinite(observed) && observed >= condition.value,
        observed,
      };
    case 'metadata_field_lte':
      return {
        passed: typeof observed === 'number' && Number.isFinite(observed) && observed <= condition.value,
        observed,
      };
  }
}

/**
 * Validate the raw args passed to the primitive. Returns the
 * normalised args or a human-readable error message. Pure — no IO.
 */
export function parseRetryUntilArgs(args: Record<string, unknown>): {
  ok: true;
  args: RetryUntilArgs;
} | { ok: false; error: string } {
  const tool = typeof args.tool === 'string' ? args.tool.trim() : '';
  if (!tool) return { ok: false, error: '`tool` is required and must be a non-empty string.' };
  if (tool === 'wf:retry_until_condition') {
    return { ok: false, error: '`tool` must not be wf:retry_until_condition (no recursion).' };
  }
  const toolArgs = (args.toolArgs && typeof args.toolArgs === 'object' && !Array.isArray(args.toolArgs))
    ? args.toolArgs as Record<string, unknown>
    : null;
  if (!toolArgs) return { ok: false, error: '`toolArgs` is required and must be an object.' };

  const maxAttempts = resolveMaxAttempts(args.maxAttempts);
  const backoffMs = typeof args.backoffMs === 'number' && Number.isFinite(args.backoffMs) && args.backoffMs >= 0
    ? args.backoffMs
    : 0;

  let condition: RetryCondition | undefined;
  if (args.condition !== undefined && args.condition !== null) {
    if (typeof args.condition !== 'object' || Array.isArray(args.condition)) {
      return { ok: false, error: '`condition` must be an object when supplied.' };
    }
    const c = args.condition as Record<string, unknown>;
    const kind = typeof c.kind === 'string' ? c.kind : '';
    const path = typeof c.path === 'string' ? c.path : '';
    if (!path) return { ok: false, error: '`condition.path` is required when condition is supplied.' };
    switch (kind) {
      case 'metadata_field_truthy':
        condition = { kind, path };
        break;
      case 'metadata_field_equals':
        if (c.value === undefined) return { ok: false, error: '`condition.value` required for metadata_field_equals.' };
        if (typeof c.value !== 'string' && typeof c.value !== 'number' && typeof c.value !== 'boolean') {
          return { ok: false, error: '`condition.value` must be a string|number|boolean for metadata_field_equals.' };
        }
        condition = { kind, path, value: c.value };
        break;
      case 'metadata_field_gte':
      case 'metadata_field_lte':
        if (typeof c.value !== 'number' || !Number.isFinite(c.value)) {
          return { ok: false, error: `\`condition.value\` must be a finite number for ${kind}.` };
        }
        condition = { kind, path, value: c.value };
        break;
      default:
        return { ok: false, error: `Unknown condition.kind "${kind}". Valid: metadata_field_truthy|metadata_field_equals|metadata_field_gte|metadata_field_lte.` };
    }
  }

  return {
    ok: true,
    args: { tool, toolArgs, maxAttempts, condition, backoffMs },
  };
}
