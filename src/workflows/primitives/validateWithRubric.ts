/**
 * Pure helpers for the validate_with_rubric primitive.
 *
 * The primitive runs an LLM judge over an artifact (text or image) and
 * a list of rubric items. It returns ToolErr when validation fails, so
 * a workflow stage with `condition: { type: 'if_error_in', stageId:
 * 'validate_X' }` will fire on failure and re-run the prior render
 * stage with the judge's feedback baked into its prompt.
 *
 * This file is pure — no LLM calls — so a regression can pin the
 * rubric-prompt construction and the PASS/FAIL parsing without
 * spinning up a model.
 */

export interface ValidateRubricInput {
  /** Free-text criteria, one per line. Each becomes a separate gate. */
  rubric: readonly string[];
  /** What is being validated. Used for prompt framing. */
  artifactKind: 'text' | 'image' | 'video';
  /**
   * The artifact contents inline (for text) or a public URL (for
   * image / video — the LLM judge fetches the URL).
   */
  artifactInline?: string;
  artifactUrl?: string;
  /** Optional human-facing description of what good output looks like. */
  successDescription?: string;
}

export interface RubricJudgement {
  pass: boolean;
  failedCriteria: string[];
  notes: string;
  /** Suggested guidance for the retry render stage. */
  suggestedRetryNotes: string;
}

const PASS_TOKEN = '__PASS__';
const FAIL_TOKEN = '__FAIL__';

/**
 * Build the system + user prompt the judge LLM will see. The judge is
 * forced to emit either `__PASS__` or `__FAIL__: <reasons>` so the
 * parser can deterministically classify the output.
 */
export function buildRubricPrompts(input: ValidateRubricInput): {
  system: string;
  user: string;
} {
  const successLine = input.successDescription
    ? `Good output looks like: ${input.successDescription}`
    : 'Good output satisfies every rubric item completely.';
  const rubricList = input.rubric
    .map((line, i) => `${i + 1}. ${line.trim()}`)
    .join('\n');

  const system = [
    `You are a strict creative quality judge for ${input.artifactKind} artifacts.`,
    successLine,
    'Evaluate the artifact against EACH rubric item one at a time.',
    `If ALL items pass, your ENTIRE response must be exactly: ${PASS_TOKEN}`,
    `Otherwise, your ENTIRE response must start with: ${FAIL_TOKEN}: `,
    'followed by a short comma-separated list of the failed item numbers and',
    'a one-sentence summary of what the next render attempt should change.',
    `Example fail response: ${FAIL_TOKEN}: items 1, 3 — subject identity is `
    + 'inconsistent across panels; next attempt must lock the face shape from '
    + 'the reference photo.',
    'Do not output anything else. No preamble. No analysis.',
  ].join('\n');

  const artifactBlock = input.artifactKind === 'text'
    ? `<text-artifact>\n${(input.artifactInline ?? '').trim()}\n</text-artifact>`
    : input.artifactUrl
      ? `<${input.artifactKind}-artifact src="${input.artifactUrl}"/>`
      : '<artifact missing/>';

  const user = [
    'Rubric:',
    rubricList,
    '',
    'Artifact to evaluate:',
    artifactBlock,
  ].join('\n');

  return { system, user };
}

/**
 * Parse the judge's response. Returns a structured RubricJudgement.
 * Recognises a leading `__PASS__` or `__FAIL__: …` and falls back to a
 * loose contains-check so a slightly chatty model doesn't break the
 * gate. Items mentioned by number in a fail response are mapped back
 * to rubric strings.
 */
export function parseJudgeResponse(
  raw: string,
  rubric: readonly string[],
): RubricJudgement {
  const cleaned = (raw ?? '').trim();
  if (cleaned.startsWith(PASS_TOKEN)) {
    return { pass: true, failedCriteria: [], notes: cleaned, suggestedRetryNotes: '' };
  }
  if (cleaned.startsWith(FAIL_TOKEN)) {
    const afterToken = cleaned.slice(FAIL_TOKEN.length).replace(/^\s*:?\s*/, '');
    return {
      pass: false,
      failedCriteria: extractFailedCriteria(afterToken, rubric),
      notes: afterToken,
      suggestedRetryNotes: afterToken,
    };
  }
  // Fallback: loose checks. A response that contains __PASS__ but also
  // some commentary still counts as a pass. Anything else is fail.
  if (cleaned.includes(PASS_TOKEN) && !cleaned.includes(FAIL_TOKEN)) {
    return { pass: true, failedCriteria: [], notes: cleaned, suggestedRetryNotes: '' };
  }
  return {
    pass: false,
    failedCriteria: extractFailedCriteria(cleaned, rubric),
    notes: cleaned || 'Judge returned an empty or unparseable response.',
    suggestedRetryNotes: cleaned || 'Re-render with more attention to the rubric items above.',
  };
}

