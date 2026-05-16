import type { ContractRegistry } from './registry.js';
import { emptyTurnPolicy, type Signal, type TurnPolicy } from './turnPolicy.js';
import type { ContractsTelemetrySink } from './telemetry.js';
import type { RepairRecipe } from './repairRecipe.js';

/**
 * Inputs to `classifyTurn`. The chat product (and other consumers) build
 * this object from their own runtime state and pass it in. The function
 * stays pure.
 */
export interface ClassifyTurnInput {
  /** Conversation history (shape kept minimal for v1 — extended later). */
  messages: ReadonlyArray<{ role: string; content: string }>;
  /** Session-scoped assets, see `src/services/assetManifestStore.ts` shape. */
  assetManifest: { items: ReadonlyArray<{ id: string; kind: string }> };
  /** Compact session-state slice the planner needs. */
  sessionState: {
    hasPriorGenerationContext?: boolean;
    hasGeneratedImage?: boolean;
    hasGeneratedVideo: boolean;
    hasGeneratedAudio?: boolean;
    hasUploadedImage?: boolean;
    hasUploadedVideo: boolean;
    hasUploadedAudio?: boolean;
    hasActivePersona?: boolean;
    noPersonaImageInSession?: boolean;
    awaitingImageSelection?: boolean;
    pendingStitchAfterBatch?: boolean;
    completedWorkflow?: boolean;
    lastTool?: string;
    lastToolError?: string;
    repairCount: number;
  };
  /** Tools the consumer is willing to expose (pre-policy). */
  availableTools: ReadonlyArray<string>;
  /** Registry instance. Empty registry = passthrough behavior. */
  registry: ContractRegistry;
  /**
   * Signals already gathered by the consumer's planner/classifier/runtime
   * layers. Regex/classifier signals should be advisory for expensive routing;
   * source-aware ToolGatingPolicy triggers can require planner/runtime sources.
   */
  signals: ReadonlyArray<Signal>;
  /** Optional telemetry sink for emitting events. */
  telemetry?: ContractsTelemetrySink;
}

export function classifyTurn(input: ClassifyTurnInput): TurnPolicy {
  const policy = emptyTurnPolicy();
  policy.signals = mergeSignals([...input.signals, ...sessionStateSignals(input)]);
  policy.contextHints = [
    ...assetManifestHints(input),
    ...sessionStateHints(input),
  ];

  const signalSourcesByKind = new Map<string, Set<string>>();
  for (const signal of policy.signals) {
    const sources = signalSourcesByKind.get(signal.kind) ?? new Set<string>();
    sources.add(signal.source);
    signalSourcesByKind.set(signal.kind, sources);
  }
  const presentSignalKinds = new Set(signalSourcesByKind.keys());
  const signalMatchesSourceConstraint = (kind: string, allowed?: string | string[]): boolean => {
    if (!presentSignalKinds.has(kind)) return false;
    if (!allowed) return true;
    const sources = signalSourcesByKind.get(kind);
    if (!sources) return false;
    const allowedSources = Array.isArray(allowed) ? allowed : [allowed];
    return allowedSources.some((source) => sources.has(source));
  };
  const forbiddenSet = new Set<string>();
  const requiredSet = new Set<string>();
  const rationales: string[] = [];
  // Collect telemetry payloads during the gating loop to avoid a second
  // O(n) pass over listGatingPolicies() in the telemetry block below.
  const firedTelemetryPayloads: Array<{
    policyId: string;
    matchedSignals: string[];
    forbiddenTools: string[];
    requiredTools: string[];
  }> = [];

  for (const gating of input.registry.listGatingPolicies()) {
    const allOfMatch = gating.trigger.allOf.every((kind) =>
      signalMatchesSourceConstraint(kind, gating.trigger.sources?.[kind]),
    );
    const noneOfMatch =
      !gating.trigger.noneOf || gating.trigger.noneOf.every((kind) => !presentSignalKinds.has(kind));
    if (!allOfMatch || !noneOfMatch) continue;

    policy.appliedPolicies.push(gating.policyId);
    rationales.push(gating.rationale);
    for (const tool of gating.effect.forbid) {
      forbiddenSet.add(tool);
      policy.forbiddenToolPolicies[tool] = gating.policyId;
    }
    if (gating.effect.require) {
      for (const tool of gating.effect.require) requiredSet.add(tool);
    }
    if (input.telemetry) {
      firedTelemetryPayloads.push({
        policyId: gating.policyId,
        matchedSignals: gating.trigger.allOf,
        forbiddenTools: gating.effect.forbid,
        requiredTools: gating.effect.require ?? [],
      });
    }
  }

  policy.forbiddenTools = Array.from(forbiddenSet);
  policy.requiredTools = Array.from(requiredSet);
  policy.visibleTools = input.availableTools.filter((t) => !forbiddenSet.has(t));
  policy.rationale = rationales.join(' ');

  if (input.telemetry) {
    const ts = Date.now();
    for (const payload of firedTelemetryPayloads) {
      input.telemetry.emit({
        kind: 'gating_policy_applied',
        timestamp: ts,
        payload,
      });
    }
    input.telemetry.emit({
      kind: 'turn_classified',
      timestamp: ts,
      payload: {
        signals: policy.signals,
        visibleToolsCount: policy.visibleTools.length,
        appliedPolicies: policy.appliedPolicies,
        rationale: policy.rationale,
      },
    });
  }

  return policy;
}

