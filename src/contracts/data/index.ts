/**
 * Shared contract-data exports. Re-exports the populator functions plus a
 * single `populateContractsDefaults` convenience that seeds a registry with
 * every default policy, recipe, prompt, cost, and permission entry.
 *
 * Cross-consumer convention: every consumer (sogni-chat,
 * sogni-api's HostedContractsService, future SDK consumers) builds
 * one ContractRegistry per session and calls
 * `populateContractsDefaults(registry)` to seed it before classifying
 * the first turn.
 */

export {
  GATING_POLICIES,
  MEDIA_TOOL_NAMES,
  populateContractsGatingPolicies,
} from './gatingPolicies.js';

export {
  TOOL_SURFACE_GATING_POLICIES,
  IMAGE_CONTEXT_TOOL_NAMES,
  VIDEO_CONTEXT_TOOL_NAMES,
  populateContractsToolSurfaceGatingPolicies,
} from './gatingPoliciesToolSurface.js';

export {
  REPAIR_RECIPES,
  populateContractsRepairRecipes,
} from './repairRecipes.js';

export {
  PROMPT_CONTRACTS,
  populateContractsPromptContracts,
} from './promptContracts.js';

export {
  TOOL_COST_METADATA,
  getToolCostMetadata,
  listPaidTools,
  listToolsByRiskLevel,
  populateToolCostMetadata,
} from './toolCostMetadata.js';
export type {
  ToolCostClass,
  ToolCostMetadata,
  ToolRiskLevel,
} from './toolCostMetadata.js';

export {
  COST_CLASS_NUMERIC_WEIGHTS,
  UNKNOWN_COST_CLASS_FALLBACK_WEIGHT,
  getCostClassNumericWeight,
} from './costEstimation.js';

export {
  CANONICAL_TOOL_CATALOG,
  getCanonicalToolCatalogEntry,
  listCanonicalToolCatalogEntries,
  listHostedApiImplementedToolNames,
  listHostedApiToolCatalogEntries,
} from './toolCatalog.js';
export type {
  CanonicalToolCatalogEntry,
  ToolCatalogApiExecutorSupport,
  ToolCatalogCostMetadataStatus,
  ToolCatalogDefinitionSource,
  ToolCatalogFamily,
  ToolCatalogHostedApiSurface,
  ToolCatalogPromptContractStatus,
  ToolCatalogWorkflowEligibility,
} from './toolCatalog.js';

export {
  TOOL_PERMISSIONS,
  getToolPermission,
  getToolPermissionDecision,
  evaluatePermissionGate,
  toolRequiresUserApproval,
  populateToolPermissions,
} from './toolPermissions.js';
export type {
  PermissionGateInput,
  PermissionGateOutcome,
  ToolPermission,
  ToolPermissionDecision,
} from './toolPermissions.js';

import { populateContractsGatingPolicies } from './gatingPolicies.js';
import { populateContractsToolSurfaceGatingPolicies } from './gatingPoliciesToolSurface.js';
import { populateContractsRepairRecipes } from './repairRecipes.js';
import { populateContractsPromptContracts } from './promptContracts.js';
import { populateToolCostMetadata } from './toolCostMetadata.js';
import { populateToolPermissions } from './toolPermissions.js';
import type { ContractRegistry } from '../registry.js';

/**
 * Seed a ContractRegistry with every default policy / recipe /
 * contract shipped with this package. Idempotent.
 */
export function populateContractsDefaults(registry: ContractRegistry): void {
  populateContractsGatingPolicies(registry);
  populateContractsToolSurfaceGatingPolicies(registry);
  populateContractsRepairRecipes(registry);
  populateContractsPromptContracts(registry);
  populateToolCostMetadata(registry);
  populateToolPermissions(registry);
}
