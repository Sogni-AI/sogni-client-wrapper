/**
 * ArtifactGraph — v2 in-memory graph of artifacts (image / video / audio /
 * text / workflow / collection) and their typed lineage. Lives in the
 * browser runner per session and is mirrored into durable run records so
 * resumed runs see the same lineage. Replaces the implicit
 * "first/last/selected" media context with explicit nodes + typed edges
 * that the planner and tool handlers can reason over.
 *
 * Plan: docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7 + §8.
 */

/** Coarse kind of an artifact. */
export type ArtifactKind = 'image' | 'video' | 'audio' | 'text' | 'workflow' | 'collection';

/**
 * Typed lineage relations. Every edge captures *how* a child artifact
 * derives from its parent so the planner can answer "what was the source
 * frame?" without re-inferring from English.
 */
export type ArtifactRelation =
  | 'derived_from'
  | 'edited_from'
  | 'styled_from'
  | 'animated_from'
  | 'stitched_from'
  | 'extended_from'
  | 'segmented_from'
  | 'reference_for';

/** Why a new version was added to an artifact. */
export type ArtifactVersionReason = 'initial' | 'retry' | 'refinement' | 'audit_repair' | 'user_redo';

/** Where an artifact originated. Discriminated union so consumers can switch on `type`. */
export type ArtifactSource =
  | { type: 'upload'; uploadId: string }
  | { type: 'tool_result'; runId?: string; toolCallId: string }
  | { type: 'workflow_stage'; workflowRunId: string; stageId: string; itemId?: string };

/** Directed edge from a child artifact to one of its parents. */
export interface ArtifactEdge {
  parentId: string;
  relation: ArtifactRelation;
}

/** One immutable version of an artifact. */
export interface ArtifactVersion {
  versionId: string;
  uri?: string;
  createdAt: string;
  reason: ArtifactVersionReason;
  jobId?: string;
}

/**
 * A node in the artifact graph. `artifactId` is stable across versions;
 * `modelRefs` carries per-model formatted handles (e.g. `@Image1` for
 * Seedance, `Image 1` for GPT-Image-2) so handlers don't reinvent the
 * per-model token format.
 */