/** Minimal OpenAI-compatible tool definition shape. */
export interface ToolDefinitionLike {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface CompileToolsForTurnInput {
  turnPolicy: TurnPolicy;
  registry: ContractRegistry;
  availableToolDefinitions: ReadonlyArray<ToolDefinitionLike>;
  /** Optional telemetry sink for emitting events. */
  telemetry?: ContractsTelemetrySink;
}

export interface CompiledToolset {
  tools: ToolDefinitionLike[];
  contextBlock: string;
}

export function compileToolsForTurn(input: CompileToolsForTurnInput): CompiledToolset {
  const presentSignalKinds = new Set(input.turnPolicy.signals.map((s) => s.kind));

  const ordered = input.turnPolicy.visibleTools
    .map((name) => {
      const def = input.availableToolDefinitions.find((t) => t.function.name === name);
      if (!def) return undefined;
      const contract = input.registry.getPromptContract(name);
      if (!contract) return def;
      const fragments: string[] = [contract.baseDescription];
      if (contract.conditionalNotes) {
        for (const [signalKind, fragment] of Object.entries(contract.conditionalNotes)) {
          if (presentSignalKinds.has(signalKind)) fragments.push(fragment);
        }
      }
      if (contract.voiceExamples && contract.voiceExamples.length > 0) {
        fragments.push(`Voice examples: ${contract.voiceExamples.join(' | ')}`);
      }
      return {
        ...def,
        function: {
          ...def.function,
          description: fragments.join(' '),
          parameters: applyParameterDocs(def.function.parameters, contract.parameterDocs),
        },
      };
    })
    .filter((t): t is ToolDefinitionLike => Boolean(t));

  if (input.telemetry) {
    const ts = Date.now();
    for (const def of ordered) {
      const contract = input.registry.getPromptContract(def.function.name);
      if (!contract) continue;
      input.telemetry.emit({
        kind: 'prompt_contract_emitted',
        timestamp: ts,
        payload: {
          toolName: def.function.name,
          contractVersion: contract.version,
          bakedDescriptionLength: def.function.description.length,
        },
      });
    }
  }

  const contextLines: string[] = [];
  if (input.turnPolicy.rationale) contextLines.push(input.turnPolicy.rationale);
  for (const hint of input.turnPolicy.contextHints) {
    contextLines.push(`${hint.kind}: ${hint.body}`);
  }
  const contextBlock = contextLines.join('\n');

  return { tools: ordered, contextBlock };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export type DispatchResult =
  | { kind: 'execute'; args: Record<string, unknown> }
  | {
      kind: 'execute_with_repair';
      args: Record<string, unknown>;
      repairNote: string;
      recipeId: string;
    }
  | { kind: 'repair'; nextToolName: string; rationale: string; recipeId: string }
  | { kind: 'reject'; rationale: string; gatingPolicyId: string }
  | { kind: 'ask_user'; userQuestion: string; recipeId: string };

export interface DispatchToolCallInput {
  call: ToolCall;
  turnPolicy: TurnPolicy;
  registry: ContractRegistry;
  /** Error code from the previous attempt, if dispatching for repair. */
  errorCode?: string;
  /** Render context for repairNoteTemplate substitution. */
  noteContext?: Record<string, string | number>;
  /**
   * Number of prior repairs attempted for this tool/error in the current
   * turn. Used as a coarse retry ledger when a caller does not provide
   * recipe-specific counts.
   */
  repairCount?: number;
  /** Optional recipe-specific attempt counts keyed by tool:error:recipeId. */
  repairLedger?: Readonly<Record<string, number>>;
  /** Optional telemetry sink for emitting events. */
  telemetry?: ContractsTelemetrySink;
}

function renderTemplate(template: string, ctx: Record<string, string | number>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = ctx[key];
    return v === undefined ? '' : String(v);
  });
}

