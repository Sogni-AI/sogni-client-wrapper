/**
 * A PromptContract owns a tool's LLM-visible description and per-parameter
 * docstrings. Phase 5 of the structured-contracts migration moves per-tool
 * prose out of the chat product's system prompt into instances of this type.
 */
export interface PromptContract {
  /** Stable identifier for telemetry and registry lookup. */
  contractId: string;
  /** Semver string. Bumped when the contract's data shape changes. */
  version: string;
  /** Tool the contract describes. Must match a registered tool. */
  toolName: string;
  /** Default description shown to the LLM when this tool is visible. */
  baseDescription: string;
  /** Per-parameter docstrings keyed by parameter name. */
  parameterDocs: Record<string, string>;
  /** Tool-specific voice or style examples (e.g. screenplay format for video). */
  voiceExamples?: string[];
  /**
   * Conditional description fragments keyed by signal name. Layer 2
   * (`compileToolsForTurn`) appends matching fragments to the baked
   * description when the corresponding signal is present in TurnPolicy.
   */
  conditionalNotes?: Record<string, string>;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (value === null || typeof value !== 'object') return false;
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v !== 'string') return false;
  }
  return true;
}

export function isPromptContract(value: unknown): value is PromptContract {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.contractId !== 'string' || v.contractId.length === 0) return false;
  if (typeof v.version !== 'string' || v.version.length === 0) return false;
  if (typeof v.toolName !== 'string' || v.toolName.length === 0) return false;
  if (typeof v.baseDescription !== 'string') return false;
  if (!isStringRecord(v.parameterDocs)) return false;
  if (v.voiceExamples !== undefined) {
    if (!Array.isArray(v.voiceExamples)) return false;
    if (v.voiceExamples.some((x) => typeof x !== 'string')) return false;
  }
  if (v.conditionalNotes !== undefined && !isStringRecord(v.conditionalNotes)) return false;
  return true;
}
