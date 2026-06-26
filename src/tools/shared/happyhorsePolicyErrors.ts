/**
 * Alibaba HappyHorse 1.1 terminal policy & generation-failure error taxonomy.
 *
 * Pure logic — used by browser chat, hosted chat in sogni-api, and the skill
 * runtime so all three speak the same HappyHorse error contract. Sibling of
 * `seedancePolicyErrors.ts`.
 *
 * VERIFIED live failure schema (DashScope async task poll):
 *   { "output": { "task_status": "FAILED", "code": "<Code>", "message": "<text>" } }
 * i.e. the vendor failure fields are `output.code` + `output.message` (there is
 * no `usage` block on failure). The success path returns `output.video_url`.
 *
 * TODO(alibaba-content-policy-codes): The exact Alibaba content-moderation codes
 * (the HappyHorse analog of Seedance's
 * `InputImageSensitiveContentDetected.PrivacyInformation` / vendor code 5061)
 * are not yet documented for our workspace. Until they are probed/observed, the
 * content-policy mapping below is best-effort signal-text matching. When the
 * real codes are known, pin them as constants here (mirroring
 * SEEDANCE_INPUT_IMAGE_PRIVACY_POLICY_CODE) and key the mapping off `output.code`.
 */
import {
  vendorModelPremiumPayloadFromError,
  type VendorModelPremiumRequiredPayload,
} from '../../media/index.js';

export const HAPPYHORSE_PROVIDER_CONTENT_POLICY_MESSAGE =
  "HappyHorse's content check didn't pass this one, so no video came back this time. We can adjust the prompt or try a different look and give it another go.";

export const HAPPYHORSE_VENDOR_GENERATION_FAILED_MESSAGE =
  "HappyHorse hit a snag partway through this one, so no media was generated. The provider did not return a specific reason — a quick retry usually clears it up. If it happens again, you can report the issue right from this message.";

export const HAPPYHORSE_VENDOR_TIMEOUT_MESSAGE =
  "HappyHorse took a bit too long on this one and timed out, so no media was generated. A quick retry usually does the trick; if it times out again, you can report the issue right from this message.";

export const HAPPYHORSE_INPUT_DOWNLOAD_FAILED_MESSAGE =
  "HappyHorse couldn't fetch one of the images for this video, so no media was generated. Make sure each reference image is a publicly reachable URL (or send it inline) and we'll try again.";

export interface HappyHorseTerminalPolicyPayload {
  error: 'happyhorse_content_policy';
  message: typeof HAPPYHORSE_PROVIDER_CONTENT_POLICY_MESSAGE;
  retryPolicy: 'manual_user_confirmation';
  nextAction: 'wait_for_user';
  /** Raw `output.code` when the provider supplied one. */
  vendorErrorCode: string;
}

export interface HappyHorseTerminalGenerationFailurePayload {
  error: 'happyhorse_generation_failed' | 'happyhorse_input_download_failed';
  message: string;
  retryPolicy: 'manual_user_confirmation';
  nextAction: 'wait_for_user';
  reportIssue?: true;
  reportIssueReason?: string;
  vendorError?: string;
  /** Raw `output.code` (e.g. "InvalidParameter") when the provider supplied one. */
  vendorErrorCode?: string;
}

export class HappyHorseTerminalPolicyError extends Error {
  readonly payload: HappyHorseTerminalPolicyPayload;

  constructor(payload: HappyHorseTerminalPolicyPayload) {
    super(payload.message);
    this.name = 'HappyHorseTerminalPolicyError';
    this.payload = payload;
  }
}

function collectErrorText(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Error) {
    const cause = (value as { cause?: unknown }).cause;
    return [
      value.name,
      value.message,
      cause ? collectErrorText(cause, seen) : '',
    ].filter(Boolean).join(' ');
  }
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '';
  seen.add(value);

  const record = value as Record<string, unknown>;
  const nested = Object.values(record)
    .map((nestedValue) => collectErrorText(nestedValue, seen))
    .filter(Boolean)
    .join(' ');

  try {
    return `${JSON.stringify(value)} ${nested}`.trim();
  } catch {
    return nested;
  }
}

/**
 * Pull the structured `output.code` / `output.message` pair out of an error
 * payload. Walks plain objects (so a parsed poll response, an `AppError`-style
 * `{ output: { code, message } }`, or a JSON-stringified blob all resolve),
 * then falls back to regex over the flattened error text.
 */
function extractHappyHorseFailureFields(
  value: unknown,
  seen = new WeakSet<object>(),
): { code: string | null; message: string | null } {
  if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    const record = value as Record<string, unknown>;
    const output = record.output;
    if (output && typeof output === 'object') {
      const out = output as Record<string, unknown>;
      const code = typeof out.code === 'string' ? out.code : null;
      const message = typeof out.message === 'string' ? out.message : null;
      if (code || message) return { code, message };
    }
    for (const nested of Object.values(record)) {
      if (nested && typeof nested === 'object') {
        const found = extractHappyHorseFailureFields(nested, seen);
        if (found.code || found.message) return found;
      }
    }
  }

  const text = collectErrorText(value);
  const code = text.match(/"code"\s*:\s*"([^"]+)"/i)?.[1] ?? null;
  const messageRaw = text.match(/"(?:message|Message)"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? null;
  let message: string | null = null;
  if (messageRaw) {
    let parsed = messageRaw;
    try {
      parsed = JSON.parse(`"${messageRaw}"`);
    } catch {
      /* leave raw — escapes read fine in plain English */
    }
    message = parsed.replace(/\s*Request id:\s*[A-Za-z0-9._-]+/i, '').trim() || null;
  }
  return { code, message };
}

