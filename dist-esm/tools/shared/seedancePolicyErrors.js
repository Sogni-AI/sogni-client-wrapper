import { vendorModelPremiumPayloadFromError, } from '../../media/index.js';
export const SEEDANCE_INPUT_IMAGE_PRIVACY_POLICY_CODE = 'InputImageSensitiveContentDetected.PrivacyInformation';
export const SEEDANCE_REAL_PERSON_PRIVACY_MESSAGE = "Seedance rejected the input image because it may contain a real person. Seedance Video currently doesn't allow photographic depictions of real people. Please use a non-real-person or more stylized reference image, or switch to another video model.";
export const SEEDANCE_PROVIDER_CONTENT_POLICY_MESSAGE = "Seedance blocked this video because it did not pass the provider's content policy. No video was returned.";
export const SEEDANCE_VENDOR_GENERATION_FAILED_MESSAGE = "Seedance couldn't complete this video after it started, so no media was generated. The provider did not return a specific reason. Please retry once; if it fails again, report the issue from this message.";
export const SEEDANCE_REFERENCE_AUDIO_TOO_LONG_MESSAGE = 'Seedance rejected the reference audio because it is longer than this video mode allows. Use an audio clip at or below the provider limit, or retry with the audio trimmed to that length.';
export class SeedanceTerminalPolicyError extends Error {
    constructor(payload) {
        super(payload.message);
        this.name = 'SeedanceTerminalPolicyError';
        this.payload = payload;
    }
}
function collectErrorText(value, seen = new WeakSet()) {
    if (value === null || value === undefined)
        return '';
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (value instanceof Error) {
        const cause = value.cause;
        return [
            value.name,
            value.message,
            cause ? collectErrorText(cause, seen) : '',
        ].filter(Boolean).join(' ');
    }
    if (typeof value !== 'object')
        return String(value);
    if (seen.has(value))
        return '';
    seen.add(value);
    const record = value;
    const nested = Object.values(record)
        .map((nestedValue) => collectErrorText(nestedValue, seen))
        .filter(Boolean)
        .join(' ');
    try {
        return `${JSON.stringify(value)} ${nested}`.trim();
    }
    catch {
        return nested;
    }
}
function hasVendorCode5061(value, seen = new WeakSet()) {
    if (value === null || value === undefined)
        return false;
    if (typeof value === 'number')
        return value === 5061;
    if (typeof value === 'string')
        return value.trim() === '5061';
    if (value instanceof Error) {
        const cause = value.cause;
        return cause ? hasVendorCode5061(cause, seen) : false;
    }
    if (typeof value !== 'object')
        return false;
    if (seen.has(value))
        return false;
    seen.add(value);
    const record = value;
    if (record.code === 5061 || record.code === '5061')
        return true;
    return Object.values(record).some((nestedValue) => hasVendorCode5061(nestedValue, seen));
}
function textHasSeedanceRealPersonPrivacySignal(text) {
    return (/\bmay\s+contain\s+(?:a\s+)?real\s+person\b/i.test(text) ||
        /\bcontains?\s+(?:a\s+)?real\s+person\b/i.test(text) ||
        /\bphotographic\s+depictions?\s+of\s+real\s+people\b/i.test(text));
}
function textHasSeedanceContentPolicySignal(text) {
    return (/\bcontent[_\s-]?policy\b/i.test(text) ||
        /\bmoderation\b/i.test(text) ||
        /\bsafety\s+(?:system|review|violation|violations)\b/i.test(text) ||
        /\bsafety[_\s-]?violations?\b/i.test(text) ||
        /\bSensitiveContentDetected\b/i.test(text) ||
        /\bsensitive\s+content\b/i.test(text) ||
        /\bnsfw\b/i.test(text));
}
function vendorErrorCodeFromText(text) {
    const jsonCode = text.match(/"code"\s*:\s*"([^"]+)"/i)?.[1];
    return jsonCode ?? null;
}
function seedanceAudioDurationLimitFromText(text) {
    const match = text.match(/\baudio\s+duration\b[\s\S]{0,180}\b(?:less than or equal to|<=|no more than|maximum(?:\s+of)?)\s+(\d+(?:\.\d+)?)\b/i);
    if (!match?.[1])
        return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
function seedanceInvalidParameterMessageFromText(text) {
    if (!text)
        return null;
    const match = text.match(/"(?:message|Message)"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (!match?.[1])
        return null;
    let parsed = match[1];
    try {
        parsed = JSON.parse(`"${parsed}"`);
    }
    catch {
    }
    parsed = parsed.replace(/\s*Request id:\s*[A-Za-z0-9._-]+/i, '').trim();
    return parsed.length > 0 ? parsed : null;
}
const SEEDANCE_FRAME_REFERENCE_CONFLICT_PATTERN = /\bfirst\/last frame content cannot be mixed with reference media content\b/i;
const SEEDANCE_SOCKET_MIXED_MODE_PATTERN = /\bSeedance rejects requests that combine first\/last-frame images with reference media\b/i;
function shapeSeedanceInvalidParameterMessage(vendorMessage) {
    if (SEEDANCE_SOCKET_MIXED_MODE_PATTERN.test(vendorMessage)) {
        return { vendorMessage, userMessage: vendorMessage };
    }
    if (SEEDANCE_FRAME_REFERENCE_CONFLICT_PATTERN.test(vendorMessage)) {
        return {
            vendorMessage,
            userMessage: "Seedance can't combine a locked first/last frame image with audio, video, or extra image references in the same request. Send the image as a reference instead of a frame anchor, or remove the audio/video reference and try again.",
        };
    }
    return {
        vendorMessage,
        userMessage: `Seedance rejected the request: ${vendorMessage}`,
    };
}
export function seedanceTerminalPolicyPayloadFromError(error) {
    if (error instanceof SeedanceTerminalPolicyError)
        return error.payload;
    const text = collectErrorText(error);
    const hasVendorPrivacyCode = text.includes(SEEDANCE_INPUT_IMAGE_PRIVACY_POLICY_CODE);
    const hasRealPersonPrivacySignal = textHasSeedanceRealPersonPrivacySignal(text);
    const hasContentPolicySignal = textHasSeedanceContentPolicySignal(text);
    if (!hasVendorPrivacyCode && !hasRealPersonPrivacySignal && !hasContentPolicySignal)
        return null;
    const isSeedanceError = /\bseedance\b/i.test(text);
    const hasExpectedVendorCode = hasVendorCode5061(error) || /\b5061\b/.test(text);
    if (!isSeedanceError && !hasExpectedVendorCode)
        return null;
    if (!hasVendorPrivacyCode && !hasRealPersonPrivacySignal) {
        return {
            error: 'seedance_content_policy',
            message: SEEDANCE_PROVIDER_CONTENT_POLICY_MESSAGE,
            retryPolicy: 'manual_user_confirmation',
            nextAction: 'wait_for_user',
            ...(hasExpectedVendorCode ? { vendorCode: 5061 } : {}),
            vendorErrorCode: vendorErrorCodeFromText(text) ?? 'SEEDANCE_CONTENT_POLICY',
        };
    }
    return {
        error: 'seedance_input_image_privacy_policy',
        message: SEEDANCE_REAL_PERSON_PRIVACY_MESSAGE,
        retryPolicy: 'manual_user_confirmation',
        nextAction: 'wait_for_user',
        ...(hasExpectedVendorCode ? { vendorCode: 5061 } : {}),
        vendorErrorCode: SEEDANCE_INPUT_IMAGE_PRIVACY_POLICY_CODE,
    };
}
export function seedanceTerminalPolicyErrorFromError(error) {
    const payload = seedanceTerminalPolicyPayloadFromError(error);
    return payload ? new SeedanceTerminalPolicyError(payload) : null;
}
export function seedanceTerminalGenerationFailurePayloadFromError(error) {
    const premiumPayload = vendorModelPremiumPayloadFromError(error);
    if (premiumPayload)
        return premiumPayload;
    const text = collectErrorText(error);
    if (!/\bAll\s+\d+\s+(?:video generation|sound-to-video|video-to-video)\s+jobs failed\b/i.test(text)
        && !/\bVendor task\b[\s\S]{0,140}\bstatus=failed\b/i.test(text)
        && !/\bVendor (?:job|dispatch) failed\b/i.test(text)
        && !SEEDANCE_SOCKET_MIXED_MODE_PATTERN.test(text)) {
        return null;
    }
    if (SEEDANCE_SOCKET_MIXED_MODE_PATTERN.test(text)) {
        const start = text.search(/\bSeedance rejects requests that combine first\/last-frame images with reference media\b/i);
        const message = start >= 0 ? text.slice(start, start + 1500).trim() : text.slice(0, 1500).trim();
        return {
            error: 'seedance_generation_failed',
            message,
            retryPolicy: 'manual_user_confirmation',
            nextAction: 'wait_for_user',
            vendorErrorCode: 'SEEDANCE_MIXED_MODE_REJECTED',
            vendorError: text.slice(0, 500),
        };
    }
    const audioDurationLimit = seedanceAudioDurationLimitFromText(text);
    if (audioDurationLimit !== null) {
        return {
            error: 'seedance_reference_audio_too_long',
            message: `Seedance rejected the reference audio because it is longer than ${audioDurationLimit}s for this video mode. Use an audio clip ${audioDurationLimit}s or shorter, or retry with the audio trimmed to that length.`,
            retryPolicy: 'manual_user_confirmation',
            nextAction: 'wait_for_user',
            vendorErrorCode: 'InvalidParameter',
            maxAudioDurationSeconds: audioDurationLimit,
            ...(text ? { vendorError: text.slice(0, 500) } : {}),
        };
    }
    const invalidParameterMessage = seedanceInvalidParameterMessageFromText(text);
    if (invalidParameterMessage) {
        if (textHasSeedanceRealPersonPrivacySignal(invalidParameterMessage)) {
            return {
                error: 'seedance_generation_failed',
                message: SEEDANCE_VENDOR_GENERATION_FAILED_MESSAGE,
                retryPolicy: 'manual_user_confirmation',
                nextAction: 'wait_for_user',
                reportIssue: true,
                reportIssueReason: 'Seedance provider job failed after starting with a privacy-related provider detail.',
                vendorErrorCode: text.includes(SEEDANCE_INPUT_IMAGE_PRIVACY_POLICY_CODE)
                    ? SEEDANCE_INPUT_IMAGE_PRIVACY_POLICY_CODE
                    : 'SEEDANCE_PRIVACY_DETAIL',
                vendorError: text.slice(0, 500),
            };
        }
        const shaped = shapeSeedanceInvalidParameterMessage(invalidParameterMessage);
        return {
            error: 'seedance_generation_failed',
            message: shaped.userMessage,
            retryPolicy: 'manual_user_confirmation',
            nextAction: 'wait_for_user',
            vendorErrorCode: 'InvalidParameter',
            vendorError: shaped.vendorMessage.slice(0, 500),
        };
    }
    return {
        error: 'seedance_generation_failed',
        message: SEEDANCE_VENDOR_GENERATION_FAILED_MESSAGE,
        retryPolicy: 'manual_user_confirmation',
        nextAction: 'wait_for_user',
        reportIssue: true,
        reportIssueReason: 'Seedance provider job failed after starting without a specific provider reason.',
        ...(text ? { vendorError: text.slice(0, 500) } : {}),
    };
}
//# sourceMappingURL=seedancePolicyErrors.js.map