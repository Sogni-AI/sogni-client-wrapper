/**
 * Canonical untrusted-input sanitizer for prompt interpolation.
 *
 * Two implementations were drifting in the v2 ecosystem before this
 * commit:
 *
 *  - `sogni-api-v2/src/service/wf-primitives.service.ts` stripped only
 *    C0 + DEL control chars but did NOT strip delimiter forgery — an
 *    attacker who wrote `</UNTRUSTED_USER_INPUT>...inject...` into a
 *    free-form field could break out of the untrusted block.
 *  - `sogni-creative-agent-v2/src/workflows/primitives/expandStoryboardScript.ts`
 *    stripped both control chars AND a vocabulary of chat-template /
 *    role markers / delimiter tags, but did not expose the helpers as a
 *    reusable module.
 *
 * This module publishes the strict union of both. Both consumers should
 * import from here and delete their local copies.
 *
 * Naming convention follows the rest of `workflows/primitives/*` — the
 * helpers are pure and stateless; LLM IO lives in the consumer.
 *
 * Audit follow-up: 2026-05-21.
 */

/**
 * Typed error thrown when `sanitizeUntrustedString` exceeds the
 * caller-supplied length cap. The message names the field + cap but
 * never echoes the offending content (so log scraping doesn't leak it).
 * Dispatchers SHOULD map this to a `WORKFLOW_VALIDATION_FAILED` envelope.
 */
export class SanitizerError extends Error {
  readonly code: 'input_too_long';
  readonly field?: string;
  readonly maxLength: number;
  readonly actualLength: number;

  constructor(args: {
    code: 'input_too_long';
    maxLength: number;
    actualLength: number;
    field?: string;
  }) {
    const fieldClause = args.field ? ` "${args.field}"` : '';
    super(
      `sanitizer: input${fieldClause} exceeds ${args.maxLength} characters (got ${args.actualLength})`,
    );
    this.name = 'SanitizerError';
    this.code = args.code;
    this.maxLength = args.maxLength;
    this.actualLength = args.actualLength;
    if (args.field !== undefined) {
      this.field = args.field;
    }
  }
}

/**
 * Untrusted-block delimiter tags this sanitizer knows about. Both the
 * `UNTRUSTED_USER_INPUT` form (used by sogni-api) and the
 * `UNTRUSTED_USER_BRIEF` form (used by sogni-creative-agent storyboard
 * expansion) are stripped so neither vocabulary can be forged from the
 * inside.
 */
const DELIMITER_PATTERNS: readonly RegExp[] = [
  /<UNTRUSTED_USER_INPUT(?:\s[^>]*)?>/gi,
  /<\/UNTRUSTED_USER_INPUT>/gi,
  /<UNTRUSTED_USER_BRIEF(?:\s[^>]*)?>/gi,
  /<\/UNTRUSTED_USER_BRIEF>/gi,
];

/**
 * Chat-template / role-marker tokens that have no legitimate place in
 * a user field. Same vocabulary as
 * `sogni-creative-agent-v2/src/workflows/primitives/expandStoryboardScript.ts`
 * keeps the two paths speaking the same hard-strip contract.
 */
const CHAT_TEMPLATE_PATTERNS: readonly RegExp[] = [
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /<\|user\|>/gi,
  /<\|system\|>/gi,
  /<\|assistant\|>/gi,
  /<\|tool\|>/gi,
  /<\|tool_call\|>/gi,
  /<\|begin▁of▁sentence\|>/gi,
  /<\|end▁of▁sentence\|>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<SYS>>/gi,
  /<<\/SYS>>/gi,
  /<system>[\s\S]*?<\/system>/gi,
  /<tool_call>[\s\S]*?<\/tool_call>/gi,
];

/**
 * Patterns the sanitizer ALWAYS strips, in order. Exposed as a frozen
 * tuple so consumers can audit the list (and add to it via a wrapper)
 * without re-importing the per-pattern arrays.
 *
 * Concatenation order: chat-template/role markers first (least
 * ambiguous), then delimiter forgeries. Control-char stripping happens
 * separately in `sanitizeUntrustedString` because it's a character-class
 * regex applied byte-by-byte, not a tag matcher.
 */
export const HARD_STRIP_PATTERNS: readonly RegExp[] = Object.freeze([
  ...CHAT_TEMPLATE_PATTERNS,
  ...DELIMITER_PATTERNS,
]);