function upperFirst(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

function autoRepairFieldsForRecipe(recipe: RepairRecipe): string[] {
  if (recipe.autoRepairFields && recipe.autoRepairFields.length > 0) {
    return recipe.autoRepairFields;
  }
  if (recipe.recipeId === 'extend_video.duration_clamp') {
    return ['duration'];
  }
  return [];
}

function autoRepairValue(
  field: string,
  recipe: RepairRecipe,
  ctx: Record<string, string | number>,
): string | number | undefined {
  const capitalized = upperFirst(field);
  const candidateKeys = [
    field,
    `normalized_${field}`,
    `normalized${capitalized}`,
    `clamped_${field}`,
    `clamped${capitalized}`,
    `${field}Clamped`,
  ];
  if (recipe.recipeId === 'extend_video.duration_clamp' && field === 'duration') {
    candidateKeys.unshift('clamped');
  }
  for (const key of candidateKeys) {
    const value = ctx[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

function mergeSignals(signals: ReadonlyArray<Signal>): Signal[] {
  const merged: Signal[] = [];
  const seen = new Set<string>();
  for (const signal of signals) {
    const key = `${signal.kind}\u0000${signal.source}\u0000${signal.value ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(signal);
  }
  return merged;
}

function sessionStateSignals(input: ClassifyTurnInput): Signal[] {
  const signals: Signal[] = [];
  if (input.sessionState.hasPriorGenerationContext) {
    signals.push({ kind: 'has_prior_generation_context', source: 'session_state' });
  }
  if (input.sessionState.hasGeneratedImage) {
    signals.push({ kind: 'has_generated_image', source: 'session_state' });
    signals.push({ kind: 'has_prior_generation_context', source: 'session_state' });
  }
  if (input.sessionState.hasGeneratedVideo) {
    signals.push({ kind: 'has_generated_video', source: 'session_state' });
    signals.push({ kind: 'has_prior_generation_context', source: 'session_state' });
  }
  if (input.sessionState.hasGeneratedAudio) {
    signals.push({ kind: 'has_generated_audio', source: 'session_state' });
    signals.push({ kind: 'has_prior_generation_context', source: 'session_state' });
  }
  if (input.sessionState.hasUploadedImage) {
    signals.push({ kind: 'has_uploaded_image', source: 'session_state' });
  }
  if (input.sessionState.hasUploadedVideo) {
    signals.push({ kind: 'has_uploaded_video', source: 'session_state' });
  }
  if (input.sessionState.hasUploadedAudio) {
    signals.push({ kind: 'has_uploaded_audio', source: 'session_state' });
  }
  if (input.sessionState.hasActivePersona) {
    signals.push({ kind: 'has_active_persona', source: 'session_state' });
  }
  if (input.sessionState.noPersonaImageInSession) {
    signals.push({ kind: 'no_persona_image_in_session', source: 'session_state' });
  }
  if (input.sessionState.awaitingImageSelection) {
    signals.push({ kind: 'awaiting_image_selection', source: 'session_state' });
  }
  if (input.sessionState.pendingStitchAfterBatch) {
    signals.push({ kind: 'pending_stitch_after_batch', source: 'session_state' });
  }
  if (input.sessionState.completedWorkflow) {
    signals.push({ kind: 'completed_workflow', source: 'session_state' });
  }
  if (input.sessionState.lastTool) {
    signals.push({
      kind: 'last_tool',
      source: 'session_state',
      value: input.sessionState.lastTool,
    });
  }
  if (input.sessionState.lastToolError) {
    signals.push({
      kind: 'last_tool_error',
      source: 'session_state',
      value: input.sessionState.lastToolError,
    });
  }
  return signals;
}

function sessionStateHints(input: ClassifyTurnInput) {
  const state = input.sessionState;
  const facts: string[] = [];

  if (state.hasPriorGenerationContext) facts.push('prior generated context exists');
  if (state.hasGeneratedImage) facts.push('generated images are available');
  if (state.hasGeneratedVideo) facts.push('generated videos are available');
  if (state.hasGeneratedAudio) facts.push('generated audio is available');
  if (state.hasUploadedImage) facts.push('uploaded images are available');
  if (state.hasUploadedVideo) facts.push('uploaded videos are available');
  if (state.hasUploadedAudio) facts.push('uploaded audio is available');
  if (state.hasActivePersona) facts.push('an active persona is in scope');
  if (state.noPersonaImageInSession) facts.push('no persona image stage is recorded yet');
  if (state.awaitingImageSelection) facts.push('waiting for image selection before video');
  if (state.pendingStitchAfterBatch) facts.push('a generated batch is awaiting stitch');
  if (state.completedWorkflow) facts.push('a media workflow completed this turn');
  if (state.lastTool) facts.push(`last tool: ${state.lastTool}`);
  if (state.lastToolError) facts.push(`last tool error: ${state.lastToolError}`);
  if (state.repairCount > 0) facts.push(`repair attempts this turn: ${state.repairCount}`);

  if (facts.length === 0) return [];
  return [{
    kind: 'session_state',
    body: `Session state: ${facts.join('; ')}.`,
  }];
}

/**
 * Max characters per asset_id when rendered into the system context block.
 * Mirrors `MAX_ASSET_ID_LENGTH` in `skills/asset_reference_management/manifest.ts`.
 * This is defense-in-depth — `addAsset` already rejects oversize/malformed
 * ids, but the contracts layer may receive `assetManifest.items` from any
 * caller, so we clamp again here.
 */
const ASSET_MANIFEST_HINT_ID_LENGTH = 128;

/**
 * Helpers that strip every control character (incl. newlines, line/paragraph
 * separators, and DEL) from an id before embedding it into the LLM system
 * prompt. This is defense-in-depth against cross-tool prompt injection —
 * a malformed id that somehow bypassed `addAsset` validation cannot smuggle
 * a fresh instruction line into the context block.
 */
function isPromptUnsafeCodePoint(code: number): boolean {
  // C0 controls (0x00-0x1F), DEL (0x7F), C1 controls (0x80-0x9F),
  // and the Unicode line/paragraph separators (LS 0x2028, PS 0x2029).
  // Any of these could let a malformed id introduce a fresh line in
  // the rendered system prompt.
  if (code <= 0x1f) return true;
  if (code === 0x7f) return true;
  if (code >= 0x80 && code <= 0x9f) return true;
  if (code === 0x2028 || code === 0x2029) return true;
  return false;
}

function sanitizeAssetIdForHint(id: string): string {
  let stripped = '';
  for (let i = 0; i < id.length; i += 1) {
    const code = id.charCodeAt(i);
    if (!isPromptUnsafeCodePoint(code)) {
      stripped += id[i];
    }
  }
  return stripped.length > ASSET_MANIFEST_HINT_ID_LENGTH
    ? stripped.slice(0, ASSET_MANIFEST_HINT_ID_LENGTH)
    : stripped;
}

function assetManifestHints(input: ClassifyTurnInput) {
  const items = input.assetManifest.items;
  if (items.length === 0) return [];

  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  }
  const countSummary = Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, count]) => `${kind}: ${count}`)
    .join(', ');
  const ids = items
    .slice(0, 8)
    .map((item) => sanitizeAssetIdForHint(item.id))
    .filter((id) => id.length > 0)
    .join(', ');

  return [{
    kind: 'asset_manifest',
    body: `Assets in scope: ${items.length} total${countSummary ? ` (${countSummary})` : ''}${
      ids ? `. Use manifest ids when referencing assets: ${ids}.` : '.'
    }`,
  }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function applyParameterDocs(
  parameters: Record<string, unknown>,
  docs: Record<string, string>,
): Record<string, unknown> {
  if (!isRecord(parameters.properties)) return parameters;

  let changed = false;
  const properties: Record<string, unknown> = { ...parameters.properties };
  for (const [name, description] of Object.entries(docs)) {
    const property = properties[name];
    if (!isRecord(property)) continue;
    properties[name] = { ...property, description };
    changed = true;
  }

  return changed ? { ...parameters, properties } : parameters;
}

function applyAutoRepairFields(
  args: Record<string, unknown>,
  recipe: RepairRecipe,
  ctx: Record<string, string | number>,
): Record<string, unknown> {
  const fields = autoRepairFieldsForRecipe(recipe);
  if (fields.length === 0) return args;

  let normalized: Record<string, unknown> | null = null;
  for (const field of fields) {
    const value = autoRepairValue(field, recipe, ctx);
    if (value === undefined) continue;
    if (!normalized) normalized = { ...args };
    normalized[field] = value;
  }
  return normalized ?? args;
}

function repairAttemptCount(input: DispatchToolCallInput, recipe: RepairRecipe): number {
  const exactKey = `${recipe.toolName}:${recipe.errorCode}:${recipe.recipeId}`;
  const broadKey = `${recipe.toolName}:${recipe.errorCode}`;
  return input.repairLedger?.[exactKey]
    ?? input.repairLedger?.[broadKey]
    ?? input.repairCount
    ?? 0;
}

function hasRepairBudget(input: DispatchToolCallInput, recipe: RepairRecipe): boolean {
  if (recipe.mode === 'stopAndAsk') return true;
  return repairAttemptCount(input, recipe) < recipe.maxRetries;
}

export function dispatchToolCall(input: DispatchToolCallInput): DispatchResult {
  const { result, firedRecipe } = computeDispatch(input);
  if (input.telemetry) {
    const ts = Date.now();
    input.telemetry.emit({
      kind: 'tool_dispatch_resolved',
      timestamp: ts,
      payload: { toolName: input.call.name, resultKind: result.kind },
    });
    if (firedRecipe) {
      input.telemetry.emit({
        kind: 'repair_recipe_fired',
        timestamp: ts,
        payload: {
          toolName: firedRecipe.toolName,
          errorCode: firedRecipe.errorCode,
          recipeId: firedRecipe.recipeId,
          mode: firedRecipe.mode,
        },
      });
    }
  }
  return result;
}

function computeDispatch(input: DispatchToolCallInput): {
  result: DispatchResult;
  firedRecipe?: RepairRecipe;
} {
  if (input.turnPolicy.forbiddenTools.includes(input.call.name)) {
    return {
      result: {
        kind: 'reject',
        rationale: input.turnPolicy.rationale,
        gatingPolicyId:
          input.turnPolicy.forbiddenToolPolicies[input.call.name] ??
          input.turnPolicy.appliedPolicies[0] ??
          'UNKNOWN_POLICY',
      },
    };
  }
  if (input.errorCode) {
    const recipe = input.registry.findRepairRecipe(input.call.name, input.errorCode);
    if (recipe) {
      const note = renderTemplate(recipe.repairNoteTemplate, input.noteContext ?? {});
      if (!hasRepairBudget(input, recipe)) {
        return {
          result: {
            kind: 'ask_user',
            userQuestion: `I could not safely recover after ${recipe.maxRetries} repair attempt${
              recipe.maxRetries === 1 ? '' : 's'
            }. ${note}`,
            recipeId: recipe.recipeId,
          },
        };
      }
      switch (recipe.mode) {
        case 'autoRepair':
          return {
            result: {
              kind: 'execute_with_repair',
              args: applyAutoRepairFields(
                input.call.arguments,
                recipe,
                input.noteContext ?? {},
              ),
              repairNote: note,
              recipeId: recipe.recipeId,
            },
            firedRecipe: recipe,
          };
        case 'suggestFollowup':
          return {
            result: {
              kind: 'repair',
              nextToolName: recipe.suggestedFollowupTool ?? input.call.name,
              rationale: note,
              recipeId: recipe.recipeId,
            },
            firedRecipe: recipe,
          };
        case 'stopAndAsk':
          return {
            result: {
              kind: 'ask_user',
              userQuestion: note,
              recipeId: recipe.recipeId,
            },
            firedRecipe: recipe,
          };
        default: {
          const _exhaustive: never = recipe.mode;
          throw new Error(`Unhandled RepairRecipeMode: ${_exhaustive as string}`);
        }
      }
    }
  }
  return { result: { kind: 'execute', args: input.call.arguments } };
}
