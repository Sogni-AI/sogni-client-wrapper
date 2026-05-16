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

  return {
    ...turnPolicy,
    visibleTools: [...availableTools],
  };
}