// C0 control chars (0x00-0x1F) minus the whitespace ones we keep:
// \t (0x09), \n (0x0A), \r (0x0D). Plus DEL (0x7F). C1 chars
// (0x80-0x9F) excluded — they're routinely produced by legitimate
// non-Latin text encodings; if a caller wants to drop them too they
// can call a stricter wrapper.
//
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Options accepted by {@link sanitizeUntrustedString}.
 */
export interface SanitizeUntrustedStringOptions {
  /**
   * When `true` (default), strip delimiter-forgery tags so an attacker
   * can't close the untrusted block early. Set to `false` only when
   * the caller will wrap the string in a non-XML delimiter that
   * doesn't suffer from forgery (rare — leave default).
   */
  stripDelimiters?: boolean;
  /**
   * Maximum character length. When exceeded, throws
   * {@link SanitizerError} so the dispatcher can return a structured
   * `WORKFLOW_VALIDATION_FAILED` envelope. Length is checked AFTER
   * stripping so trailing forgery padding can't sneak past a length
   * gate.
   */
  maxLength?: number;
  /**
   * Optional field name. Surfaced in the {@link SanitizerError} message
   * so logs name which field tripped the cap, but never echoed.
   */
  field?: string;
}

/**
 * Strip C0 + DEL control chars (keep `\n \r \t`), strip chat-template /
 * role markers, and (by default) strip delimiter-forgery tags so an
 * attacker can't break out of `<UNTRUSTED_USER_INPUT>` / `<UNTRUSTED_USER_BRIEF>`.
 *
 * Returns the sanitized string. Throws {@link SanitizerError} when
 * `maxLength` is set and the post-strip length still exceeds it. Pure;
 * no regex routing decision is ever made off the output.
 */
export function sanitizeUntrustedString(
  input: string,
  opts?: SanitizeUntrustedStringOptions,
): string {
  if (typeof input !== 'string') {
    throw new TypeError('sanitizeUntrustedString: input must be a string');
  }
  const stripDelimiters = opts?.stripDelimiters ?? true;

  // Drop non-whitespace control bytes first so a delimiter pattern
  // can't be split across a stray \x01.
  let cleaned = input.replace(CONTROL_CHARS_RE, '');

  for (const pattern of CHAT_TEMPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  if (stripDelimiters) {
    for (const pattern of DELIMITER_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }
  }

  if (opts?.maxLength !== undefined && cleaned.length > opts.maxLength) {
    throw new SanitizerError({
      code: 'input_too_long',
      maxLength: opts.maxLength,
      actualLength: cleaned.length,
      ...(opts.field !== undefined ? { field: opts.field } : {}),
    });
  }

  return cleaned;
}

/**
 * XML-safe escape for an attribute value. Escapes `&`, `<`, `>`, `"`,
 * and `'` so a hostile field name (or value) can't break out of the
 * attribute. Caller passes the raw value; the result is suitable for
 * dropping into a double-quoted attribute. Pure.
 */
export function escapeAttribute(value: string): string {
  if (typeof value !== 'string') {
    throw new TypeError('escapeAttribute: value must be a string');
  }
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape XML content (text node). Only `&`, `<`, `>` need escaping
 * here; attribute-only quote escapes are unnecessary inside a text
 * node and would actively hurt readability for the LLM consumer.
 */
function escapeContent(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Wrap a sanitized content string in a canonical
 * `<UNTRUSTED_USER_INPUT field="...">...</UNTRUSTED_USER_INPUT>` block.
 *
 * - `field` is escaped via {@link escapeAttribute} so a hostile field
 *   name (e.g. `brief" onmouseover="..."`) can't inject extra
 *   attributes.
 * - `content` is escaped as XML text. The caller is expected to have
 *   already passed `content` through {@link sanitizeUntrustedString};
 *   double-stripping here would be redundant.
 *
 * Returns the formatted block string. Pure.
 */
export function wrapAsUntrustedUserInput(field: string, content: string): string {
  if (typeof field !== 'string' || field.length === 0) {
    throw new TypeError('wrapAsUntrustedUserInput: field must be a non-empty string');
  }
  if (typeof content !== 'string') {
    throw new TypeError('wrapAsUntrustedUserInput: content must be a string');
  }
  return `<UNTRUSTED_USER_INPUT field="${escapeAttribute(field)}">${escapeContent(content)}</UNTRUSTED_USER_INPUT>`;
}
