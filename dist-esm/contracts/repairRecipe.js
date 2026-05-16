const VALID_MODES = new Set([
    'autoRepair',
    'suggestFollowup',
    'stopAndAsk',
]);
export function isRepairRecipe(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const v = value;
    if (typeof v.recipeId !== 'string' || v.recipeId.length === 0)
        return false;
    if (typeof v.version !== 'string' || v.version.length === 0)
        return false;
    if (typeof v.toolName !== 'string' || v.toolName.length === 0)
        return false;
    if (typeof v.errorCode !== 'string' || v.errorCode.length === 0)
        return false;
    if (typeof v.mode !== 'string' || !VALID_MODES.has(v.mode))
        return false;
    if (typeof v.maxRetries !== 'number' || !Number.isFinite(v.maxRetries) || v.maxRetries < 0)
        return false;
    if (typeof v.repairNoteTemplate !== 'string')
        return false;
    if (v.autoRepairFields !== undefined) {
        if (!Array.isArray(v.autoRepairFields))
            return false;
        if (v.autoRepairFields.some((x) => typeof x !== 'string'))
            return false;
    }
    if (v.suggestedFollowupTool !== undefined && typeof v.suggestedFollowupTool !== 'string') {
        return false;
    }
    return true;
}
//# sourceMappingURL=repairRecipe.js.map