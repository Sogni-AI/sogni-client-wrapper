import { buildBackboneDurableWorkflowRun, } from '../contracts/backboneDurableWorkflow.js';
export const DURABLE_CREATIVE_WORKFLOW_ENDPOINT = '/v1/creative-agent/workflows';
function appendPath(baseUrl, path) {
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
}
export function getDurableCreativeWorkflowUrl(workflowId, apiBaseUrl) {
    const path = workflowId
        ? `${DURABLE_CREATIVE_WORKFLOW_ENDPOINT}/${encodeURIComponent(workflowId)}`
        : DURABLE_CREATIVE_WORKFLOW_ENDPOINT;
    return appendPath(apiBaseUrl, path);
}
export function getDurableCreativeWorkflowEventsUrl(workflowId, apiBaseUrl) {
    return `${getDurableCreativeWorkflowUrl(workflowId, apiBaseUrl)}/events`;
}
export function buildDurableCreativeWorkflowPreview(input, options = {}) {
    return buildBackboneDurableWorkflowRun(input, {
        workflowId: options.workflowId ?? 'wf_durable_workflow_preview',
        ...(options.now ? { now: options.now } : {}),
        ...(options.title ? { title: options.title } : {}),
    });
}
export function buildStartDurableCreativeWorkflowRequest(input, options = {}) {
    const { mediaReferences, ...requestInput } = input;
    return {
        input: requestInput,
        ...(options.tokenType ? { token_type: options.tokenType } : {}),
        ...(options.appSource ? { app_source: options.appSource } : {}),
        ...(mediaReferences !== undefined ? { media_references: mediaReferences } : {}),
        ...(options.maxEstimatedCapacityUnits !== undefined
            ? { max_estimated_capacity_units: options.maxEstimatedCapacityUnits }
            : {}),
        ...(options.confirmCost !== undefined ? { confirm_cost: options.confirmCost } : {}),
    };
}
function getFetch(options) {
    return options.fetchImpl ?? fetch;
}
function buildHeaders(apiKey) {
    return {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    };
}
function buildRequestHeaders(options) {
    return {
        ...buildHeaders(options.apiKey),
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    };
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
async function readJsonEnvelope(response) {
    const text = await response.text();
    let body = {};
    if (text) {
        try {
            const parsed = JSON.parse(text);
            if (isPlainObject(parsed)) {
                body = parsed;
            }
        }
        catch {
        }
    }
    if (!response.ok) {
        const detail = typeof body.message === 'string'
            ? body.message
            : typeof body.error === 'string'
                ? body.error
                : response.statusText;
        throw new Error(`Creative workflow API request failed (${response.status}): ${detail}`);
    }
    if (!('data' in body)) {
        throw new Error('Creative workflow API response did not include a data envelope');
    }
    return body;
}
function requireRecord(value, path) {
    if (!isPlainObject(value)) {
        throw new Error(`Creative workflow API response missing ${path}`);
    }
    return value;
}
function requireArray(value, path) {
    if (!Array.isArray(value)) {
        throw new Error(`Creative workflow API response missing ${path}`);
    }
    return value;
}
export async function startDurableCreativeWorkflow(input, options) {
    if (!options.apiKey) {
        throw new Error('Durable creative workflow execution requires an API key');
    }
    const response = await getFetch(options)(getDurableCreativeWorkflowUrl(undefined, options.apiBaseUrl), {
        method: 'POST',
        credentials: options.credentials ?? 'include',
        signal: options.signal,
        headers: buildRequestHeaders(options),
        body: JSON.stringify(buildStartDurableCreativeWorkflowRequest(input, {
            tokenType: options.tokenType,
            appSource: options.appSource,
            maxEstimatedCapacityUnits: options.maxEstimatedCapacityUnits,
            confirmCost: options.confirmCost,
        })),
    });
    const envelope = await readJsonEnvelope(response);
    const data = requireRecord(envelope.data, 'data');
    return requireRecord(data.workflow, 'data.workflow');
}
export async function getDurableCreativeWorkflow(workflowId, options) {
    const response = await getFetch(options)(getDurableCreativeWorkflowUrl(workflowId, options.apiBaseUrl), {
        method: 'GET',
        credentials: options.credentials ?? 'include',
        signal: options.signal,
        headers: buildHeaders(options.apiKey),
    });
    const envelope = await readJsonEnvelope(response);
    const data = requireRecord(envelope.data, 'data');
    return requireRecord(data.workflow, 'data.workflow');
}
export async function listDurableCreativeWorkflows(options) {
    const params = new URLSearchParams();
    if (options.limit !== undefined)
        params.set('limit', String(options.limit));
    if (options.offset !== undefined)
        params.set('offset', String(options.offset));
    const query = params.toString();
    const url = `${getDurableCreativeWorkflowUrl(undefined, options.apiBaseUrl)}${query ? `?${query}` : ''}`;
    const response = await getFetch(options)(url, {
        method: 'GET',
        credentials: options.credentials ?? 'include',
        signal: options.signal,
        headers: buildHeaders(options.apiKey),
    });
    const envelope = await readJsonEnvelope(response);
    const data = requireRecord(envelope.data, 'data');
    const workflows = requireArray(data.workflows, 'data.workflows');
    const nextRaw = data.next;
    const next = nextRaw === null || typeof nextRaw === 'number' ? nextRaw : null;
    return { workflows, next };
}
export async function getDurableCreativeWorkflowEvents(workflowId, options) {
    const response = await getFetch(options)(getDurableCreativeWorkflowEventsUrl(workflowId, options.apiBaseUrl), {
        method: 'GET',
        credentials: options.credentials ?? 'include',
        signal: options.signal,
        headers: buildHeaders(options.apiKey),
    });
    const envelope = await readJsonEnvelope(response);
    const data = requireRecord(envelope.data, 'data');
    return requireArray(data.events, 'data.events');
}
export function parseSseChunk(chunk) {
    let id;
    let event = 'message';
    const dataLines = [];
    let hasNonComment = false;
    for (const rawLine of chunk.split('\n')) {
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
        if (line === '')
            continue;
        if (line.startsWith(':'))
            continue;
        hasNonComment = true;
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? '' : line.slice(colon + 1);
        if (value.startsWith(' '))
            value = value.slice(1);
        if (field === 'id')
            id = value;
        else if (field === 'event')
            event = value;
        else if (field === 'data')
            dataLines.push(value);
    }
    if (!hasNonComment || dataLines.length === 0)
        return null;
    const rawData = dataLines.join('\n');
    let data = rawData;
    try {
        data = JSON.parse(rawData);
    }
    catch {
    }
    return id !== undefined ? { id, event, data } : { event, data };
}
export async function* streamDurableCreativeWorkflowEvents(workflowId, options) {
    const url = getDurableCreativeWorkflowEventsUrl(workflowId, options.apiBaseUrl) + '/stream'
        + (options.lastEventId !== undefined ? `?after=${encodeURIComponent(String(options.lastEventId))}` : '');
    const headers = {
        Accept: 'text/event-stream',
        ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
        ...(options.lastEventId !== undefined ? { 'Last-Event-ID': String(options.lastEventId) } : {}),
    };
    const response = await getFetch(options)(url, {
        method: 'GET',
        credentials: options.credentials ?? 'include',
        signal: options.signal,
        headers,
    });
    if (!response.ok) {
        throw new Error(`Creative workflow stream failed (${response.status}): ${response.statusText}`);
    }
    if (!response.body) {
        throw new Error('Creative workflow stream returned no response body');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            let boundary = findFrameBoundary(buffer);
            while (boundary !== -1) {
                const chunk = buffer.slice(0, boundary.index);
                buffer = buffer.slice(boundary.index + boundary.length);
                const frame = parseSseChunk(chunk);
                if (frame)
                    yield frame;
                boundary = findFrameBoundary(buffer);
            }
        }
        if (buffer.length > 0) {
            const frame = parseSseChunk(buffer);
            if (frame)
                yield frame;
        }
    }
    finally {
        try {
            reader.releaseLock();
        }
        catch { }
    }
}
function findFrameBoundary(buffer) {
    const lf = buffer.indexOf('\n\n');
    const crlf = buffer.indexOf('\r\n\r\n');
    if (lf === -1 && crlf === -1)
        return -1;
    if (lf !== -1 && (crlf === -1 || lf < crlf))
        return { index: lf, length: 2 };
    return { index: crlf, length: 4 };
}
export function getDurableCreativeWorkflowCancelUrl(workflowId, apiBaseUrl) {
    return `${getDurableCreativeWorkflowUrl(workflowId, apiBaseUrl)}/cancel`;
}
export function getDurableCreativeWorkflowResumeUrl(workflowId, apiBaseUrl) {
    return `${getDurableCreativeWorkflowUrl(workflowId, apiBaseUrl)}/resume`;
}
export async function cancelDurableCreativeWorkflow(workflowId, options) {
    if (!options.apiKey) {
        throw new Error('Durable creative workflow cancellation requires an API key');
    }
    const response = await getFetch(options)(getDurableCreativeWorkflowCancelUrl(workflowId, options.apiBaseUrl), {
        method: 'POST',
        credentials: options.credentials ?? 'include',
        signal: options.signal,
        headers: buildHeaders(options.apiKey),
    });
    const envelope = await readJsonEnvelope(response);
    const data = requireRecord(envelope.data, 'data');
    const workflow = requireRecord(data.workflow, 'data.workflow');
    const transitioned = typeof data.transitioned === 'boolean' ? data.transitioned : false;
    return { workflow, transitioned };
}
export async function resumeDurableCreativeWorkflow(workflowId, options) {
    if (!options.apiKey) {
        throw new Error('Durable creative workflow resume requires an API key');
    }
    const body = {
        ...(options.tokenType ? { token_type: options.tokenType } : {}),
        ...(options.appSource ? { app_source: options.appSource } : {}),
    };
    const response = await getFetch(options)(getDurableCreativeWorkflowResumeUrl(workflowId, options.apiBaseUrl), {
        method: 'POST',
        credentials: options.credentials ?? 'include',
        signal: options.signal,
        headers: buildHeaders(options.apiKey),
        ...(Object.keys(body).length > 0 ? { body: JSON.stringify(body) } : {}),
    });
    const envelope = await readJsonEnvelope(response);
    const data = requireRecord(envelope.data, 'data');
    const workflow = requireRecord(data.workflow, 'data.workflow');
    const resumed = typeof data.resumed === 'boolean' ? data.resumed : false;
    return { workflow, resumed };
}
//# sourceMappingURL=durableWorkflowClient.js.map