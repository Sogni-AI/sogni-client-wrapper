import type { Signal } from './turnPolicy.js';

export interface TurnClassifiedPayload {
  signals: Signal[];
  visibleToolsCount: number;
  appliedPolicies: string[];
  rationale: string;
}

export interface GatingPolicyAppliedPayload {
  policyId: string;
  matchedSignals: string[];
  forbiddenTools: string[];
  requiredTools: string[];
}

export interface PromptContractEmittedPayload {
  toolName: string;
  contractVersion: string;
  bakedDescriptionLength: number;
}

export interface ToolDispatchResolvedPayload {
  toolName: string;
  resultKind:
    | 'execute'
    | 'execute_with_repair'
    | 'repair'
    | 'reject'
    | 'ask_user';
}

export interface RepairRecipeFiredPayload {
  toolName: string;
  errorCode: string;
  recipeId: string;
  mode: 'autoRepair' | 'suggestFollowup' | 'stopAndAsk';
}

export type ContractsTelemetryEvent =
  | { kind: 'turn_classified'; timestamp: number; payload: TurnClassifiedPayload }
  | { kind: 'gating_policy_applied'; timestamp: number; payload: GatingPolicyAppliedPayload }
  | { kind: 'prompt_contract_emitted'; timestamp: number; payload: PromptContractEmittedPayload }
  | { kind: 'tool_dispatch_resolved'; timestamp: number; payload: ToolDispatchResolvedPayload }
  | { kind: 'repair_recipe_fired'; timestamp: number; payload: RepairRecipeFiredPayload };

const VALID_KINDS = new Set([
  'turn_classified',
  'gating_policy_applied',
  'prompt_contract_emitted',
  'tool_dispatch_resolved',
  'repair_recipe_fired',
]);

export function isContractsTelemetryEvent(value: unknown): value is ContractsTelemetryEvent {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.kind !== 'string' || !VALID_KINDS.has(v.kind)) return false;
  if (typeof v.timestamp !== 'number') return false;
  if (v.payload === null || typeof v.payload !== 'object') return false;
  return true;
}

/**
 * Sink interface consumers implement to receive events. The default sink
 * (`makeBufferedSink`) is provided so tests and dev environments can ring-
 * buffer events without hooking into a logging system.
 */
export interface ContractsTelemetrySink {
  emit(event: ContractsTelemetryEvent): void;
}

export function makeBufferedSink(capacity = 256): ContractsTelemetrySink & {
  events(): ContractsTelemetryEvent[];
} {
  const buf: ContractsTelemetryEvent[] = [];
  return {
    emit(event) {
      buf.push(event);
      if (buf.length > capacity) buf.splice(0, buf.length - capacity);
    },
    events() {
      return [...buf];
    },
  };
}
