export { PHASE_3_GATING_POLICIES, MEDIA_TOOL_NAMES, populateContractsGatingPolicies, } from './gatingPolicies.js';
export { TOOL_SURFACE_GATING_POLICIES, IMAGE_CONTEXT_TOOL_NAMES, VIDEO_CONTEXT_TOOL_NAMES, populateContractsToolSurfaceGatingPolicies, } from './gatingPoliciesToolSurface.js';
export { PHASE_4_REPAIR_RECIPES, populateContractsRepairRecipes, } from './repairRecipes.js';
export { PHASE_5_PROMPT_CONTRACTS, populateContractsPromptContracts, } from './promptContracts.js';
export { TOOL_COST_METADATA, getToolCostMetadata, listPaidTools, listToolsByRiskLevel, populateToolCostMetadata, } from './toolCostMetadata.js';
export { COST_CLASS_NUMERIC_WEIGHTS, UNKNOWN_COST_CLASS_FALLBACK_WEIGHT, getCostClassNumericWeight, } from './costEstimation.js';
export { CANONICAL_TOOL_CATALOG, getCanonicalToolCatalogEntry, listCanonicalToolCatalogEntries, listHostedApiImplementedToolNames, listHostedApiToolCatalogEntries, } from './toolCatalog.js';
export { TOOL_PERMISSIONS, getToolPermission, getToolPermissionDecision, evaluatePermissionGate, toolRequiresUserApproval, populateToolPermissions, } from './toolPermissions.js';
import { populateContractsGatingPolicies } from './gatingPolicies.js';
import { populateContractsToolSurfaceGatingPolicies } from './gatingPoliciesToolSurface.js';
import { populateContractsRepairRecipes } from './repairRecipes.js';
import { populateContractsPromptContracts } from './promptContracts.js';
import { populateToolCostMetadata } from './toolCostMetadata.js';
import { populateToolPermissions } from './toolPermissions.js';
export function populateContractsDefaults(registry) {
    populateContractsGatingPolicies(registry);
    populateContractsToolSurfaceGatingPolicies(registry);
    populateContractsRepairRecipes(registry);
    populateContractsPromptContracts(registry);
    populateToolCostMetadata(registry);
    populateToolPermissions(registry);
}
//# sourceMappingURL=index.js.map