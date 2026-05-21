import type { ContractRegistry } from './registry.js';
import type { ContractsTelemetrySink } from './telemetry.js';
import type { Signal, TurnPolicy } from './turnPolicy.js';
import {
  classifyTurn,
  compileToolsForTurn,
  type ClassifyTurnInput,
  type CompiledToolset,
  type ToolDefinitionLike,
} from './evaluators.js';

export interface ContractMessageLike {
  role: string;
  content: unknown;
}

export interface ContractToolDefinitionLike {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export type ContractToolChoiceLike =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; function: { name: string } };

export interface BuildContractTurnPolicyInput {
  availableTools: ReadonlyArray<string>;
  registry: ContractRegistry;
  messages?: ReadonlyArray<ContractMessageLike>;
  assetManifest?: ClassifyTurnInput['assetManifest'];
  sessionState?: Partial<ClassifyTurnInput['sessionState']>;
  signals?: ReadonlyArray<Signal>;
  telemetry?: ContractsTelemetrySink;
}

export interface CompileContractToolSurfaceInput extends Omit<BuildContractTurnPolicyInput, 'availableTools'> {
  tools: ReadonlyArray<ContractToolDefinitionLike>;
  turnPolicy?: TurnPolicy;
}

export interface CompiledContractToolSurface extends CompiledToolset {
  turnPolicy: TurnPolicy;
}

export const DEFAULT_CONTRACT_CONTEXT_PREFIX =
  'Sogni Creative Agent tool policy for this turn:';

/**
 * Control-set tool names. These are always safe to expose because they
 * end the tool loop rather than spend credits or mutate state. The v2
 * default empty-policy result is exactly this set — see
 * `turnPolicyWithDefaultVisibleTools` for details.
 */
export const CONTROL_TOOL_SET: ReadonlyArray<string> = [
  'ask_clarifying_question',
  'finalize_response',
];

export function normalizeContractMessages(
  messages: ReadonlyArray<ContractMessageLike>,
): ClassifyTurnInput['messages'] {
  return messages.map((message) => ({
    role: message.role,
    content: contractMessageContentToText(message.content),
  }));
}

export function buildContractTurnPolicy(input: BuildContractTurnPolicyInput): TurnPolicy {
  return classifyTurn({
    messages: normalizeContractMessages(input.messages ?? []),
    assetManifest: input.assetManifest ?? { items: [] },
    sessionState: {
      hasGeneratedVideo: false,
      hasUploadedVideo: false,
      repairCount: 0,
      ...input.sessionState,
    },
    availableTools: input.availableTools,
    registry: input.registry,
    signals: input.signals ?? [],
    telemetry: input.telemetry,
  });
}

export function compileContractToolSurface(
  input: CompileContractToolSurfaceInput,
): CompiledContractToolSurface {
  const definitions = input.tools.map(normalizeContractToolDefinition);
  const availableTools = definitions.map((tool) => tool.function.name);
  // In v2 every code path runs through `turnPolicyWithDefaultVisibleTools`
  // so the empty-policy default (control-set only) is applied uniformly.
  // The pre-v2 fallback that exposed all available tools when no policy
  // matched was removed in the 2026-05-21 architecture cleanup.
  const rawPolicy = input.turnPolicy
    ?? buildContractTurnPolicy({
      availableTools,
      registry: input.registry,
      messages: input.messages,
      assetManifest: input.assetManifest,
      sessionState: input.sessionState,
      signals: input.signals,
      telemetry: input.telemetry,
    });
  const turnPolicy = turnPolicyWithDefaultVisibleTools(rawPolicy, availableTools);

  const compiled = compileToolsForTurn({
    turnPolicy,
    registry: input.registry,
    availableToolDefinitions: definitions,
    telemetry: input.telemetry,
  });

  return {
    ...compiled,
    turnPolicy,
  };
}

export function formatContractsContextBlock(
  contextBlock: string,
  prefix = DEFAULT_CONTRACT_CONTEXT_PREFIX,
): string {
  const trimmed = contextBlock.trim();
  if (!trimmed) return '';
  return `${prefix}\n${trimmed}`;
}

export function appendContractsContextToSystemContent(
  systemContent: string,
  contextBlock: string,
): string {
  const formatted = formatContractsContextBlock(contextBlock);
  return formatted ? `${systemContent}\n\n${formatted}` : systemContent;
}

export function reconcileToolChoiceForCompiledTools<T extends ContractToolChoiceLike | undefined>(
  toolChoice: T,
  tools: ReadonlyArray<ContractToolDefinitionLike>,
): T | 'auto' | undefined {
  if (!toolChoice) return toolChoice;
  if (tools.length === 0) return undefined;
  if (typeof toolChoice !== 'object' || toolChoice.type !== 'function') return toolChoice;

  const forcedToolName = toolChoice.function.name;
  const isStillVisible = tools.some((tool) => tool.function.name === forcedToolName);
  return isStillVisible ? toolChoice : 'auto';
}

function contractMessageContentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (part && typeof part === 'object' && 'text' in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      }
      return '';
    })
    .filter(Boolean)
    .join(' ');
}

function normalizeContractToolDefinition(
  tool: ContractToolDefinitionLike,
): ToolDefinitionLike {
  return {
    type: 'function',
    function: {
      name: tool.function.name,
      description: tool.function.description ?? '',
      parameters: tool.function.parameters ?? { type: 'object', properties: {} },
    },
  };
}

/**
 * Apply the v2 default when a caller supplies a TurnPolicy that no
 * gating-policy entry filled in.
 *
 * An empty TurnPolicy yields the CONTROL_TOOL_SET only —
 * `ask_clarifying_question` and `finalize_response`. External creative
 * tools must come from an explicit gating-policy match driven by
 * `TurnAnalysis` or from the L2 planner's `proposedTools`. This makes
 * "no policy matched" mean "ask the user / wrap up", not "expose
 * everything".
 *
 * The pre-v2 `INTEL_EMPTY_POLICY_LEGACY` env-flag fallback was removed
 * in the 2026-05-21 architecture cleanup. Callers that need a broader
 * surface populate `proposedTools` via the planner.
 */
function turnPolicyWithDefaultVisibleTools(
  turnPolicy: TurnPolicy,
  availableTools: ReadonlyArray<string>,
): TurnPolicy {
  if (
    turnPolicy.visibleTools.length > 0
    || turnPolicy.forbiddenTools.length > 0
    || turnPolicy.requiredTools.length > 0
    || turnPolicy.appliedPolicies.length > 0
    || turnPolicy.rationale
  ) {
    return turnPolicy;
  }

  // Pre-v2 fallback that exposed every available tool when no policy
  // matched was deleted in the 2026-05-21 cleanup. The control set is
  // the only default surface; callers wanting more must populate
  // `proposedTools` via the L2 planner.
  const visibleControl = availableTools.filter((tool) => CONTROL_TOOL_SET.includes(tool));
  return {
    ...turnPolicy,
    visibleTools: visibleControl,
    appliedPolicies: ['default_control_set'],
    rationale: 'Empty policy: control-set-only (v2 default).',
  };
}
