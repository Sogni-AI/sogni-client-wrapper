const ROOT_PATTERN = /^\$(inputs|artifacts|item|runtime|run)(?:\.|\[)?/;
export function isBinding(value) {
    return typeof value === 'string' && value.startsWith('$');
}
export function parseBinding(binding) {
    const match = binding.match(ROOT_PATTERN);
    if (!match) {
        throw new BindingError(`Binding must start with $inputs/$artifacts/$item/$runtime/$run: ${binding}`);
    }
    const root = match[1];
    const rest = binding.slice(match[0].length - (binding[match[0].length - 1] === '.' || binding[match[0].length - 1] === '[' ? 1 : 0));
    const segments = [];
    let hasWildcard = false;
    let remaining = rest;
    while (remaining.length > 0) {
        if (remaining.startsWith('.')) {
            remaining = remaining.slice(1);
            continue;
        }
        if (remaining.startsWith('[')) {
            const end = remaining.indexOf(']');
            if (end === -1) {
                throw new BindingError(`Unterminated bracket in binding: ${binding}`);
            }
            const inner = remaining.slice(1, end);
            if (inner === '*') {
                segments.push({ kind: 'wildcard' });
                hasWildcard = true;
            }
            else {
                const idx = Number(inner);
                if (!Number.isInteger(idx) || idx < 0) {
                    throw new BindingError(`Invalid index in binding: ${binding}`);
                }
                segments.push({ kind: 'index', index: idx });
            }
            remaining = remaining.slice(end + 1);
            continue;
        }
        const nextDot = remaining.indexOf('.');
        const nextBracket = remaining.indexOf('[');
        const stops = [nextDot, nextBracket].filter((i) => i !== -1);
        const stop = stops.length > 0 ? Math.min(...stops) : remaining.length;
        const name = remaining.slice(0, stop);
        if (!name) {
            throw new BindingError(`Empty path segment in binding: ${binding}`);
        }
        segments.push({ kind: 'field', name });
        remaining = remaining.slice(stop);
    }
    return { root, segments, hasWildcard };
}
export class BindingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BindingError';
    }
}
export function resolveBindings(value, ctx) {
    return walk(value, ctx);
}
function walk(value, ctx) {
    if (isBinding(value)) {
        return resolveOne(value, ctx);
    }
    if (Array.isArray(value)) {
        return value.map((v) => walk(v, ctx));
    }
    if (value !== null && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = walk(v, ctx);
        }
        return out;
    }
    return value;
}
function resolveOne(binding, ctx) {
    const parsed = parseBinding(binding);
    const root = pickRoot(parsed.root, ctx, binding);
    return walkSegments(root, parsed.segments, binding);
}
function pickRoot(root, ctx, binding) {
    switch (root) {
        case 'inputs':
            return ctx.inputs;
        case 'artifacts':
            return ctx.artifacts;
        case 'item':
            if (!ctx.item) {
                throw new BindingError(`$item used outside a batch stage: ${binding}`);
            }
            return ctx.item;
        case 'runtime':
            return ctx.runtime ?? {};
        case 'run':
            return ctx.run ?? {};
    }
}
function walkSegments(start, segments, binding) {
    let current = start;
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (current === undefined || current === null) {
            throw new BindingError(`Binding path walked into null/undefined: ${binding}`);
        }
        if (seg.kind === 'field') {
            if (seg.name === 'selectedVersion' && isArtifactItem(current)) {
                current = getSelectedVersion(current);
                continue;
            }
            if (typeof current !== 'object' || Array.isArray(current)) {
                throw new BindingError(`Cannot read field "${seg.name}" on non-object in binding: ${binding}`);
            }
            current = current[seg.name];
            continue;
        }
        if (seg.kind === 'index') {
            if (!Array.isArray(current)) {
                if (isArtifact(current)) {
                    current = current.items[seg.index];
                    continue;
                }
                throw new BindingError(`Cannot read index [${seg.index}] on non-array in binding: ${binding}`);
            }
            current = current[seg.index];
            continue;
        }
        if (seg.kind === 'wildcard') {
            const arr = coerceToArray(current, binding);
            const remainingSegments = segments.slice(i + 1);
            return arr.map((el) => walkSegments(el, remainingSegments, binding));
        }
    }
    return current;
}
function coerceToArray(value, binding) {
    if (Array.isArray(value))
        return value;
    if (isArtifact(value))
        return value.items;
    throw new BindingError(`Wildcard [*] applied to non-array in binding: ${binding}`);
}
function isArtifact(v) {
    return !!v
        && typeof v === 'object'
        && 'items' in v
        && 'kind' in v
        && 'name' in v;
}
function isArtifactItem(v) {
    return !!v
        && typeof v === 'object'
        && 'versions' in v
        && 'selectedVersionId' in v;
}
function getSelectedVersion(item) {
    const version = item.versions.find((v) => v.id === item.selectedVersionId);
    if (!version) {
        throw new BindingError(`ArtifactItem "${item.id}" has no version matching selectedVersionId "${item.selectedVersionId}"`);
    }
    return version;
}
export function collectBindings(value) {
    const out = [];
    const visit = (v) => {
        if (isBinding(v)) {
            out.push(v);
            return;
        }
        if (Array.isArray(v)) {
            v.forEach(visit);
            return;
        }
        if (v !== null && typeof v === 'object') {
            Object.values(v).forEach(visit);
        }
    };
    visit(value);
    return out;
}
//# sourceMappingURL=bindings.js.map