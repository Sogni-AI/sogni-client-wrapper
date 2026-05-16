export const LLM_SUBCALL_TIMEOUT_MS = 20000;
export const LLM_THINKING_TIMEOUT_MS = 75000;
export class StreamAbortError extends Error {
    constructor(label = 'stream') {
        super(`${label} aborted`);
        this.name = 'StreamAbortError';
    }
}
export async function consumeStreamWithAbort(stream, signal, onChunk, label = 'stream') {
    const iter = stream[Symbol.asyncIterator]();
    if (!signal) {
        try {
            while (true) {
                const { value, done } = await iter.next();
                if (done)
                    break;
                onChunk(value);
            }
        }
        finally {
            try {
                await iter.return?.();
            }
            catch { }
        }
        return;
    }
    if (signal.aborted) {
        try {
            await iter.return?.();
        }
        catch { }
        throw new StreamAbortError(label);
    }
    let abortListener;
    const abortPromise = new Promise((_resolve, reject) => {
        abortListener = () => reject(new StreamAbortError(label));
        signal.addEventListener('abort', abortListener, { once: true });
    });
    try {
        while (true) {
            const result = await Promise.race([iter.next(), abortPromise]);
            if (result.done)
                break;
            onChunk(result.value);
        }
    }
    finally {
        if (abortListener)
            signal.removeEventListener('abort', abortListener);
        try {
            await iter.return?.();
        }
        catch { }
    }
}
export function withTimeout(factory, ms, label, parentSignal) {
    if (parentSignal?.aborted) {
        return Promise.resolve(undefined);
    }
    const controller = new AbortController();
    let timer;
    let timedOut = false;
    const onParentAbort = () => controller.abort();
    if (parentSignal)
        parentSignal.addEventListener('abort', onParentAbort);
    const cleanup = () => {
        clearTimeout(timer);
        if (parentSignal)
            parentSignal.removeEventListener('abort', onParentAbort);
    };
    const factoryPromise = Promise.resolve().then(() => factory(controller.signal));
    const raced = Promise.race([
        factoryPromise.catch((err) => {
            if (timedOut) {
                console.warn(`[LLM HELPERS] ${label} rejected after timeout:`, err);
                return undefined;
            }
            throw err;
        }),
        new Promise((resolve) => {
            timer = setTimeout(() => {
                timedOut = true;
                console.warn(`[LLM HELPERS] ${label} timed out after ${ms}ms — aborting stream`);
                controller.abort();
                resolve(undefined);
            }, ms);
        }),
    ]);
    raced.finally(cleanup);
    return raced;
}
function stripXmlTag(text, inside, openTag, closeTag) {
    let result = '';
    let inTag = inside;
    let i = 0;
    while (i < text.length) {
        if (!inTag) {
            const openIdx = text.indexOf(openTag, i);
            if (openIdx === -1) {
                result += text.slice(i);
                break;
            }
            result += text.slice(i, openIdx);
            inTag = true;
            i = openIdx + openTag.length;
        }
        else {
            const closeIdx = text.indexOf(closeTag, i);
            if (closeIdx === -1) {
                break;
            }
            inTag = false;
            i = closeIdx + closeTag.length;
        }
    }
    return { cleaned: result, inside: inTag };
}
export function stripThinkBlocks(text, insideThink, insideToolCall = false) {
    const thinkResult = stripXmlTag(text, insideThink, '<think>', '</think>');
    const toolCallResult = stripXmlTag(thinkResult.cleaned, insideToolCall, '<tool_call>', '</tool_call>');
    return {
        cleaned: toolCallResult.cleaned,
        insideThink: thinkResult.inside,
        insideToolCall: toolCallResult.inside,
    };
}
export function stripThinkBlocksFromText(content) {
    if (content == null)
        return content;
    const cleaned = content
        .replace(/<think>[\s\S]*?<\/think>\s*/g, '')
        .replace(/<tool_call>[\s\S]*?<\/tool_call>\s*/g, '')
        .trimStart();
    return cleaned;
}
//# sourceMappingURL=llmHelpers.js.map