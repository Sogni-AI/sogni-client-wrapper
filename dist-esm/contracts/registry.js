import { isPromptContract } from './promptContract.js';
import { isToolGatingPolicy } from './toolGatingPolicy.js';
import { isRepairRecipe } from './repairRecipe.js';
function isString(value) {
    return typeof value === 'string' && value.length > 0;
}
function isStringRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isToolCostMetadata(value) {
    if (!isStringRecord(value))
        return false;
    return isString(value.tool)
        && isString(value.costClass)
        && ['safe', 'paid', 'destructive'].includes(String(value.riskLevel))
        && isString(value.userVisibleCost)
        && isString(value.description);
}
function isToolPermission(value) {
    if (!isStringRecord(value))
        return false;
    return isString(value.tool)
        && ['allow', 'require_user_approval', 'require_explicit_intent'].includes(String(value.decision))
        && ['safe', 'paid', 'destructive'].includes(String(value.riskLevel))
        && typeof value.requiresUserApproval === 'boolean'
        && isString(value.userVisibleCost);
}
export class ContractRegistry {
    constructor() {
        this.promptContracts = new Map();
        this.gatingPolicies = new Map();
        this.repairRecipes = new Map();
        this.toolCostMetadata = new Map();
        this.toolPermissions = new Map();
    }
    registerPromptContract(contract) {
        if (!isPromptContract(contract)) {
            throw new Error(`Invalid PromptContract: ${JSON.stringify(contract)}`);
        }
        this.promptContracts.set(contract.toolName, contract);
    }
    registerGatingPolicy(policy) {
        if (!isToolGatingPolicy(policy)) {
            throw new Error(`Invalid ToolGatingPolicy: ${JSON.stringify(policy)}`);
        }
        this.gatingPolicies.set(policy.policyId, policy);
    }
    registerRepairRecipe(recipe) {
        if (!isRepairRecipe(recipe)) {
            throw new Error(`Invalid RepairRecipe: ${JSON.stringify(recipe)}`);
        }
        this.repairRecipes.set(this.repairKey(recipe.toolName, recipe.errorCode), recipe);
    }
    registerToolCostMetadata(metadata) {
        if (!isToolCostMetadata(metadata)) {
            throw new Error(`Invalid ToolCostMetadata: ${JSON.stringify(metadata)}`);
        }
        this.toolCostMetadata.set(metadata.tool, metadata);
    }
    registerToolPermission(permission) {
        if (!isToolPermission(permission)) {
            throw new Error(`Invalid ToolPermission: ${JSON.stringify(permission)}`);
        }
        this.toolPermissions.set(permission.tool, permission);
    }
    getPromptContract(toolName) {
        return this.promptContracts.get(toolName);
    }
    getGatingPolicy(policyId) {
        return this.gatingPolicies.get(policyId);
    }
    findRepairRecipe(toolName, errorCode) {
        return this.repairRecipes.get(this.repairKey(toolName, errorCode));
    }
    getToolCostMetadata(toolName) {
        return this.toolCostMetadata.get(toolName);
    }
    getToolPermission(toolName) {
        return this.toolPermissions.get(toolName);
    }
    listPromptContracts() {
        return Array.from(this.promptContracts.values());
    }
    listGatingPolicies() {
        return Array.from(this.gatingPolicies.values());
    }
    listRepairRecipes() {
        return Array.from(this.repairRecipes.values());
    }
    listToolCostMetadata() {
        return Array.from(this.toolCostMetadata.values());
    }
    listToolPermissions() {
        return Array.from(this.toolPermissions.values());
    }
    repairKey(toolName, errorCode) {
        return `${toolName}::${errorCode}`;
    }
}
//# sourceMappingURL=registry.js.map