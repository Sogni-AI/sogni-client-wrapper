function isStringRecord(value) {
    if (value === null || typeof value !== 'object')
        return false;
    for (const v of Object.values(value)) {
        if (typeof v !== 'string')
            return false;
    }
    return true;
}
export function isPromptContract(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const v = value;
    if (typeof v.contractId !== 'string' || v.contractId.length === 0)
        return false;
    if (typeof v.version !== 'string' || v.version.length === 0)
        return false;
    if (typeof v.toolName !== 'string' || v.toolName.length === 0)
        return false;
    if (typeof v.baseDescription !== 'string')
        return false;
    if (!isStringRecord(v.parameterDocs))
        return false;
    if (v.voiceExamples !== undefined) {
        if (!Array.isArray(v.voiceExamples))
            return false;
        if (v.voiceExamples.some((x) => typeof x !== 'string'))
            return false;
    }
    if (v.conditionalNotes !== undefined && !isStringRecord(v.conditionalNotes))
        return false;
    return true;
}
//# sourceMappingURL=promptContract.js.map