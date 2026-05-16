const VALID_KINDS = new Set([
    'turn_classified',
    'gating_policy_applied',
    'prompt_contract_emitted',
    'tool_dispatch_resolved',
    'repair_recipe_fired',
]);
export function isContractsTelemetryEvent(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const v = value;
    if (typeof v.kind !== 'string' || !VALID_KINDS.has(v.kind))
        return false;
    if (typeof v.timestamp !== 'number')
        return false;
    if (v.payload === null || typeof v.payload !== 'object')
        return false;
    return true;
}
export function makeBufferedSink(capacity = 256) {
    const buf = [];
    return {
        emit(event) {
            buf.push(event);
            if (buf.length > capacity)
                buf.splice(0, buf.length - capacity);
        },
        events() {
            return [...buf];
        },
    };
}
//# sourceMappingURL=telemetry.js.map