/**
 * v2 artifact graph — typed nodes + lineage edges + pure structural
 * query helpers. See docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7 + §8.
 */

export {
  type ArtifactKind,
  type ArtifactRelation,
  type ArtifactVersionReason,
  type ArtifactSource,
  type ArtifactEdge,
  type ArtifactVersion,
  type ArtifactNode,
  type ArtifactGraph,
  type ArtifactGraphSerializable,
  isArtifactKind,
  isArtifactRelation,
  isArtifactVersionReason,
  isArtifactSource,
  isArtifactEdge,
  isArtifactVersion,
  isArtifactNode,
  createArtifactNode,
  addVersion,
  addParent,
  serializeGraph,
  deserializeGraph,
  validateArtifactNode,
} from './graph.js';

export {
  findByKind,
  findByLabel,
  walkLineage,
  findSiblings,
  resolveReference,
} from './queries.js';
