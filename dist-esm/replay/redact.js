const REDACTION_PLACEHOLDER = '[REDACTED]';
const SECRET_KEY_PATTERNS = [
    /api[_-]?key$/i,
    /access[_-]?token$/i,
    /id[_-]?token$/i,
    /refresh[_-]?token$/i,
    /bearer[_-]?token$/i,
    /^token$/i,
    /authorization$/i,
    /^cookie$/i,
    /^set-?cookie$/i,
    /session[_-]?id$/i,
    /password$/i,
    /secret$/i,
    /private[_-]?key$/i,
    /signing[_-]?key$/i,
    /^pem$/i,
    /walletauth$/i,
    /^x-?api-?key$/i,
];
const VALUE_SCRUBBERS = [
    { pattern: /(Authorization\s*:\s*)(Bearer|Basic)\s+\S+/gi, replacement: `$1$2 ${REDACTION_PLACEHOLDER}` },
    { pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/g, replacement: `Bearer ${REDACTION_PLACEHOLDER}` },
    { pattern: /([?&](?:X-Amz-Signature|Signature|sig|Policy|Key-Pair-Id|X-Amz-Credential)=)[^&\s"']+/gi, replacement: `$1${REDACTION_PLACEHOLDER}` },
    { pattern: /\bsk-[A-Za-z0-9]{20,}/g, replacement: REDACTION_PLACEHOLDER },
    { pattern: /\bsk-ant-[A-Za-z0-9-_]{20,}/g, replacement: REDACTION_PLACEHOLDER },
    { pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, replacement: REDACTION_PLACEHOLDER },
    { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replacement: REDACTION_PLACEHOLDER },
];
function isSecretKey(key) {
    return SECRET_KEY_PATTERNS.some((re) => re.test(key));
}
export function redactStringValue(value) {
    let out = value;
    for (const { pattern, replacement } of VALUE_SCRUBBERS) {
        if (pattern.test(out)) {
            pattern.lastIndex = 0;
            out = out.replace(pattern, replacement);
        }
    }
    return out;
}
export function redactPayload(value, depth = 0) {
    if (depth > 32)
        return REDACTION_PLACEHOLDER;
    if (value === null || value === undefined)
        return value;
    if (typeof value === 'string')
        return redactStringValue(value);
    if (typeof value === 'number' || typeof value === 'boolean')
        return value;
    if (Array.isArray(value)) {
        return value.map((item) => redactPayload(item, depth + 1));
    }
    if (typeof value === 'object') {
        const out = {};
        for (const [key, val] of Object.entries(value)) {
            if (isSecretKey(key)) {
                out[key] = REDACTION_PLACEHOLDER;
            }
            else {
                out[key] = redactPayload(val, depth + 1);
            }
        }
        return out;
    }
    return REDACTION_PLACEHOLDER;
}
function redactToolCall(call) {
    return {
        ...call,
        arguments: redactPayload(call.arguments),
    };
}
function redactToolResult(result) {
    return {
        ok: result.ok,
        ...(result.error_type !== undefined ? { error_type: result.error_type } : {}),
        payload: redactPayload(result.payload),
    };
}
function redactRound(round) {
    return {
        round: round.round,
        assistant_message: redactStringValue(round.assistant_message),
        tool_calls: round.tool_calls.map(redactToolCall),
        tool_results: round.tool_results.map(redactToolResult),
    };
}
export function redactRunRecord(record) {
    return {
        ...record,
        user_request: redactStringValue(record.user_request),
        runtime_config: redactPayload(record.runtime_config),
        tool_schemas: record.tool_schemas.map((schema) => redactPayload(schema)),
        rounds: record.rounds.map(redactRound),
        final_response: redactStringValue(record.final_response),
        redacted: true,
    };
}
export { REDACTION_PLACEHOLDER };
//# sourceMappingURL=redact.js.map