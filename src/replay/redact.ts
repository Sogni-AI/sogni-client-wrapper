/**
 * Secret redaction for RunRecords.
 *
 * Shared best-effort credential filtering for replay writers and readers.
 * This is not anonymization: prompts, responses, and tool data remain
 * part of a replay. Callers must avoid including sensitive information.
 *
 * Pure function — no side effects, no I/O. Safe to run in hot paths.
 */

import type { RunRecord } from './types.js';

const REDACTION_PLACEHOLDER = '[REDACTED]';
const LABELLED_CREDENTIAL = /((?:\b|_)(?:api[ _-]?key|access[ _-]?token|refresh[ _-]?token|id[ _-]?token|password|secret|private[ _-]?key|signing[ _-]?key|token)["']?\s*(?::|=|\bis\b)\s*)("(?:[^"\\\r\n]|\\.)*"|'(?:[^'\\\r\n]|\\.)*'|`[^`\r\n]*`|[^\s"'`<>{}\[\],;&]+)/gi;

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
  /^credentials?$/i,
  /^(?:x-amz|x-goog)-(?:signature|credential|security-token)$/i,
  /^(?:signature|sig|key-pair-id)$/i,
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
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, replacement: `Bearer ${REDACTION_PLACEHOLDER}` },
  // Signed S3-style URLs: keep the host/path, drop the signature payload
  { pattern: /([?&](?:X-Amz-Signature|Signature|sig|Policy|Key-Pair-Id|X-Amz-Credential)=)[^&\s"']+/gi, replacement: `$1${REDACTION_PLACEHOLDER}` },
  // OpenAI / Anthropic style API keys
  { pattern: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g, replacement: REDACTION_PLACEHOLDER },
  // An incomplete private-key block is filtered through the end of the text.
  { pattern: /-----BEGIN [A-Z ]{0,64}PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]{0,64}PRIVATE KEY-----|$)/g, replacement: REDACTION_PLACEHOLDER },
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
    pattern.lastIndex = 0;
    out = out.replace(pattern, replacement);
  }
  // Consume each candidate once, including malformed ones, before checking
  // its segments. Repeated token prefixes must not trigger suffix rescans.
  out = out.replace(/\beyJ[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+)*/g, (candidate) => {
    const segments = candidate.split('.');
    return segments.length >= 3 && segments[1].length >= 10 && segments[2].length >= 10
      ? REDACTION_PLACEHOLDER : candidate;
  });
  // UUIDs alone are also ordinary run/job ids. Filter labelled values,
  // preserving quotes around embedded JSON and configuration values.
  return out.replace(LABELLED_CREDENTIAL, (_match, prefix: string, credential: string) => {
    const quote = /^["'`]/.test(credential) ? credential[0] : '';
    return `${prefix}${quote}${REDACTION_PLACEHOLDER}${quote}`;
  });
}

/**
 * Recursively redact a JSON-ish value. Returns a new structure; never
 * mutates the input. Handles primitives, arrays, plain records, and
 * preserves null. Circular references are not expected (RunRecord is
 * JSON-serializable) are filtered without revisiting an ancestor.
 */
export function redactPayload(
  value: unknown,
  depth = 0,
): unknown {
  return redactValue(value, depth, new WeakSet<object>());
}

function redactValue(value: unknown, depth: number, ancestors: WeakSet<object>): unknown {
  if (depth > 32) return REDACTION_PLACEHOLDER;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactStringValue(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    if (ancestors.has(value)) return REDACTION_PLACEHOLDER;
    ancestors.add(value);
    try {
      if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1, ancestors));
      // fromEntries creates own data properties even for __proto__.
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(
        ([key, val]) => [key, isSecretKey(key) ? REDACTION_PLACEHOLDER : redactValue(val, depth + 1, ancestors)],
      ));
    } finally {
      ancestors.delete(value);
    }
  }
  // Unknown primitive (bigint, symbol, function) — coerce to redacted
  // string rather than risk surfacing it.
  return REDACTION_PLACEHOLDER;
}

/**
 * Apply redaction to a RunRecord. Returns a new record with
 * `redacted: true`. Idempotent — running this twice produces the same
 * output (no values left to scrub after the first pass).
 */
export function redactRunRecord(record: RunRecord): RunRecord {
  return {
    ...redactPayload(record) as RunRecord,
    redacted: true,
  };
}

export { REDACTION_PLACEHOLDER };
