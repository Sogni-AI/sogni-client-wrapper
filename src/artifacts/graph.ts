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
  /** Format: `art_<uuid>`. Stable for the life of the artifact. */
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
 */
export interface ArtifactGraph {
  nodes: Map<string, ArtifactNode>;
  selectedId?: string;
}

/** JSON-transport shape of the graph; `nodes` flattened into an array. */
export interface ArtifactGraphSerializable {
  nodes: ArtifactNode[];
  selectedId?: string;
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

export function isArtifactNode(value: unknown): value is ArtifactNode {
  if (!isRecord(value)) return false;
  if (typeof value.artifactId !== 'string') return false;
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
