/**
 * Workflow validation, persistence stripping, and staleness computation.
 *
 * `validateWorkflow()` is the build-time guarantee: before a workflow is
 * registered or launched, every structural invariant must hold. It catches
 * the kinds of mistakes the Builder UI would otherwise let a user ship
 * (duplicate stage IDs, dangling artifact references, binding paths into
 * nothing, cyclic dependencies).
 *
 * `computeStaleStageIds()` is the executor-time helper that, given a Run
 * and a set of artifact names that were just mutated (by a redo_item,
 * select_version, or jump_to_stage), returns the downstream stage IDs that
 * must be re-run. This is the staleness propagation that makes sogni-360's
 * per-segment regen + restitch work without a full rerun.
 *
 * `persistedRun()` / `persistedArtifact()` strip transient fields
 * (`progress`, `workerName`, `status`, `error`) before IndexedDB write.
 * Mirrors sogni-360's `getProjectForSaveComparison()` pattern.
 */

import { collectBindings, parseBinding, BindingError } from './bindings.js';
import type {
  Artifact,
  ArtifactItem,
  BatchStage,
  FixedStage,
  InteractiveStage,
  Run,
  ValidationIssue,
  ValidationResult,
  WorkflowStage,
  WorkflowTemplate,
} from './types.js';

// ---------------------------------------------------------------------------
// Workflow validation
// ---------------------------------------------------------------------------

