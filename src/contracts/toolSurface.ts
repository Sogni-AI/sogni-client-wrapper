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

/**
 * Resolve the legacy empty-policy environment flag. When set to `true`,
 * `turnPolicyWithDefaultVisibleTools` reverts to the pre-v2 behavior of
 * exposing every available tool when no gating policy matches. This
 * exists as a one-release safety net for consumers that depend on the
 * old surface; the flag will be removed in a future release.
 */
function isLegacyEmptyPolicyEnabled(): boolean {
  if (typeof process === 'undefined' || !process || !process.env) return false;
  const value = process.env.INTEL_EMPTY_POLICY_LEGACY;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

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
  const turnPolicy = input.turnPolicy
    ? turnPolicyWithDefaultVisibleTools(input.turnPolicy, availableTools)
    : buildContractTurnPolicy({
      availableTools,
      registry: input.registry,
      messages: input.messages,
      assetManifest: input.assetManifest,
      sessionState: input.sessionState,
      signals: input.signals,
      telemetry: input.telemetry,
    });

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
 * v1 behavior (pre-2026-05-20): an empty TurnPolicy was treated as
 * "expose every available tool". With 30+ tools registered, this
 * blew past the §9 tool-surface budget (1–5 ideal / 5–10 acceptable /
 * 20+ avoid) every turn that no policy matched.
 *
 * v2 behavior: an empty TurnPolicy yields the CONTROL_TOOL_SET only —
 * `ask_clarifying_question` and `finalize_response`. External
 * creative tools must come from an explicit gating-policy match
 * driven by `TurnAnalysis`. This makes "no policy matched" mean
 * "ask the user / wrap up", not "expose everything".
 *
 * Backwards compatibility: set `INTEL_EMPTY_POLICY_LEGACY=true` to
 * temporarily restore the v1 behavior for one release cycle. The
 * flag will be removed once all consumers migrate. The applied
 * policy id is `legacy_empty_policy_default` so audits can spot
 * leftover dependencies.
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

  if (isLegacyEmptyPolicyEnabled()) {
    return {
      ...turnPolicy,
      visibleTools: [...availableTools],
      appliedPolicies: ['legacy_empty_policy_default'],
      rationale:
        'Empty policy: legacy default (all available tools) — INTEL_EMPTY_POLICY_LEGACY is enabled.',
    };
  }

  const visibleControl = availableTools.filter((tool) => CONTROL_TOOL_SET.includes(tool));
  return {
    ...turnPolicy,
    visibleTools: visibleControl,
    appliedPolicies: ['default_control_set'],
    rationale: 'Empty policy: control-set-only (v2 default).',
  };
}