function extractFailedCriteria(text: string, rubric: readonly string[]): string[] {
  const matches: string[] = [];
  const numberRegex = /\bitems?\s+([\d,\s]+)/i;
  const m = text.match(numberRegex);
  if (m) {
    const nums = m[1]
      .split(',')
      .map((s) => s.trim())
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= rubric.length);
    for (const n of nums) matches.push(rubric[n - 1]);
  }
  return matches;
}

export { PASS_TOKEN, FAIL_TOKEN };

// ---------------------------------------------------------------------------
// SSRF guard for artifactUrl
// ---------------------------------------------------------------------------

/**
 * Allow-list check for the `artifactUrl` argument of `wf:validate_with_rubric`
 * (and any future primitive that fetches a remote artifact for vision /
 * audio judgement). Returns `{ ok: false, reason }` for anything that
 * could initiate a server-side request to internal / link-local /
 * loopback addresses.
 *
 * Why this lives in the shared package: durable (server-side) runs of a
 * workflow template that uses `wf:validate_with_rubric` will fetch the
 * supplied URL from the api host. Template authors are arbitrary end
 * users; without this guard a malicious template could probe the cloud
 * metadata service (`169.254.169.254`), private VPC services, or
 * internal admin endpoints. The chat frontend runs in the user's own
 * browser so the SSRF risk is lower there — but the same allow-list
 * defends against accidental misuse and keeps every frontend on one
 * policy.
 *
 * Pure: no IO, only string + regex inspection.
 */
export function assertArtifactUrlIsSafe(
  url: string,
): { ok: true } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'artifactUrl is not a valid URL' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      ok: false,
      reason: `artifactUrl protocol "${parsed.protocol}" is not supported (http/https only)`,
    };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'artifactUrl must not contain userinfo credentials' };
  }
  const host = parsed.hostname.toLowerCase();
  if (!host) return { ok: false, reason: 'artifactUrl host is empty' };

  // URL parsers sometimes leave IPv6 hosts wrapped in brackets — strip
  // before pattern matching.
  const bareHost =
    host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

  const loopback = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::', '::1']);
  if (loopback.has(bareHost)) {
    return { ok: false, reason: `artifactUrl host "${bareHost}" is a loopback address` };
  }
  if (bareHost.endsWith('.localhost') || bareHost.endsWith('.local')) {
    return {
      ok: false,
      reason: `artifactUrl host "${bareHost}" is on a local network suffix`,
    };
  }
  // IPv4-mapped (::ffff:0:0/96, including ::ffff:a.b.c.d → ::ffff:hhhh:hhhh
  // after URL canonicalization) and NAT64 (64:ff9b::/96) IPv6 addresses route
  // to their embedded IPv4 destination at the socket layer on Linux, bypassing
  // the dotted-quad IPv4 checks below. Reject them outright.
  if (/^(::ffff:|64:ff9b:)/i.test(bareHost)) {
    return {
      ok: false,
      reason: `artifactUrl host "${bareHost}" is an IPv4-embedded IPv6 address`,
    };
  }
  if (PRIVATE_IPV4_PATTERNS.some((re) => re.test(bareHost))) {
    return {
      ok: false,
      reason: `artifactUrl host "${bareHost}" is in a private/link-local IPv4 range`,
    };
  }
  if (PRIVATE_IPV6_PATTERNS.some((re) => re.test(bareHost))) {
    return {
      ok: false,
      reason: `artifactUrl host "${bareHost}" is in a private/link-local IPv6 range`,
    };
  }
  return { ok: true };
}

const PRIVATE_IPV4_PATTERNS: readonly RegExp[] = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/, // link-local incl. cloud metadata 169.254.169.254
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
];

const PRIVATE_IPV6_PATTERNS: readonly RegExp[] = [
  /^fe80::/i,         // link-local
  /^fc00:/i,          // unique local
  /^fd[0-9a-f]{2}:/i, // unique local
];
