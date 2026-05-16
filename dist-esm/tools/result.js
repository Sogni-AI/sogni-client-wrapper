export function mapLegacyToolErrorCategory(category) {
    switch (category) {
        case 'schema_validation': return 'PARAMETER_INVALID';
        case 'business_rule': return 'WORKFLOW_VALIDATION_FAILED';
        case 'precondition_failed': return 'PERMISSION_REQUIRED';
        case 'transient_failure': return 'PROVIDER_TIMEOUT';
        case 'permanent_failure': return 'UNKNOWN_ERROR';
        case 'insufficient_credits': return 'COST_LIMIT_EXCEEDED';
        case 'timeout': return 'PROVIDER_TIMEOUT';
        case 'cancelled': return 'USER_CANCELLED';
        case 'content_refused': return 'SAFETY_REJECTED';
    }
}
export function toolOk(fields) {
    return {
        ok: true,
        status: 'completed',
        output_assets: [],
        ...fields,
    };
}
export function toolErr(fields) {
    return { ok: false, ...fields };
}
export function isToolResultOk(result) {
    return result.ok === true;
}
export function isToolResultErr(result) {
    return result.ok === false;
}
//# sourceMappingURL=result.js.map