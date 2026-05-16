/**
 * A RepairRecipe encodes the deterministic remediation for a specific
 * (toolName, errorCode) pair. Replaces the silent auto-repair logic in
 * the chat product's tool registry and the scattered per-tool retry
 * patterns observed in workflow-fixture failures.
 */
export type RepairRecipeMode = 'autoRepair' | 'suggestFollowup' | 'stopAndAsk';

const VALID_MODES: ReadonlySet<RepairRecipeMode> = new Set([
  'autoRepair',
  'suggestFollowup',
  'stopAndAsk',
]);

export interface RepairRecipe {
  recipeId: string;
  version: string;
  toolName: string;
  /**
   * ToolErrorCode that this recipe matches. The string union is owned by
   * `src/tools/result.ts`; recipes use the string form to avoid coupling.
   */
  errorCode: string;
  mode: RepairRecipeMode;
  /** Maximum times this recipe may fire for a single (toolName, errorCode) sequence. */
  maxRetries: number;
  /**
   * Mustache-style template ({{key}}) rendered into the assistant-visible
   * repairNote. Layer 3 substitutes from the dispatch context.
   */
  repairNoteTemplate: string;
  /**
   * For autoRepair mode: list of argument keys the recipe is allowed to
   * normalize. Empty/undefined means the dispatcher decides.
   */
  autoRepairFields?: string[];
  /**
   * For suggestFollowup mode: the tool the dispatcher should suggest the
   * LLM call next.
   */
  suggestedFollowupTool?: string;
}

export function isRepairRecipe(value: unknown): value is RepairRecipe {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.recipeId !== 'string' || v.recipeId.length === 0) return false;
  if (typeof v.version !== 'string' || v.version.length === 0) return false;
  if (typeof v.toolName !== 'string' || v.toolName.length === 0) return false;
  if (typeof v.errorCode !== 'string' || v.errorCode.length === 0) return false;
  if (typeof v.mode !== 'string' || !VALID_MODES.has(v.mode as RepairRecipeMode)) return false;
  if (typeof v.maxRetries !== 'number' || !Number.isFinite(v.maxRetries) || v.maxRetries < 0) return false;
  if (typeof v.repairNoteTemplate !== 'string') return false;
  if (v.autoRepairFields !== undefined) {
    if (!Array.isArray(v.autoRepairFields)) return false;
    if (v.autoRepairFields.some((x) => typeof x !== 'string')) return false;
  }
  if (v.suggestedFollowupTool !== undefined && typeof v.suggestedFollowupTool !== 'string') {
    return false;
  }
  return true;
}