export function validateWorkflow(def: WorkflowTemplate): ValidationResult {
  const issues: ValidationIssue[] = [];

  // ── Stage uniqueness ─────────────────────────────────────────────
  const stageIds = new Set<string>();
  for (const stage of walkStages(def.stages)) {
    if (stageIds.has(stage.id)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_stage_id',
        message: `Duplicate stage id: ${stage.id}`,
        path: `stages/${stage.id}`,
      });
    }
    stageIds.add(stage.id);
  }

  // ── Input name uniqueness ────────────────────────────────────────
  const inputNames = new Set<string>();
  for (const input of def.inputs) {
    if (inputNames.has(input.name)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_input_name',
        message: `Duplicate input name: ${input.name}`,
        path: `inputs/${input.name}`,
      });
    }
    inputNames.add(input.name);
  }

  // ── Artifact producer / consumer resolution ──────────────────────
  //
  // Build a "produces map": artifact name → index of the first stage that
  // produces it. Any `requiredArtifactsIn` entry must resolve to a stage
  // earlier in the flat stage order.
  const flatStages = Array.from(walkStages(def.stages));
  const producerIndex: Record<string, number> = {};
  flatStages.forEach((stage, idx) => {
    for (const name of stage.produces ?? []) {
      if (name in producerIndex) {
        issues.push({
          severity: 'warning',
          code: 'duplicate_artifact_producer',
          message: `Artifact "${name}" is produced by multiple stages. Downstream stages will see the last write.`,
          path: `stages/${stage.id}/produces`,
        });
      } else {
        producerIndex[name] = idx;
      }
    }
  });

  flatStages.forEach((stage, idx) => {
    for (const name of stage.requiredArtifactsIn ?? []) {
      if (!(name in producerIndex)) {
        issues.push({
          severity: 'error',
          code: 'missing_artifact_producer',
          message: `Stage "${stage.id}" requires artifact "${name}" but no earlier stage produces it.`,
          path: `stages/${stage.id}/requiredArtifactsIn`,
        });
        continue;
      }
      if (producerIndex[name] >= idx) {
        issues.push({
          severity: 'error',
          code: 'forward_artifact_reference',
          message: `Stage "${stage.id}" requires "${name}" but its producer runs later.`,
          path: `stages/${stage.id}/requiredArtifactsIn`,
        });
      }
    }
    for (const name of stage.optionalArtifactsIn ?? []) {
      if (!(name in producerIndex)) {
        issues.push({
          severity: 'warning',
          code: 'missing_optional_artifact',
          message: `Optional artifact "${name}" has no producer and will never be available.`,
          path: `stages/${stage.id}/optionalArtifactsIn`,
        });
      }
    }
  });

  // ── Binding structural check ─────────────────────────────────────
  for (const { stage, inBatchItem } of walkStageContexts(def.stages)) {
    const bindings = collectStageBindings(stage);
    for (const binding of bindings) {
      try {
        const parsed = parseBinding(binding);
        // Roots other than $item are always valid at parse time.
        // For $inputs and $artifacts we can do a name-level check.
        if (parsed.root === 'inputs') {
          const firstField = parsed.segments.find((s) => s.kind === 'field');
          if (firstField && firstField.kind === 'field' && !inputNames.has(firstField.name)) {
            issues.push({
              severity: 'error',
              code: 'unknown_input',
              message: `Binding "${binding}" references unknown input "${firstField.name}".`,
              path: `stages/${stage.id}/args`,
            });
          }
        }
        if (parsed.root === 'artifacts') {
          const firstField = parsed.segments.find((s) => s.kind === 'field');
          if (firstField && firstField.kind === 'field' && !(firstField.name in producerIndex)) {
            issues.push({
              severity: 'error',
              code: 'unknown_artifact',
              message: `Binding "${binding}" references unknown artifact "${firstField.name}".`,
              path: `stages/${stage.id}/args`,
            });
          }
        }
        if (parsed.root === 'item' && !inBatchItem && stage.type !== 'batch' && !stage.subStages?.length) {
          // $item is only meaningful inside a batch's itemStage. Detect
          // top-level misuse. (Nested subStages inside a batch are rare
          // but allowed; we can't verify deep nesting cheaply here.)
          issues.push({
            severity: 'error',
            code: 'item_binding_outside_batch',
            message: `Stage "${stage.id}" uses $item but is not inside a batch.`,
            path: `stages/${stage.id}/args`,
          });
        }
      } catch (err) {
        if (err instanceof BindingError) {
          issues.push({
            severity: 'error',
            code: 'invalid_binding_syntax',
            message: err.message,
            path: `stages/${stage.id}/args`,
          });
        } else {
          throw err;
        }
      }
    }
  }

  // ── Cycle detection ──────────────────────────────────────────────
  //
  // v1 is linear so ordering guarantees acyclicity, but `subStages` + a
  // producer/consumer graph could still introduce a cycle if someone
  // authors a weird tree. We build a directed dependency graph (stage
  // depends on stages that produce its required artifacts) and DFS it.
  const graph: Record<string, string[]> = {};
  for (const stage of flatStages) {
    graph[stage.id] = [];
    for (const name of [...(stage.requiredArtifactsIn ?? []), ...(stage.optionalArtifactsIn ?? [])]) {
      const producerIdx = producerIndex[name];
      if (producerIdx !== undefined) {
        const producerStage = flatStages[producerIdx];
        if (producerStage) graph[stage.id].push(producerStage.id);
      }
    }
  }
  const cycle = findCycle(graph);
  if (cycle) {
    issues.push({
      severity: 'error',
      code: 'cyclic_stage_dependency',
      message: `Cyclic artifact dependency detected: ${cycle.join(' → ')}`,
      path: `stages`,
    });
  }

  // ── Batch stage sanity ───────────────────────────────────────────
  for (const stage of flatStages) {
    if (stage.type === 'batch') {
      if (!stage.overBinding.startsWith('$')) {
        issues.push({
          severity: 'error',
          code: 'batch_over_binding_not_a_binding',
          message: `Batch stage "${stage.id}" overBinding must be a $... binding.`,
          path: `stages/${stage.id}/overBinding`,
        });
      }
      if (!stage.itemName) {
        issues.push({
          severity: 'error',
          code: 'batch_item_name_required',
          message: `Batch stage "${stage.id}" must declare itemName.`,
          path: `stages/${stage.id}/itemName`,
        });
      }
      if (stage.concurrency !== undefined && stage.concurrency < 1) {
        issues.push({
          severity: 'error',
          code: 'batch_concurrency_invalid',
          message: `Batch stage "${stage.id}" concurrency must be ≥ 1.`,
          path: `stages/${stage.id}/concurrency`,
        });
      }
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return { valid: !hasErrors, issues };
}

// ---------------------------------------------------------------------------
// Staleness propagation
// ---------------------------------------------------------------------------

/**
 * Given a Run and a set of artifact names whose contents just changed,
 * return the stage IDs whose inputs depend (transitively) on those
 * artifacts. Caller adds them to `run.staleStageIds` and the executor
 * re-runs them on resume.
 *
 * Walks forward from the earliest producer of any mutated artifact.
 */
export function computeStaleStageIds(
  run: Run,
  mutatedArtifactNames: string[],
): string[] {
  if (mutatedArtifactNames.length === 0) return [];

  const flat = Array.from(walkStages(run.workflowSnapshot.stages));
  const producerIndex: Record<string, number> = {};
  flat.forEach((stage, idx) => {
    for (const name of stage.produces ?? []) {
      if (!(name in producerIndex)) producerIndex[name] = idx;
    }
  });

  // Start the "live" set with the mutated names.
  const liveArtifacts = new Set<string>(mutatedArtifactNames);
  const stale = new Set<string>();

  // Earliest producer index across all mutated names — everything before
  // this index is untouched.
  let startIdx = Infinity;
  for (const name of mutatedArtifactNames) {
    const idx = producerIndex[name];
    if (idx !== undefined && idx < startIdx) startIdx = idx;
  }
  if (!Number.isFinite(startIdx)) return [];

  // Walk forward: any stage that consumes a live artifact becomes stale
  // AND its produced artifacts join the live set (cascade).
  for (let i = startIdx; i < flat.length; i++) {
    const stage = flat[i];
    const consumes = [
      ...(stage.requiredArtifactsIn ?? []),
      ...(stage.optionalArtifactsIn ?? []),
    ];
    const touchesLive = consumes.some((name) => liveArtifacts.has(name));
    if (touchesLive) {
      stale.add(stage.id);
      for (const name of stage.produces ?? []) liveArtifacts.add(name);
    }
  }

  return Array.from(stale);
}

// ---------------------------------------------------------------------------
// Persistence stripping (transient field removal)
// ---------------------------------------------------------------------------

const TRANSIENT_ITEM_FIELDS: readonly (keyof ArtifactItem)[] = [
  'status',
  'progress',
  'workerName',
  'error',
];

export function persistedArtifactItem(item: ArtifactItem): ArtifactItem {
  const clone = { ...item };
  for (const field of TRANSIENT_ITEM_FIELDS) {
    delete clone[field];
  }
  return clone;
}

export function persistedArtifact(artifact: Artifact): Artifact {
  return {
    ...artifact,
    items: artifact.items.map(persistedArtifactItem),
  };
}

export function persistedRun(run: Run): Run {
  const artifacts: Record<string, Artifact> = {};
  for (const [name, artifact] of Object.entries(run.artifacts)) {
    artifacts[name] = persistedArtifact(artifact);
  }
  // Downgrade any in-flight stage executions to 'pending' so a refreshed
  // tab resumes them cleanly instead of seeing a stale 'running' state.
  const stages = run.stages.map((s) =>
    s.state === 'running' ? { ...s, state: 'pending' as const } : s,
  );
  return { ...run, artifacts, stages };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Depth-first iteration over a stage tree including subStages. */
export function* walkStages(stages: WorkflowStage[]): Generator<WorkflowStage> {
  for (const stage of stages) {
    yield stage;
    if (stage.subStages?.length) {
      yield* walkStages(stage.subStages);
    }
    if (stage.type === 'batch') {
      yield stage.itemStage;
    }
  }
}

export function getFlatWorkflowStages(stages: WorkflowStage[]): WorkflowStage[] {
  return Array.from(walkStages(stages));
}

export function getCurrentRunStage(run: Run): WorkflowStage | undefined {
  return getFlatWorkflowStages(run.workflowSnapshot.stages)[run.currentStageIndex];
}

function* walkStageContexts(
  stages: WorkflowStage[],
  inBatchItem: boolean = false,
): Generator<{ stage: WorkflowStage; inBatchItem: boolean }> {
  for (const stage of stages) {
    yield { stage, inBatchItem };
    if (stage.subStages?.length) {
      yield* walkStageContexts(stage.subStages, inBatchItem);
    }
    if (stage.type === 'batch') {
      yield* walkStageContexts([stage.itemStage], true);
    }
  }
}

/** Gather every binding string referenced by a stage's args + child stages. */
function collectStageBindings(stage: WorkflowStage): string[] {
  const out: string[] = [];
  if (stage.type === 'fixed') {
    out.push(...collectBindings((stage as FixedStage).args));
  }
  if (stage.type === 'interactive') {
    // Interactive stages don't take args, but their systemPrompt and
    // userMessage may contain binding-like tokens — we skip those for v1
    // (no interpolation in v1), they're surfaced as plain strings.
    void (stage as InteractiveStage);
  }
  if (stage.type === 'batch') {
    const b = stage as BatchStage;
    out.push(b.overBinding);
    if (b.itemStage.type === 'fixed') {
      out.push(...collectBindings(b.itemStage.args));
    }
  }
  return out;
}

/**
 * Tarjan-free cycle detection via colored DFS. Returns the offending cycle
 * as an ordered id list, or null if the graph is acyclic.
 */
function findCycle(graph: Record<string, string[]>): string[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color: Record<string, number> = {};
  const parent: Record<string, string | null> = {};
  for (const id of Object.keys(graph)) color[id] = WHITE;

  for (const start of Object.keys(graph)) {
    if (color[start] !== WHITE) continue;
    const stack: string[] = [start];
    parent[start] = null;
    while (stack.length > 0) {
      const id = stack[stack.length - 1];
      if (color[id] === WHITE) color[id] = GRAY;
      let advanced = false;
      for (const next of graph[id] ?? []) {
        if (color[next] === WHITE) {
          parent[next] = id;
          stack.push(next);
          advanced = true;
          break;
        }
        if (color[next] === GRAY) {
          // Found a back-edge: reconstruct cycle.
          const cycle = [next, id];
          let p = parent[id];
          while (p && p !== next) {
            cycle.push(p);
            p = parent[p];
          }
          return cycle.reverse();
        }
      }
      if (!advanced) {
        color[id] = BLACK;
        stack.pop();
      }
    }
  }
  return null;
}