function textHasHappyHorseContentPolicySignal(text: string): boolean {
  return (
    /\bcontent[_\s-]?policy\b/i.test(text) ||
    /\bmoderation\b/i.test(text) ||
    /\bsafety\s+(?:system|review|violation|violations)\b/i.test(text) ||
    /\bsafety[_\s-]?violations?\b/i.test(text) ||
    /\bSensitiveContentDetected\b/i.test(text) ||
    /\bsensitive\s+content\b/i.test(text) ||
    /\bnsfw\b/i.test(text) ||
    /\bDataInspection(?:Failed|Exception)?\b/i.test(text)
  );
}

export function happyhorseTerminalPolicyPayloadFromError(
  error: unknown,
): HappyHorseTerminalPolicyPayload | null {
  if (error instanceof HappyHorseTerminalPolicyError) return error.payload;

  const text = collectErrorText(error);
  if (!textHasHappyHorseContentPolicySignal(text)) return null;

  // Only treat this as a HappyHorse policy rejection when the text actually
  // names HappyHorse, so a generic moderation string from another vendor is
  // not misattributed.
  if (!/\bhappy\s*horse\b/i.test(text) && !/\bhappyhorse\b/i.test(text)) return null;

  const { code } = extractHappyHorseFailureFields(error);
  return {
    error: 'happyhorse_content_policy',
    message: HAPPYHORSE_PROVIDER_CONTENT_POLICY_MESSAGE,
    retryPolicy: 'manual_user_confirmation',
    nextAction: 'wait_for_user',
    vendorErrorCode: code ?? 'HAPPYHORSE_CONTENT_POLICY',
  };
}

export function happyhorseTerminalPolicyErrorFromError(
  error: unknown,
): HappyHorseTerminalPolicyError | null {
  const payload = happyhorseTerminalPolicyPayloadFromError(error);
  return payload ? new HappyHorseTerminalPolicyError(payload) : null;
}

export function happyhorseTerminalGenerationFailurePayloadFromError(
  error: unknown,
): HappyHorseTerminalGenerationFailurePayload | VendorModelPremiumRequiredPayload | null {
  const premiumPayload = vendorModelPremiumPayloadFromError(error);
  if (premiumPayload) return premiumPayload;

  const text = collectErrorText(error);
  if (
    !/\bAll\s+\d+\s+(?:video generation|sound-to-video|video-to-video)\s+jobs failed\b/i.test(text)
    && !/\bVendor task\b[\s\S]{0,140}\bstatus=failed\b/i.test(text)
    && !/\bVendor (?:job|dispatch) failed\b/i.test(text)
    && !/\bhappyhorse\b/i.test(text)
    && !/\bhappy\s*horse\b/i.test(text)
  ) {
    return null;
  }

  const { code, message } = extractHappyHorseFailureFields(error);

  // Unfetchable reference image — the most common i2v/r2v terminal failure.
  if (message && /\bfailed to download\b/i.test(message)) {
    return {
      error: 'happyhorse_input_download_failed',
      message: HAPPYHORSE_INPUT_DOWNLOAD_FAILED_MESSAGE,
      retryPolicy: 'manual_user_confirmation',
      nextAction: 'wait_for_user',
      vendorErrorCode: code ?? 'InvalidParameter',
      vendorError: message.slice(0, 500),
    };
  }

  if (/\b(?:timed?\s*out|timeout|deadline\s+exceeded)\b/i.test(text)) {
    return {
      error: 'happyhorse_generation_failed',
      message: HAPPYHORSE_VENDOR_TIMEOUT_MESSAGE,
      retryPolicy: 'manual_user_confirmation',
      nextAction: 'wait_for_user',
      reportIssue: true,
      reportIssueReason: 'HappyHorse provider job timed out after starting.',
      vendorErrorCode: code ?? 'PROVIDER_TIMEOUT',
      ...(text ? { vendorError: text.slice(0, 500) } : {}),
    };
  }

  // Surface a recognised vendor message verbatim; otherwise fall back to the
  // generic no-specific-reason failure.
  if (message) {
    return {
      error: 'happyhorse_generation_failed',
      message: `HappyHorse rejected the request: ${message}`,
      retryPolicy: 'manual_user_confirmation',
      nextAction: 'wait_for_user',
      ...(code ? { vendorErrorCode: code } : {}),
      vendorError: message.slice(0, 500),
    };
  }

  return {
    error: 'happyhorse_generation_failed',
    message: HAPPYHORSE_VENDOR_GENERATION_FAILED_MESSAGE,
    retryPolicy: 'manual_user_confirmation',
    nextAction: 'wait_for_user',
    reportIssue: true,
    reportIssueReason: 'HappyHorse provider job failed after starting without a specific provider reason.',
    ...(code ? { vendorErrorCode: code } : {}),
    ...(text ? { vendorError: text.slice(0, 500) } : {}),
  };
}
