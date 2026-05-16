import { classifyError } from './errorClassification.js';
const REASON_BY_CODE = {
    worker_disconnected: 'the generation worker disconnected',
    timeout: 'the generation service stopped responding',
    content_refused: 'the prompt was blocked by content moderation',
    insufficient_credits: 'the account ran out of credits',
    transient_failure: 'a temporary network issue interrupted the job',
    cancelled: 'the job was cancelled before completing',
    permanent_failure: 'the generation worker reported a permanent failure',
};
const PRIORITY = [
    'worker_disconnected',
    'timeout',
    'content_refused',
    'insufficient_credits',
    'transient_failure',
    'cancelled',
    'permanent_failure',
];
function codeForError(slotError) {
    if (!slotError)
        return null;
    const message = slotError instanceof Error ? slotError.message : String(slotError);
    const lower = message.toLowerCase();
    if (lower.includes('worker disconnected') || lower.includes('workerdisconnected')) {
        return 'worker_disconnected';
    }
    const classified = classifyError(slotError);
    switch (classified.category) {
        case 'timeout':
            return 'timeout';
        case 'content_refused':
            return 'content_refused';
        case 'insufficient_credits':
            return 'insufficient_credits';
        case 'transient_failure':
            return 'transient_failure';
        case 'cancelled':
            return 'cancelled';
        case 'permanent_failure':
            return 'permanent_failure';
        default:
            return null;
    }
}
export function summarizeSlotFailures(slotErrors) {
    const seen = new Set();
    for (const slotError of slotErrors) {
        const code = codeForError(slotError);
        if (code)
            seen.add(code);
    }
    for (const code of PRIORITY) {
        if (seen.has(code)) {
            return { code, reason: REASON_BY_CODE[code] };
        }
    }
    return undefined;
}
//# sourceMappingURL=slotFailureSummary.js.map