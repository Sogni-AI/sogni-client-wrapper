/**
 * Executor injection seams.
 *
 * The pure stage loop in `./executor.ts` doesn't know how runs are persisted
 * or how tools are dispatched — it asks for both via these ports so the
 * same loop runs in the chat browser (IndexedDB + chat toolRegistry), in
 * sogni-api workers (Mongo + hosted dispatch), and in node tests
 * (in-memory store + fake dispatcher).
 */

import type { Run } from './types.js';

/** Persistence backend for `Run` records. */
export interface RunStore {
  get(id: string): Promise<Run | null>;
  save(run: Run): Promise<void>;
}

/**
 * Minimal shape the executor needs to call a tool. The full chat-side
 * ToolExecutionContext / ToolCallbacks are kept by callers and passed
 * through here verbatim — the executor never inspects them.
 */
export interface ToolDispatcher<
  Context = unknown,
  Callbacks = unknown,
  Progress = Record<string, unknown>,
> {
  /**
   * Dispatch a named tool with the supplied args and return its raw JSON
   * string result (the same shape chat tools currently return).
   *
   * Throws on unknown tool name or non-recoverable failure.
   */
  execute(
    toolName: string,
    args: Record<string, unknown>,
    context: Context,
    callbacks: Callbacks,
  ): Promise<string>;

  /** Predicate used to defend against bad templates before the run starts. */
  has(toolName: string): boolean;

  /** Phantom type carrier so callers can re-narrow Progress in their wrappers. */
  readonly __progress?: Progress;
}
