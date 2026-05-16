import { TOOL_COST_METADATA, } from './toolCostMetadata.js';
function decisionForRisk(level) {
    switch (level) {
        case 'safe':
            return 'allow';
        case 'paid':
            return 'require_user_approval';
        case 'destructive':
            return 'require_explicit_intent';
    }
}
function makePermission(entry) {
    const decision = decisionForRisk(entry.riskLevel);
    return {
        tool: entry.tool,
        decision,
        riskLevel: entry.riskLevel,
        requiresUserApproval: decision !== 'allow',
        userVisibleCost: entry.userVisibleCost,
    };
}
export const TOOL_PERMISSIONS = TOOL_COST_METADATA.map(makePermission);
const PERMISSION_BY_TOOL = new Map(TOOL_PERMISSIONS.map((entry) => [entry.tool, entry]));
export function getToolPermission(toolName) {
    return PERMISSION_BY_TOOL.get(toolName);
}
export function toolRequiresUserApproval(toolName) {
    const entry = getToolPermission(toolName);
    return entry ? entry.requiresUserApproval : false;
}
export function getToolPermissionDecision(toolName) {
    return getToolPermission(toolName)?.decision ?? 'allow';
}
const EXPLICIT_INTENT_PATTERNS = {
    manage_memory: /\b(?:save|remember|store|note|memorize|forget|delete|remove|wipe|clear)\b[\s\S]{0,80}\b(?:memory|memories|note|notes|preference|preferences|fact|facts|profile|about\s+me)\b/i,
};
export function evaluatePermissionGate(input) {
    const perm = getToolPermission(input.toolName);
    if (!perm) {
        return { allowed: true, decision: 'allow' };
    }
    if (perm.decision === 'allow' || perm.decision === 'require_user_approval') {
        return { allowed: true, decision: perm.decision };
    }
    if (input.alreadyAskingClarification) {
        return { allowed: true, decision: perm.decision };
    }
    const pattern = EXPLICIT_INTENT_PATTERNS[input.toolName];
    if (!pattern) {
        return {
            allowed: false,
            decision: 'require_explicit_intent',
            reason: `${input.toolName} is destructive and requires explicit user instruction. Please ask the user to confirm before invoking it.`,
        };
    }
    if (pattern.test(input.latestUserText)) {
        return { allowed: true, decision: 'require_explicit_intent' };
    }
    return {
        allowed: false,
        decision: 'require_explicit_intent',
        reason: `${input.toolName} requires the user to explicitly ask for the action (e.g. "save this", "remember that", "forget X"). The latest message does not contain that intent; ask the user to confirm before invoking.`,
    };
}
export function populateToolPermissions(registry) {
    for (const permission of TOOL_PERMISSIONS) {
        registry.registerToolPermission(permission);
    }
}
//# sourceMappingURL=toolPermissions.js.map