import { collectBindings, parseBinding, BindingError } from './bindings.js';
export function validateWorkflow(def) {
    const issues = [];
    const stageIds = new Set();
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
    const inputNames = new Set();
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
    const flatStages = Array.from(walkStages(def.stages));
    const producerIndex = {};
    flatStages.forEach((stage, idx) => {
        for (const name of stage.produces ?? []) {
            if (name in producerIndex) {
                issues.push({
                    severity: 'warning',
                    code: 'duplicate_artifact_producer',
                    message: `Artifact "${name}" is produced by multiple stages. Downstream stages will see the last write.`,
                    path: `stages/${stage.id}/produces`,
                });
            }
            else {
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
    for (const { stage, inBatchItem } of walkStageContexts(def.stages)) {
        const bindings = collectStageBindings(stage);
        for (const binding of bindings) {
            try {
                const parsed = parseBinding(binding);
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
                    issues.push({
                        severity: 'error',
                        code: 'item_binding_outside_batch',
                        message: `Stage "${stage.id}" uses $item but is not inside a batch.`,
                        path: `stages/${stage.id}/args`,
                    });
                }
            }
            catch (err) {
                if (err instanceof BindingError) {
                    issues.push({
                        severity: 'error',
                        code: 'invalid_binding_syntax',
                        message: err.message,
                        path: `stages/${stage.id}/args`,
                    });
                }
                else {
                    throw err;
                }
            }
        }
    }
    const graph = {};
    for (const stage of flatStages) {
        graph[stage.id] = [];
        for (const name of [...(stage.requiredArtifactsIn ?? []), ...(stage.optionalArtifactsIn ?? [])]) {
            const producerIdx = producerIndex[name];
            if (producerIdx !== undefined) {
                const producerStage = flatStages[producerIdx];
                if (producerStage)
                    graph[stage.id].push(producerStage.id);
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
export function computeStaleStageIds(run, mutatedArtifactNames) {
    if (mutatedArtifactNames.length === 0)
        return [];
    const flat = Array.from(walkStages(run.workflowSnapshot.stages));
    const producerIndex = {};
    flat.forEach((stage, idx) => {
        for (const name of stage.produces ?? []) {
            if (!(name in producerIndex))
                producerIndex[name] = idx;
        }
    });
    const liveArtifacts = new Set(mutatedArtifactNames);
    const stale = new Set();
    let startIdx = Infinity;
    for (const name of mutatedArtifactNames) {
        const idx = producerIndex[name];
        if (idx !== undefined && idx < startIdx)
            startIdx = idx;
    }
    if (!Number.isFinite(startIdx))
        return [];
    for (let i = startIdx; i < flat.length; i++) {
        const stage = flat[i];
        const consumes = [
            ...(stage.requiredArtifactsIn ?? []),
            ...(stage.optionalArtifactsIn ?? []),
        ];
        const touchesLive = consumes.some((name) => liveArtifacts.has(name));
        if (touchesLive) {
            stale.add(stage.id);
            for (const name of stage.produces ?? [])
                liveArtifacts.add(name);
        }
    }
    return Array.from(stale);
}
const TRANSIENT_ITEM_FIELDS = [
    'status',
    'progress',
    'workerName',
    'error',
];
export function persistedArtifactItem(item) {
    const clone = { ...item };
    for (const field of TRANSIENT_ITEM_FIELDS) {
        delete clone[field];
    }
    return clone;
}
export function persistedArtifact(artifact) {
    return {
        ...artifact,
        items: artifact.items.map(persistedArtifactItem),
    };
}
export function persistedRun(run) {
    const artifacts = {};
    for (const [name, artifact] of Object.entries(run.artifacts)) {
        artifacts[name] = persistedArtifact(artifact);
    }
    const stages = run.stages.map((s) => s.state === 'running' ? { ...s, state: 'pending' } : s);
    return { ...run, artifacts, stages };
}
export function* walkStages(stages) {
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
export function getFlatWorkflowStages(stages) {
    return Array.from(walkStages(stages));
}
export function getCurrentRunStage(run) {
    return getFlatWorkflowStages(run.workflowSnapshot.stages)[run.currentStageIndex];
}
function* walkStageContexts(stages, inBatchItem = false) {
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
function collectStageBindings(stage) {
    const out = [];
    if (stage.type === 'fixed') {
        out.push(...collectBindings(stage.args));
    }
    if (stage.type === 'interactive') {
        void stage;
    }
    if (stage.type === 'batch') {
        const b = stage;
        out.push(b.overBinding);
        if (b.itemStage.type === 'fixed') {
            out.push(...collectBindings(b.itemStage.args));
        }
    }
    return out;
}
function findCycle(graph) {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = {};
    const parent = {};
    for (const id of Object.keys(graph))
        color[id] = WHITE;
    for (const start of Object.keys(graph)) {
        if (color[start] !== WHITE)
            continue;
        const stack = [start];
        parent[start] = null;
        while (stack.length > 0) {
            const id = stack[stack.length - 1];
            if (color[id] === WHITE)
                color[id] = GRAY;
            let advanced = false;
            for (const next of graph[id] ?? []) {
                if (color[next] === WHITE) {
                    parent[next] = id;
                    stack.push(next);
                    advanced = true;
                    break;
                }
                if (color[next] === GRAY) {
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
//# sourceMappingURL=validation.js.map