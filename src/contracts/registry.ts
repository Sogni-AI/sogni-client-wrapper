import { isPromptContract, type PromptContract } from './promptContract.js';
import { isToolGatingPolicy, type ToolGatingPolicy } from './toolGatingPolicy.js';
import { isRepairRecipe, type RepairRecipe } from './repairRecipe.js';
import type { ToolCostMetadata } from './data/toolCostMetadata.js';
import type { ToolPermission } from './data/toolPermissions.js';

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isToolCostMetadata(value: unknown): value is ToolCostMetadata {
  if (!isStringRecord(value)) return false;
  return isString(value.tool)
    && isString(value.costClass)
    && ['safe', 'paid', 'destructive'].includes(String(value.riskLevel))
    && isString(value.userVisibleCost)
    && isString(value.description);
}

function isToolPermission(value: unknown): value is ToolPermission {
  if (!isStringRecord(value)) return false;
  return isString(value.tool)
    && ['allow', 'require_user_approval', 'require_explicit_intent'].includes(String(value.decision))
    && ['safe', 'paid', 'destructive'].includes(String(value.riskLevel))
    && typeof value.requiresUserApproval === 'boolean'
    && isString(value.userVisibleCost);
}

/**
 * Single source of truth for structured contracts within a process.
 * Phase 1 ships the type and basic register/lookup; Phase 2 wires the
 * chat product to consume an instance.
 */
export class ContractRegistry {
  private readonly promptContracts = new Map<string, PromptContract>();
  private readonly gatingPolicies = new Map<string, ToolGatingPolicy>();
  private readonly repairRecipes = new Map<string, RepairRecipe>();
  private readonly toolCostMetadata = new Map<string, ToolCostMetadata>();
  private readonly toolPermissions = new Map<string, ToolPermission>();

  registerPromptContract(contract: PromptContract): void {
    if (!isPromptContract(contract)) {
      throw new Error(`Invalid PromptContract: ${JSON.stringify(contract)}`);
    }
    this.promptContracts.set(contract.toolName, contract);
  }

  registerGatingPolicy(policy: ToolGatingPolicy): void {
    if (!isToolGatingPolicy(policy)) {
      throw new Error(`Invalid ToolGatingPolicy: ${JSON.stringify(policy)}`);
    }
    this.gatingPolicies.set(policy.policyId, policy);
  }

  registerRepairRecipe(recipe: RepairRecipe): void {
    if (!isRepairRecipe(recipe)) {
      throw new Error(`Invalid RepairRecipe: ${JSON.stringify(recipe)}`);
    }
    this.repairRecipes.set(this.repairKey(recipe.toolName, recipe.errorCode), recipe);
  }

  registerToolCostMetadata(metadata: ToolCostMetadata): void {
    if (!isToolCostMetadata(metadata)) {
      throw new Error(`Invalid ToolCostMetadata: ${JSON.stringify(metadata)}`);
    }
    this.toolCostMetadata.set(metadata.tool, metadata);
  }

  registerToolPermission(permission: ToolPermission): void {
    if (!isToolPermission(permission)) {
      throw new Error(`Invalid ToolPermission: ${JSON.stringify(permission)}`);
    }
    this.toolPermissions.set(permission.tool, permission);
  }

  getPromptContract(toolName: string): PromptContract | undefined {
    return this.promptContracts.get(toolName);
  }

  getGatingPolicy(policyId: string): ToolGatingPolicy | undefined {
    return this.gatingPolicies.get(policyId);
  }

  findRepairRecipe(toolName: string, errorCode: string): RepairRecipe | undefined {
    return this.repairRecipes.get(this.repairKey(toolName, errorCode));
  }

  getToolCostMetadata(toolName: string): ToolCostMetadata | undefined {
    return this.toolCostMetadata.get(toolName);
  }

  getToolPermission(toolName: string): ToolPermission | undefined {
    return this.toolPermissions.get(toolName);
  }

  listPromptContracts(): PromptContract[] {
    return Array.from(this.promptContracts.values());
  }

  listGatingPolicies(): ToolGatingPolicy[] {
    return Array.from(this.gatingPolicies.values());
  }

  listRepairRecipes(): RepairRecipe[] {
    return Array.from(this.repairRecipes.values());
  }

  listToolCostMetadata(): ToolCostMetadata[] {
    return Array.from(this.toolCostMetadata.values());
  }

  listToolPermissions(): ToolPermission[] {
    return Array.from(this.toolPermissions.values());
  }

  private repairKey(toolName: string, errorCode: string): string {
    return `${toolName}::${errorCode}`;
  }
}
