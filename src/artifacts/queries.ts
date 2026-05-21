/**
 * Pure structural read helpers over an `ArtifactGraph`. **No semantic
 * interpretation** — no English-keyword matching, no fuzzy lookup. These
 * helpers only walk the typed structure of the graph (kind, label,
 * lineage edges, insertion order) so that v2 routing decisions stay tied
 * to typed signals.
 *
 * Plan: docs/superpowers/plans/2026-05-20-sogni-chat-v2-execution-architecture-plan-final.md §7.
 */

import type { ArtifactGraph, ArtifactKind, ArtifactNode } from './graph.js';

/** All nodes of a given kind, in insertion order. */
export function findByKind(graph: ArtifactGraph, kind: ArtifactKind): ArtifactNode[] {
  const out: ArtifactNode[] = [];
  for (const node of graph.nodes.values()) {
    if (node.kind === kind) out.push(node);
  }
  return out;
}

/**
 * Nodes whose `userLabel` matches `label` exactly (case-sensitive). No
 * substring, no fuzzy match — labels are typed handles the user picked.
 */
export function findByLabel(graph: ArtifactGraph, label: string): ArtifactNode[] {
  const out: ArtifactNode[] = [];
  for (const node of graph.nodes.values()) {
    if (node.userLabel === label) out.push(node);
  }
  return out;
}

/**
 * Walk all ancestors of `artifactId` in BFS order. Cycle-safe (visited
 * set). The starting node is not included. Unknown ids return `[]`.
 */
export function walkLineage(graph: ArtifactGraph, artifactId: string): ArtifactNode[] {
  const start = graph.nodes.get(artifactId);
  if (!start) return [];
  const visited = new Set<string>([artifactId]);
  const queue: string[] = start.parents.map((edge) => edge.parentId);
  const out: ArtifactNode[] = [];
  while (queue.length > 0) {
    const next = queue.shift();
    if (next === undefined) break;
    if (visited.has(next)) continue;
    visited.add(next);
    const node = graph.nodes.get(next);
    if (!node) continue;
    out.push(node);
    for (const edge of node.parents) {
      if (!visited.has(edge.parentId)) queue.push(edge.parentId);
    }
  }
  return out;
}

/**
 * Nodes that share at least one `parents[].parentId` with `artifactId`,
 * excluding the target itself. Lets the planner ask "what else was
 * produced from the same source?" without scanning by label.
 */
export function findSiblings(graph: ArtifactGraph, artifactId: string): ArtifactNode[] {
  const target = graph.nodes.get(artifactId);
  if (!target || target.parents.length === 0) return [];
  const parentIds = new Set(target.parents.map((edge) => edge.parentId));
  const out: ArtifactNode[] = [];
  for (const node of graph.nodes.values()) {
    if (node.artifactId === artifactId) continue;
    if (node.parents.some((edge) => parentIds.has(edge.parentId))) {
      out.push(node);
    }
  }
  return out;
}

/**
 * Resolve a user reference string to a node. Accepted forms (no fuzzy
 * / substring / semantic match):
 *
 * 1. **Integer index** — `'1'`, `'2'`, … 1-based, into the insertion
 *    order of `graph.nodes`. Out-of-range returns `undefined`.
 * 2. **Exact `artifactId` match** — the full `art_<uuid>` value.
 * 3. **Exact `userLabel` match** — first node whose `userLabel === ref`.
 *
 * Returns `undefined` if no match is found.
 */
export function resolveReference(graph: ArtifactGraph, ref: string): ArtifactNode | undefined {
  if (typeof ref !== 'string' || ref.length === 0) return undefined;

  // 1. Integer index (1-based). Strictly numeric strings only.
  if (/^\d+$/.test(ref)) {
    const index = Number.parseInt(ref, 10);
    if (!Number.isFinite(index) || index < 1) return undefined;
    const nodes = Array.from(graph.nodes.values());
    if (index > nodes.length) return undefined;
    return nodes[index - 1];
  }

  // 2. Exact artifactId.
  const byId = graph.nodes.get(ref);
  if (byId) return byId;

  // 3. Exact userLabel.
  for (const node of graph.nodes.values()) {
    if (node.userLabel === ref) return node;
  }

  return undefined;
}
