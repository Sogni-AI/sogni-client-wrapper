function isStringArray(value) {
    return Array.isArray(value) && value.every((v) => typeof v === 'string');
}
function isSignalSource(value) {
    return value === 'planner'
        || value === 'regex'
        || value === 'classifier'
        || value === 'session_state';
}
function isSourceConstraintMap(value) {
    if (value === undefined)
        return true;
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return false;
    return Object.values(value).every((constraint) => isSignalSource(constraint)
        || (Array.isArray(constraint) && constraint.length > 0 && constraint.every(isSignalSource)));
}
function isTrigger(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const t = value;
    if (!isStringArray(t.allOf))
        return false;
    if (t.noneOf !== undefined && !isStringArray(t.noneOf))
        return false;
    const hasAllOf = t.allOf.length > 0;
    const hasNoneOf = Array.isArray(t.noneOf) && t.noneOf.length > 0;
    if (!hasAllOf && !hasNoneOf)
        return false;
    if (!isSourceConstraintMap(t.sources))
        return false;
    return true;
}
function isEffect(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const e = value;
    if (!isStringArray(e.forbid))
        return false;
    if (e.require !== undefined && !isStringArray(e.require))
        return false;
    return true;
}
export function isToolGatingPolicy(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const v = value;
    if (typeof v.policyId !== 'string' || v.policyId.length === 0)
        return false;
    if (typeof v.version !== 'string' || v.version.length === 0)
        return false;
    if (!isTrigger(v.trigger))
        return false;
    if (!isEffect(v.effect))
        return false;
    if (typeof v.rationale !== 'string')
        return false;
    return true;
}
//# sourceMappingURL=toolGatingPolicy.js.map