export interface ArtifactNode {
  /**
   * Stable id for the life of the artifact. Two formats are accepted:
   *
   * 1. **ULID** (preferred, matches the canonical schema in
   *    `sogni-protocol-v2/schemas/artifacts/artifact-node.schema.json`):
   *    `art_<26-char Crockford base32>`, e.g. `art_01HZ...`.
   * 2. **UUID (no hyphens)** (legacy): `art_<32-char hex>`. All current
   *    consumer ID generators emit this form via
   *    `globalThis.crypto.randomUUID()` with hyphens stripped.
   *
   * The audit (2026-05-20) flagged that consumer IDs would fail the
   * ULID-only schema pattern. The validator here accepts both so live
   * IDs keep validating while consumers migrate to ULID. New code
   * SHOULD prefer ULID; the legacy pattern will tighten back to
   * ULID-only after consumers cut over.
   */
  artifactId: string;
  kind: ArtifactKind;
  uri?: string;
  mimeType?: string;
  userLabel?: string;
  /** Per-model handle. Key = model id; value = token the model expects. */
  modelRefs: Record<string, string>;
  source: ArtifactSource;
  parents: ArtifactEdge[];
  versions: ArtifactVersion[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * In-memory artifact graph. Uses `Map<string, ArtifactNode>` so insertion
 * order is preserved (matters for `resolveReference` integer lookup).
 * Query helpers live in `./queries.ts` to keep this type pure data.
 *
 * The optional `*NodeIds` arrays are **projection caches**: consumers
 * that need O(k) `projectImageUrls` / `projectVideoUrls` /
 * `projectAudioUrls` can maintain a per-kind id list rather than
 * walking `nodes.values()` every call. Canonical does NOT require them
 * — call sites SHOULD verify the cache is in sync (or rebuild from
 * `nodes` on each call) before trusting it. Promoted to canonical
 * 2026-05-21 so consumers stop stubbing the same caches locally.
 */
export interface ArtifactGraph {
  nodes: Map<string, ArtifactNode>;
  selectedId?: string;
  /** OPTIONAL projection cache for `kind === 'image'` nodes. */
  imageNodeIds?: string[];
  /** OPTIONAL projection cache for `kind === 'video'` nodes. */
  videoNodeIds?: string[];
  /** OPTIONAL projection cache for `kind === 'audio'` nodes. */
  audioNodeIds?: string[];
}

/**
 * JSON-transport shape of the graph; `nodes` flattened into an array.
 * Optional projection caches mirror {@link ArtifactGraph}.
 */
export interface ArtifactGraphSerializable {
  nodes: ArtifactNode[];
  selectedId?: string;
  imageNodeIds?: string[];
  videoNodeIds?: string[];
  audioNodeIds?: string[];
}

const ARTIFACT_KINDS: ReadonlySet<ArtifactKind> = new Set([
  'image',
  'video',
  'audio',
  'text',
  'workflow',
  'collection',
]);

const ARTIFACT_RELATIONS: ReadonlySet<ArtifactRelation> = new Set([
  'derived_from',
  'edited_from',
  'styled_from',
  'animated_from',
  'stitched_from',
  'extended_from',
  'segmented_from',
  'reference_for',
]);

const ARTIFACT_VERSION_REASONS: ReadonlySet<ArtifactVersionReason> = new Set([
  'initial',
  'retry',
  'refinement',
  'audit_repair',
  'user_redo',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isArtifactKind(value: unknown): value is ArtifactKind {
  return typeof value === 'string' && ARTIFACT_KINDS.has(value as ArtifactKind);
}

export function isArtifactRelation(value: unknown): value is ArtifactRelation {
  return typeof value === 'string' && ARTIFACT_RELATIONS.has(value as ArtifactRelation);
}

export function isArtifactVersionReason(value: unknown): value is ArtifactVersionReason {
  return typeof value === 'string' && ARTIFACT_VERSION_REASONS.has(value as ArtifactVersionReason);
}

export function isArtifactSource(value: unknown): value is ArtifactSource {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'upload':
      return typeof value.uploadId === 'string';
    case 'tool_result':
      if (typeof value.toolCallId !== 'string') return false;
      if (value.runId !== undefined && typeof value.runId !== 'string') return false;
      return true;
    case 'workflow_stage':
      if (typeof value.workflowRunId !== 'string') return false;
      if (typeof value.stageId !== 'string') return false;
      if (value.itemId !== undefined && typeof value.itemId !== 'string') return false;
      return true;
    default:
      return false;
  }
}

export function isArtifactEdge(value: unknown): value is ArtifactEdge {
  if (!isRecord(value)) return false;
  if (typeof value.parentId !== 'string') return false;
  if (!isArtifactRelation(value.relation)) return false;
  return true;
}

export function isArtifactVersion(value: unknown): value is ArtifactVersion {
  if (!isRecord(value)) return false;
  if (typeof value.versionId !== 'string') return false;
  if (value.uri !== undefined && typeof value.uri !== 'string') return false;
  if (typeof value.createdAt !== 'string') return false;
  if (!isArtifactVersionReason(value.reason)) return false;
  if (value.jobId !== undefined && typeof value.jobId !== 'string') return false;
  return true;
}

/**
 * ULID artifact id (preferred). Matches the canonical schema pattern
 * `^art_[A-Z0-9]{26}$` (Crockford base32 ULID body, 26 chars).
 */
const ULID_ARTIFACT_ID_PATTERN = /^art_[0-9A-Z]{26}$/;

/**
 * UUID-no-hyphens artifact id (legacy). Matches the form produced by
 * `globalThis.crypto.randomUUID().replace(/-/g, '')` plus the `art_`
 * prefix - 32 lowercase or uppercase hex chars.
 *
 * Loosened from ULID-only on 2026-05-20 so consumer IDs that haven't
 * migrated yet still validate. New code should target ULID.
 */
const UUID_NO_HYPHENS_ARTIFACT_ID_PATTERN = /^art_[0-9a-fA-F]{32}$/;

/**
 * UUID-with-hyphens artifact id (also legacy). Produced by callers that
 * never stripped the hyphens from `randomUUID()`. Accepted for the same
 * reason as the no-hyphens variant - existing IDs in the wild keep
 * validating while consumers migrate to ULID.
 */
const UUID_HYPHEN_ARTIFACT_ID_PATTERN =
  /^art_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * True when `value` is a string and matches one of the accepted
 * artifact-id patterns (ULID, UUID-no-hyphens, or UUID-with-hyphens).
 * Boundary code can call this directly when it doesn't have a full
 * `ArtifactNode` yet.
 */
export function isArtifactId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return (
    ULID_ARTIFACT_ID_PATTERN.test(value) ||
    UUID_NO_HYPHENS_ARTIFACT_ID_PATTERN.test(value) ||
    UUID_HYPHEN_ARTIFACT_ID_PATTERN.test(value)
  );
}

/**
 * Strict ULID validator. Use at write time when the caller wants to
 * enforce that newly-minted ids are ULID-form (the preferred shape per
 * the canonical schema). Read-side acceptance still flows through
 * {@link isArtifactId} so legacy UUID-form ids in the wild keep
 * validating.
 *
 * Promoted to canonical 2026-05-21 so consumers can flip producers to
 * ULID independently of readers, without inventing their own validator.
 */
export function preferUlid(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return ULID_ARTIFACT_ID_PATTERN.test(value);
}

/**
 * Crockford base32 alphabet used by ULID. Excludes I, L, O, U to avoid
 * visual ambiguity with 1 / 0 / V.
 */
const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Minimal subset of the Web Crypto API used by `generateUlidArtifactId`. */
interface MinimalCrypto {
  getRandomValues<T extends ArrayBufferView | null>(array: T): T;
}

let lastUlidTimestamp = -1;
let lastUlidRandomness: Uint8Array = new Uint8Array(10);

function encodeTimestamp(ms: number): string {
  let value = ms;
  const out = new Array<string>(10);
  for (let i = 9; i >= 0; i -= 1) {
    const mod = value % 32;
    out[i] = CROCKFORD_BASE32[mod] ?? '0';
    value = (value - mod) / 32;
  }
  return out.join('');
}

function getCryptoOrThrow(): MinimalCrypto {
  const cryptoRef = (globalThis as { crypto?: MinimalCrypto }).crypto;
  if (!cryptoRef || typeof cryptoRef.getRandomValues !== 'function') {
    throw new Error(
      'generateUlidArtifactId requires globalThis.crypto.getRandomValues (Node >= 18 / modern browsers). Refusing to silently fall back to Math.random.',
    );
  }
  return cryptoRef;
}

function incrementRandomnessMonotonic(buf: Uint8Array): Uint8Array {
  // Increment 80-bit randomness as big-endian integer, with overflow
  // protection. Matches the ULID monotonic specification: when called
  // twice in the same millisecond, the randomness must strictly
  // increase. If the byte already overflows, callers should advance
  // the timestamp by 1ms instead.
  const next = new Uint8Array(buf);
  for (let i = next.length - 1; i >= 0; i -= 1) {
    const current = next[i] ?? 0;
    if (current === 0xff) {
      next[i] = 0;
      continue;
    }
    next[i] = current + 1;
    return next;
  }
  // All bytes were 0xff — overflow. Caller advances timestamp instead.
  throw new Error('ULID monotonic randomness overflow; advance timestamp');
}

function encodeRandomness(bytes: Uint8Array): string {
  // 80 bits in 16 Crockford base32 characters. Manual 5-bit packing.
  const out = new Array<string>(16);
  let bitBuffer = 0;
  let bitCount = 0;
  let outIndex = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    bitBuffer = (bitBuffer << 8) | (bytes[i] ?? 0);
    bitCount += 8;
    while (bitCount >= 5) {
      bitCount -= 5;
      const idx = (bitBuffer >> bitCount) & 0x1f;
      out[outIndex] = CROCKFORD_BASE32[idx] ?? '0';
      outIndex += 1;
    }
  }
  if (bitCount > 0) {
    const idx = (bitBuffer << (5 - bitCount)) & 0x1f;
    out[outIndex] = CROCKFORD_BASE32[idx] ?? '0';
  }
  return out.join('');
}

/**
 * Generate a fresh ULID-form artifact id (`art_` + 26 char Crockford
 * base32 body). Uses `globalThis.crypto.getRandomValues` for the 80-bit
 * randomness component and throws (does NOT silently fall back to
 * `Math.random`) when crypto isn't available — silent-fallback would
 * give an attacker predictable ids in a degraded environment.
 *
 * When called multiple times within the same millisecond the randomness
 * is monotonically incremented per the ULID spec so newly-minted ids
 * remain lexicographically sortable.
 *
 * Promoted to canonical 2026-05-21 so consumers stop reimplementing
 * (and quietly diverging on) the ULID generator.
 */
export function generateUlidArtifactId(now?: number): string {
  const cryptoRef = getCryptoOrThrow();
  let timestamp = typeof now === 'number' && Number.isFinite(now) ? Math.floor(now) : Date.now();
  if (timestamp < 0) {
    throw new Error('generateUlidArtifactId requires a non-negative timestamp');
  }
  if (timestamp > 0xffffffffffff) {
    throw new Error('generateUlidArtifactId timestamp exceeds 48 bits');
  }

  let randomness: Uint8Array;
  if (timestamp === lastUlidTimestamp) {
    try {
      randomness = incrementRandomnessMonotonic(lastUlidRandomness);
    } catch {
      timestamp += 1;
      randomness = new Uint8Array(10);
      cryptoRef.getRandomValues(randomness);
    }
  } else {
    randomness = new Uint8Array(10);
    cryptoRef.getRandomValues(randomness);
  }

  lastUlidTimestamp = timestamp;
  lastUlidRandomness = randomness;

  return `art_${encodeTimestamp(timestamp)}${encodeRandomness(randomness)}`;
}

export function isArtifactNode(value: unknown): value is ArtifactNode {
  if (!isRecord(value)) return false;
  if (!isArtifactId(value.artifactId)) return false;
  if (!isArtifactKind(value.kind)) return false;
  if (value.uri !== undefined && typeof value.uri !== 'string') return false;
  if (value.mimeType !== undefined && typeof value.mimeType !== 'string') return false;
  if (value.userLabel !== undefined && typeof value.userLabel !== 'string') return false;
  if (!isRecord(value.modelRefs)) return false;
  for (const v of Object.values(value.modelRefs)) {
    if (typeof v !== 'string') return false;
  }
  if (!isArtifactSource(value.source)) return false;
  if (!Array.isArray(value.parents) || !value.parents.every(isArtifactEdge)) return false;
  if (!Array.isArray(value.versions) || !value.versions.every(isArtifactVersion)) return false;
  if (!isRecord(value.metadata)) return false;
  if (typeof value.createdAt !== 'string') return false;
  return true;
}

function randomId(prefix: string): string {
  const cryptoRef = globalThis.crypto;
  if (!cryptoRef || typeof cryptoRef.randomUUID !== 'function') {
    throw new Error('globalThis.crypto.randomUUID is required (Node >= 18 / modern browsers).');
  }
  return `${prefix}_${cryptoRef.randomUUID()}`;
}

/**
 * Construct a new `ArtifactNode`. Generates `art_<uuid>` via
 * `globalThis.crypto.randomUUID()`, defaults empty `versions`, `parents`,
 * `modelRefs`, `metadata`, and sets `createdAt` to `now ?? new Date().toISOString()`.
 */
export function createArtifactNode(input: {
  kind: ArtifactKind;
  source: ArtifactSource;
  uri?: string;
  mimeType?: string;
  userLabel?: string;
  modelRefs?: Record<string, string>;
  parents?: ArtifactEdge[];
  metadata?: Record<string, unknown>;
  now?: string;
}): ArtifactNode {
  const createdAt = input.now ?? new Date().toISOString();
  return {
    artifactId: randomId('art'),
    kind: input.kind,
    ...(input.uri !== undefined ? { uri: input.uri } : {}),
    ...(input.mimeType !== undefined ? { mimeType: input.mimeType } : {}),
    ...(input.userLabel !== undefined ? { userLabel: input.userLabel } : {}),
    modelRefs: input.modelRefs ? { ...input.modelRefs } : {},
    source: input.source,
    parents: input.parents ? [...input.parents] : [],
    versions: [],
    metadata: input.metadata ? { ...input.metadata } : {},
    createdAt,
  };
}

/**
 * Append a new immutable version to an artifact. Returns the same node
 * for chaining (mutation is intentional; callers expecting an immutable
 * graph should deep-clone before calling). Auto-generates `versionId` if
 * absent.
 */
export function addVersion(
  node: ArtifactNode,
  version: Omit<ArtifactVersion, 'versionId'> & { versionId?: string },
): ArtifactNode {
  const versionId = version.versionId ?? randomId('ver');
  const next: ArtifactVersion = {
    versionId,
    createdAt: version.createdAt,
    reason: version.reason,
    ...(version.uri !== undefined ? { uri: version.uri } : {}),
    ...(version.jobId !== undefined ? { jobId: version.jobId } : {}),
  };
  node.versions.push(next);
  return node;
}

/** Append a parent edge to a node. Returns the same node for chaining. */
export function addParent(node: ArtifactNode, edge: ArtifactEdge): ArtifactNode {
  node.parents.push({ parentId: edge.parentId, relation: edge.relation });
  return node;
}

/** Serialize an `ArtifactGraph` to the JSON-transport form. */
export function serializeGraph(graph: ArtifactGraph): ArtifactGraphSerializable {
  return {
    nodes: Array.from(graph.nodes.values()),
    ...(graph.selectedId !== undefined ? { selectedId: graph.selectedId } : {}),
    ...(graph.imageNodeIds !== undefined ? { imageNodeIds: [...graph.imageNodeIds] } : {}),
    ...(graph.videoNodeIds !== undefined ? { videoNodeIds: [...graph.videoNodeIds] } : {}),
    ...(graph.audioNodeIds !== undefined ? { audioNodeIds: [...graph.audioNodeIds] } : {}),
  };
}

/** Deserialize a JSON-transport graph back into the in-memory `Map` form. */
export function deserializeGraph(data: ArtifactGraphSerializable): ArtifactGraph {
  const nodes = new Map<string, ArtifactNode>();
  for (const node of data.nodes) {
    nodes.set(node.artifactId, node);
  }
  return {
    nodes,
    ...(data.selectedId !== undefined ? { selectedId: data.selectedId } : {}),
    ...(data.imageNodeIds !== undefined ? { imageNodeIds: [...data.imageNodeIds] } : {}),
    ...(data.videoNodeIds !== undefined ? { videoNodeIds: [...data.videoNodeIds] } : {}),
    ...(data.audioNodeIds !== undefined ? { audioNodeIds: [...data.audioNodeIds] } : {}),
  };
}

/**
 * Stub validator. Returns `{ valid: true, errors: [] }` while the public
 * API surface stabilizes; real Ajv/zod wiring lands when
 * `@sogni-ai/sogni-protocol` codegens the schema.
 */
export function validateArtifactNode(_value: unknown): { valid: boolean; errors: string[] } {
  return { valid: true, errors: [] };
}
