/**
 * Secret redaction for RunRecords.
 *
 * Applied identically on both write paths (sogni-chat → API ingest, and
 * sogni-api server-side write). Single source of truth so a record
 * persisted via either path cannot leak credentials, signed URLs, or
 * user-provided secrets.
 *
 * Conservative by design: scrubs anything that looks like an API key,
 * Authorization header, bearer token, signed URL parameter, JWT, or
 * private-key fragment. False positives are acceptable (a redacted
 * record loses some context); false negatives are not (a persisted
 * record leaks a secret).
 *
 * Pure function — no side effects, no I/O. Safe to run in hot paths.
 */

import type { RunRecord, RunRecordRound, RunRecordToolCall, RunRecordToolResult } from './types.js';

const REDACTION_PLACEHOLDER = '[REDACTED]';

/**
 * Keys that always get redacted regardless of value. Lowercase comparison.
 * Includes both Sogni-specific (apiKey, walletAuth) and generic auth
 * (authorization, cookie, sessionId, accessToken, ...) names.
 */
const SECRET_KEY_PATTERNS: ReadonlyArray<RegExp> = [
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

/**
 * Substrings inside string values that suggest secrets. Used for
 * value-side scrubbing (e.g. Authorization header value embedded in a
 * free-form note).
 */
const VALUE_SCRUBBERS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // Standard auth headers
  { pattern: /(Authorization\s*:\s*)(Bearer|Basic)\s+\S+/gi, replacement: `$1$2 ${REDACTION_PLACEHOLDER}` },
  // Standalone bearer tokens
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/g, replacement: `Bearer ${REDACTION_PLACEHOLDER}` },
  // Signed S3-style URLs: keep the host/path, drop the signature payload
  { pattern: /([?&](?:X-Amz-Signature|Signature|sig|Policy|Key-Pair-Id|X-Amz-Credential)=)[^&\s"']+/gi, replacement: `$1${REDACTION_PLACEHOLDER}` },
  // OpenAI / Anthropic style API keys
  { pattern: /\bsk-[A-Za-z0-9]{20,}/g, replacement: REDACTION_PLACEHOLDER },
  { pattern: /\bsk-ant-[A-Za-z0-9-_]{20,}/g, replacement: REDACTION_PLACEHOLDER },
  // JWTs (three base64url chunks separated by dots, length floor)
  { pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, replacement: REDACTION_PLACEHOLDER },
  // PEM-style private keys (one-liner heuristic)
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replacement: REDACTION_PLACEHOLDER },
];

/** True when the key (case-insensitive) matches a known secret pattern. */
function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((re) => re.test(key));
}

/** Apply value-side scrubbers to a string. Returns the same string when
 *  no pattern matched (preserves identity for short-circuit chains). */
export function redactStringValue(value: string): string {
  let out = value;
  for (const { pattern, replacement } of VALUE_SCRUBBERS) {
    if (pattern.test(out)) {
      // Each scrubber must reset its regex state if it's global.
      pattern.lastIndex = 0;
      out = out.replace(pattern, replacement);
    }
  }
  return out;
}

/**
 * Recursively redact a JSON-ish value. Returns a new structure; never
 * mutates the input. Handles primitives, arrays, plain records, and
 * preserves null. Circular references are not expected (RunRecord is
 * JSON-serializable) but are tolerated by tracking depth.
 */
export function redactPayload(
  value: unknown,
  depth = 0,
): unknown {
  if (depth > 32) return REDACTION_PLACEHOLDER;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactStringValue(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactPayload(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isSecretKey(key)) {
        out[key] = REDACTION_PLACEHOLDER;
      } else {
        out[key] = redactPayload(val, depth + 1);
      }
    }
    return out;
  }
  // Unknown primitive (bigint, symbol, function) — coerce to redacted
  // string rather than risk surfacing it.
  return REDACTION_PLACEHOLDER;
}

function redactToolCall(call: RunRecordToolCall): RunRecordToolCall {
  return {
    ...call,
    arguments: redactPayload(call.arguments) as Record<string, unknown>,
  };
}

function redactToolResult(result: RunRecordToolResult): RunRecordToolResult {
  return {
    ok: result.ok,
    ...(result.error_type !== undefined ? { error_type: result.error_type } : {}),
    payload: redactPayload(result.payload) as Record<string, unknown>,
  };
}

function redactRound(round: RunRecordRound): RunRecordRound {
  return {
    round: round.round,
    assistant_message: redactStringValue(round.assistant_message),
    tool_calls: round.tool_calls.map(redactToolCall),
    tool_results: round.tool_results.map(redactToolResult),
  };
}

/**
 * Apply redaction to a RunRecord. Returns a new record with
 * `redacted: true`. Idempotent — running this twice produces the same
 * output (no values left to scrub after the first pass).
 */
export function redactRunRecord(record: RunRecord): RunRecord {
  return {
    ...record,
    user_request: redactStringValue(record.user_request),
    runtime_config: redactPayload(record.runtime_config) as Record<string, unknown>,
    tool_schemas: record.tool_schemas.map(
      (schema) => redactPayload(schema) as Record<string, unknown>,
    ),
    rounds: record.rounds.map(redactRound),
    final_response: redactStringValue(record.final_response),
    redacted: true,
  };
}

export { REDACTION_PLACEHOLDER };
