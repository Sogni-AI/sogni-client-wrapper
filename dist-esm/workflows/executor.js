import { resolveBindings } from './bindings.js';
import { computeStaleStageIds, persistedRun, walkStages } from './validation.js';
export async function* executeRun(runId, options) {
    const loaded = await options.store.get(runId);
    if (!loaded) {
        throw new Error(`[WORKFLOW EXECUTOR] Run not found: ${runId}`);
    }
    let run = { ...loaded, state: 'running', updatedAt: Date.now() };
    await options.store.save(run);
    yield { type: 'run_started', run };
    const flat = Array.from(walkStages(run.workflowSnapshot.stages));
    const indexOf = new Map(flat.map((s, i) => [s.id, i]));
    try {
        while (run.currentStageIndex < flat.length) {
            if (options.signal?.aborted) {
                run = await mutateRun(run, { state: 'canceled' }, options.store);
                yield { type: 'run_paused', run };
                return run;
            }
            const stage = flat[run.currentStageIndex];
            const stageExec = ensureStageExec(run, stage.id);
            if (stageExec.state === 'completed' && !run.staleStageIds.includes(stage.id)) {
                run = await mutateRun(run, { currentStageIndex: run.currentStageIndex + 1 }, options.store);
                continue;
            }
            if (run.staleStageIds.includes(stage.id)) {
                run = await mutateRun(run, {
                    staleStageIds: run.staleStageIds.filter((id) => id !== stage.id),
                }, options.store);
            }
            yield { type: 'stage_started', stageIndex: run.currentStageIndex, stage };
            try {
                if (stage.type === 'fixed') {
                    run = yield* runFixedStage(run, stage, options);
                }
                else if (stage.type === 'batch') {
                    run = yield* runBatchStage(run, stage, options);
                }
                else if (stage.type === 'interactive') {
                    run = yield* runInteractiveStage(run, stage, options);
                }
            }
            catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                run = await mutateRun(run, {
                    state: 'failed',
                    stages: setStageState(run.stages, stage.id, {
                        state: 'failed',
                        error: error.message,
                        completedAt: Date.now(),
                    }),
                }, options.store);
                yield { type: 'stage_item_failed', stageIndex: run.currentStageIndex, itemId: stage.id, error: error.message };
                yield { type: 'run_failed', error, run };
                return run;
            }
            yield { type: 'stage_completed', stageIndex: run.currentStageIndex };
            if (stage.checkpointRequired) {
                yield {
                    type: 'stage_awaiting_checkpoint',
                    stageIndex: run.currentStageIndex,
                    reviewFocus: stage.reviewFocus,
                };
                const resume = yield* awaitResume();
                const handled = yield* handleResumeInput(run, resume, stage.id, indexOf, options.store);
                run = handled.run;
                if (handled.stop)
                    return run;
                if (handled.retry)
                    continue;
            }
            run = await mutateRun(run, { currentStageIndex: run.currentStageIndex + 1 }, options.store);
        }
        run = await mutateRun(run, { state: 'completed' }, options.store);
        yield { type: 'run_completed', run };
        return run;
    }
    catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        run = await mutateRun(run, { state: 'failed' }, options.store);
        yield { type: 'run_failed', error, run };
        return run;
    }
}
async function* runFixedStage(run, stage, options) {
    let currentRun = await mutateRun(run, {
        stages: setStageState(run.stages, stage.id, {
            state: 'running',
            startedAt: Date.now(),
        }),
    }, options.store);
    const ctx = makeBindingContext(currentRun);
    const resolvedArgs = resolveBindings(stage.args, ctx);
    const itemId = `${stage.id}/main`;
    yield { type: 'stage_item_started', stageIndex: currentRun.currentStageIndex, itemId, index: 0 };
    const wrappedCallbacks = wrapCallbacks(options.callbacks, (p) => {
        void p;
    });
    const rawResult = await options.dispatch.execute(stage.tool, resolvedArgs, options.context, wrappedCallbacks);
    const failureMessage = parseToolErrorMessage(rawResult);
    if (failureMessage) {
        throw new Error(`[${stage.tool}] ${failureMessage}`);
    }
    const version = versionFromToolResult(rawResult, stage.id, stage.tool, resolvedArgs);
    const producedArtifactName = stage.produces?.[0];
    if (producedArtifactName) {
        currentRun = upsertArtifactItem(currentRun, producedArtifactName, artifactKindForTool(stage.tool), {
            id: itemId,
            versions: [version],
            selectedVersionId: version.id,
        });
    }
    currentRun = await mutateRun(currentRun, {
        stages: setStageState(currentRun.stages, stage.id, {
            state: 'completed',
            completedAt: Date.now(),
        }),
    }, options.store);
    yield {
        type: 'stage_item_completed',
        stageIndex: currentRun.currentStageIndex,
        itemId,
        version,
    };
    return currentRun;
}
async function* runBatchStage(run, stage, options) {
    let currentRun = await mutateRun(run, {
        stages: setStageState(run.stages, stage.id, {
            state: 'running',
            startedAt: Date.now(),
        }),
    }, options.store);
    const ctx = makeBindingContext(currentRun);
    const items = resolveBindings(stage.overBinding, ctx);
    if (!Array.isArray(items)) {
        throw new Error(`[WORKFLOW EXECUTOR] Batch stage "${stage.id}" overBinding did not resolve to an array`);
    }
    const producedArtifactName = stage.produces?.[0];
    if (!producedArtifactName) {
        throw new Error(`[WORKFLOW EXECUTOR] Batch stage "${stage.id}" must declare `
            + `a produced artifact name via \`produces\``);
    }
    const existing = currentRun.artifacts[producedArtifactName];
    const existingItemById = {};
    if (existing)
        for (const it of existing.items)
            existingItemById[it.id] = it;
    const itemIds = items.map((_, idx) => `${stage.id}/${idx}`);
    for (let i = 0; i < items.length; i++) {
        const itemId = itemIds[i];
        if (!existingItemById[itemId]) {
            currentRun = upsertArtifactItem(currentRun, producedArtifactName, artifactKindForTool(stage.itemStage.type === 'fixed' ? stage.itemStage.tool : 'generate_image'), {
                id: itemId,
                label: batchItemLabel(stage, i, items[i]),
                versions: [],
                selectedVersionId: '',
                metadata: typeof items[i] === 'object' && items[i] !== null ? items[i] : undefined,
            });
        }
    }
    const indicesToRun = [];
    for (let i = 0; i < items.length; i++) {
        const itemId = itemIds[i];
        const currentItem = currentRun.artifacts[producedArtifactName]?.items.find((it) => it.id === itemId);
        if (!currentItem)
            continue;
        if (currentItem.locked && currentItem.versions.length > 0)
            continue;
        if (currentItem.versions.length === 0)
            indicesToRun.push(i);
    }
    if (indicesToRun.length === 0) {
        currentRun = await mutateRun(currentRun, {
            stages: setStageState(currentRun.stages, stage.id, {
                state: 'completed',
                completedAt: Date.now(),
            }),
        }, options.store);
        return currentRun;
    }
    if (stage.itemStage.type !== 'fixed') {
        throw new Error(`[WORKFLOW EXECUTOR] Batch itemStage of type "${stage.itemStage.type}" `
            + `is not yet supported. Only fixed itemStages work in M3.`);
    }
    for (const idx of indicesToRun) {
        if (options.signal?.aborted)
            break;
        const itemId = itemIds[idx];
        const item = items[idx];
        yield { type: 'stage_item_started', stageIndex: currentRun.currentStageIndex, itemId, index: idx };
        const itemCtx = {
            ...makeBindingContext(currentRun),
            item: { ...(typeof item === 'object' && item !== null ? item : { value: item }), index: idx },
        };
        const resolvedArgs = resolveBindings(stage.itemStage.args, itemCtx);
        const wrappedCallbacks = wrapCallbacks(options.callbacks, () => { });
        try {
            const rawResult = await options.dispatch.execute(stage.itemStage.tool, resolvedArgs, options.context, wrappedCallbacks);
            const failureMessage = parseToolErrorMessage(rawResult);
            if (failureMessage) {
                throw new Error(`[${stage.itemStage.tool}] ${failureMessage}`);
            }
            const version = versionFromToolResult(rawResult, stage.id, stage.itemStage.tool, resolvedArgs);
            currentRun = appendVersionToItem(currentRun, producedArtifactName, itemId, version);
            yield { type: 'stage_item_completed', stageIndex: currentRun.currentStageIndex, itemId, version };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            yield { type: 'stage_item_failed', stageIndex: currentRun.currentStageIndex, itemId, error: message };
            if (stage.onError === 'continue' || stage.onError === 'skip')
                continue;
            throw err;
        }
    }
    currentRun = await mutateRun(currentRun, {
        stages: setStageState(currentRun.stages, stage.id, {
            state: 'completed',
            completedAt: Date.now(),
        }),
    }, options.store);
    return currentRun;
}
async function* runInteractiveStage(run, stage, options) {
    let currentRun = await mutateRun(run, {
        state: 'awaiting_input',
        stages: setStageState(run.stages, stage.id, {
            state: 'running',
            startedAt: Date.now(),
        }),
    }, options.store);
    yield { type: 'stage_awaiting_interactive', stageIndex: currentRun.currentStageIndex, stage };
    const resume = yield* awaitResume();
    if (!resume || resume.type !== 'interactive_complete') {
        if (resume && resume.type === 'cancel') {
            currentRun = await mutateRun(currentRun, { state: 'canceled' }, options.store);
            return currentRun;
        }
        throw new Error(`[WORKFLOW EXECUTOR] Interactive stage "${stage.id}" expected `
            + `interactive_complete but got ${resume?.type ?? 'undefined'}`);
    }
    if (resume.producedArtifacts) {
        const merged = { ...currentRun.artifacts };
        for (const [name, artifact] of Object.entries(resume.producedArtifacts)) {
            merged[name] = artifact;
        }
        currentRun = await mutateRun(currentRun, { artifacts: merged }, options.store);
    }
    currentRun = await mutateRun(currentRun, {
        state: 'running',
        stages: setStageState(currentRun.stages, stage.id, {
            state: 'completed',
            completedAt: Date.now(),
        }),
    }, options.store);
    return currentRun;
}
function* awaitResume() {
    const input = yield { type: 'run_paused', run: null };
    return input;
}
async function* handleResumeInput(run, resume, currentStageId, indexOf, store) {
    if (!resume || resume.type === 'approve_checkpoint') {
        return { run, stop: false, retry: false };
    }
    if (resume.type === 'cancel') {
        const updated = await mutateRun(run, { state: 'canceled' }, store);
        return { run: updated, stop: true, retry: false };
    }
    if (resume.type === 'lock_item') {
        const updated = await mutateRun(run, {
            artifacts: withLockedItem(run.artifacts, resume.artifactName, resume.itemId, resume.locked),
        }, store);
        return { run: updated, stop: false, retry: false };
    }
    if (resume.type === 'select_version') {
        const updated = await mutateRun(run, {
            artifacts: withSelectedVersion(run.artifacts, resume.artifactName, resume.itemId, resume.versionId),
            staleStageIds: Array.from(new Set([
                ...run.staleStageIds,
                ...computeStaleStageIds(run, [resume.artifactName]),
            ])),
        }, store);
        return { run: updated, stop: false, retry: true };
    }
    if (resume.type === 'jump_to_stage') {
        const target = indexOf.get(resume.stageId);
        if (target === undefined) {
            throw new Error(`[WORKFLOW EXECUTOR] jump_to_stage references unknown stage "${resume.stageId}"`);
        }
        const updated = await mutateRun(run, {
            currentStageIndex: target,
            staleStageIds: Array.from(new Set([...run.staleStageIds, currentStageId])),
        }, store);
        return { run: updated, stop: false, retry: true };
    }
    if (resume.type === 'redo_item') {
        const updated = await mutateRun(run, {
            artifacts: clearItemVersionsForRedo(run.artifacts, resume.artifactName, resume.itemId),
            staleStageIds: Array.from(new Set([
                ...run.staleStageIds,
                currentStageId,
                ...computeStaleStageIds(run, [resume.artifactName]),
            ])),
        }, store);
        return { run: updated, stop: false, retry: true };
    }
    if (resume.type === 'redo_stage') {
        const updated = await mutateRun(run, {
            staleStageIds: Array.from(new Set([...run.staleStageIds, resume.stageId])),
        }, store);
        return { run: updated, stop: false, retry: true };
    }
    return { run, stop: false, retry: false };
}
function makeBindingContext(run) {
    return {
        inputs: run.inputs,
        artifacts: run.artifacts,
        run: { id: run.id, state: run.state },
    };
}
function parseToolErrorMessage(rawResult) {
    let parsed;
    try {
        parsed = JSON.parse(rawResult);
    }
    catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object')
        return null;
    const payload = parsed;
    const isErr = payload.ok === false
        || payload.success === false
        || (typeof payload.error === 'string' && payload.error.length > 0);
    if (!isErr)
        return null;
    if (typeof payload.message === 'string' && payload.message.length > 0)
        return payload.message;
    if (typeof payload.error === 'string' && payload.error.length > 0)
        return payload.error;
    if (typeof payload.error_type === 'string' && payload.error_type.length > 0)
        return payload.error_type;
    return 'tool returned an error envelope';
}
function versionFromToolResult(rawResult, stageId, tool, args) {
    let url;
    let content;
    try {
        const parsed = JSON.parse(rawResult);
        const resultUrls = parsed.resultUrls;
        const videoUrls = parsed.videoResultUrls;
        const audioUrls = parsed.audioResultUrls;
        if (Array.isArray(videoUrls) && videoUrls.length > 0 && typeof videoUrls[0] === 'string') {
            url = videoUrls[0];
        }
        else if (Array.isArray(resultUrls) && resultUrls.length > 0 && typeof resultUrls[0] === 'string') {
            url = resultUrls[0];
        }
        else if (Array.isArray(audioUrls) && audioUrls.length > 0 && typeof audioUrls[0] === 'string') {
            url = audioUrls[0];
        }
        else {
            content = rawResult;
        }
    }
    catch {
        content = rawResult;
    }
    return {
        id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        url,
        content,
        generatedBy: { stageId, tool, args },
    };
}
function artifactKindForTool(tool) {
    if (tool === 'animate_photo' || tool === 'generate_video' || tool === 'sound_to_video'
        || tool === 'video_to_video' || tool === 'stitch_video' || tool === 'orbit_video'
        || tool === 'dance_montage')
        return 'video';
    if (tool === 'generate_music')
        return 'audio';
    if (tool === 'analyze_image' || tool === 'extract_metadata')
        return 'text';
    return 'image';
}
function upsertArtifactItem(run, name, kind, item) {
    const existing = run.artifacts[name];
    let nextArtifact;
    if (!existing) {
        nextArtifact = { name, kind, items: [item] };
    }
    else {
        const idx = existing.items.findIndex((it) => it.id === item.id);
        const items = idx === -1
            ? [...existing.items, item]
            : existing.items.map((it, i) => (i === idx ? { ...it, ...item } : it));
        nextArtifact = { ...existing, items };
    }
    return { ...run, artifacts: { ...run.artifacts, [name]: nextArtifact } };
}
function appendVersionToItem(run, artifactName, itemId, version) {
    const existing = run.artifacts[artifactName];
    if (!existing)
        return run;
    const items = existing.items.map((it) => it.id === itemId
        ? { ...it, versions: [...it.versions, version], selectedVersionId: version.id }
        : it);
    return {
        ...run,
        artifacts: { ...run.artifacts, [artifactName]: { ...existing, items } },
    };
}
function withLockedItem(artifacts, name, itemId, locked) {
    const existing = artifacts[name];
    if (!existing)
        return artifacts;
    const items = existing.items.map((it) => it.id === itemId ? { ...it, locked } : it);
    return { ...artifacts, [name]: { ...existing, items } };
}
function withSelectedVersion(artifacts, name, itemId, versionId) {
    const existing = artifacts[name];
    if (!existing)
        return artifacts;
    const items = existing.items.map((it) => it.id === itemId ? { ...it, selectedVersionId: versionId } : it);
    return { ...artifacts, [name]: { ...existing, items } };
}
function clearItemVersionsForRedo(artifacts, name, itemId) {
    const existing = artifacts[name];
    if (!existing)
        return artifacts;
    const items = existing.items.map((it) => it.id === itemId
        ? { ...it, versions: [], selectedVersionId: '' }
        : it);
    return { ...artifacts, [name]: { ...existing, items } };
}
function batchItemLabel(stage, index, item) {
    if (stage.itemLabelTemplate) {
        return stage.itemLabelTemplate
            .replace(/\{index\}/g, String(index))
            .replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
            if (item && typeof item === 'object' && key in item) {
                const val = item[key];
                return val === undefined || val === null ? '' : String(val);
            }
            return '';
        });
    }
    return undefined;
}
function setStageState(stages, stageId, patch) {
    const idx = stages.findIndex((s) => s.stageId === stageId);
    if (idx === -1) {
        return [...stages, { stageId, state: 'pending', ...patch }];
    }
    return stages.map((s, i) => (i === idx ? { ...s, ...patch } : s));
}
function ensureStageExec(run, stageId) {
    const existing = run.stages.find((s) => s.stageId === stageId);
    if (existing)
        return existing;
    return { stageId, state: 'pending' };
}
function wrapCallbacks(base, onProgress) {
    const baseRecord = base;
    const baseOnToolProgress = baseRecord.onToolProgress;
    if (typeof baseOnToolProgress !== 'function') {
        return base;
    }
    return {
        ...baseRecord,
        onToolProgress: (progress) => {
            onProgress(progress);
            baseOnToolProgress(progress);
        },
    };
}
async function mutateRun(run, patch, store) {
    const next = { ...run, ...patch, updatedAt: Date.now() };
    await store.save(persistedRun(next));
    return next;
}
export async function createRun(params) {
    const now = Date.now();
    const seededInputs = withWorkflowInputDefaults(params.workflow.inputs, params.inputs);
    const run = {
        id: `run_${now}_${Math.random().toString(36).slice(2, 10)}`,
        workflowId: params.workflow.id,
        workflowSnapshot: params.workflow,
        state: 'draft',
        inputs: seededInputs,
        currentStageIndex: 0,
        stages: Array.from(walkStages(params.workflow.stages)).map((s) => ({
            stageId: s.id,
            state: 'pending',
        })),
        artifacts: {},
        chatSessionId: params.chatSessionId,
        createdAt: now,
        updatedAt: now,
        staleStageIds: [],
    };
    await params.store.save(persistedRun(run));
    return run;
}
function withWorkflowInputDefaults(definitions, provided) {
    const seeded = Object.fromEntries(definitions.map((input) => [input.name, input.default ?? defaultInputValue(input)]));
    return { ...seeded, ...provided };
}
function defaultInputValue(input) {
    if (input.type === 'number')
        return 0;
    if (input.type === 'boolean')
        return false;
    if (input.type === 'select')
        return input.options?.[0]?.value ?? '';
    return '';
}
//# sourceMappingURL=executor.js.map