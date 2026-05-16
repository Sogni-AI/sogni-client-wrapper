import { formatModelRef, getModelRefFormat, getModelRefFormatEntries } from './modelRefRegistry.js';
export function createAssetManifest() {
    return {
        assets: [],
        next_index: 1,
        updated_at: new Date().toISOString(),
    };
}
const ASSET_ID_PATTERN = /^[A-Za-z0-9_.:/-]+$/;
const MAX_ASSET_ID_LENGTH = 128;
function validateAssetIdOrThrow(rawId) {
    if (rawId.length === 0) {
        return;
    }
    if (rawId.length > MAX_ASSET_ID_LENGTH) {
        throw new Error(`Invalid asset_id: must be at most ${MAX_ASSET_ID_LENGTH} characters`);
    }
    if (!ASSET_ID_PATTERN.test(rawId)) {
        throw new Error('Invalid asset_id: must match /^[A-Za-z0-9_.:/-]+$/ (no whitespace, control chars, or punctuation)');
    }
}
export function addAsset(manifest, input) {
    const requestedId = (input.asset_id ?? `asset_${manifest.next_index.toString().padStart(3, '0')}`).trim();
    validateAssetIdOrThrow(requestedId);
    const existingIds = new Set(manifest.assets.map((asset) => asset.asset_id));
    let asset_id = requestedId || `asset_${manifest.next_index.toString().padStart(3, '0')}`;
    if (existingIds.has(asset_id)) {
        const base = asset_id;
        let suffix = 2;
        while (existingIds.has(`${base}_${suffix}`))
            suffix += 1;
        asset_id = `${base}_${suffix}`;
    }
    const asset = {
        asset_id,
        user_label: input.user_label.trim() || asset_id,
        type: input.type,
        description: input.description?.trim() || undefined,
        url: input.url?.trim() || undefined,
        must_preserve: input.must_preserve?.length ? [...input.must_preserve] : undefined,
        avoid: input.avoid?.length ? [...input.avoid] : undefined,
        metadata: input.metadata,
    };
    return {
        manifest: {
            assets: [...manifest.assets, asset],
            next_index: manifest.next_index + 1,
            updated_at: new Date().toISOString(),
        },
        asset,
    };
}
export function updateAsset(manifest, input) {
    const idx = manifest.assets.findIndex((a) => a.asset_id === input.asset_id);
    if (idx < 0)
        return null;
    const prev = manifest.assets[idx];
    const next = {
        ...prev,
        user_label: input.user_label?.trim() ? input.user_label.trim() : prev.user_label,
        description: input.description !== undefined
            ? input.description.trim() || undefined
            : prev.description,
        must_preserve: input.must_preserve ? [...input.must_preserve] : prev.must_preserve,
        avoid: input.avoid ? [...input.avoid] : prev.avoid,
        metadata: input.metadata !== undefined ? input.metadata : prev.metadata,
        url: input.url !== undefined ? input.url.trim() || undefined : prev.url,
    };
    const assets = [...manifest.assets];
    assets[idx] = next;
    return {
        manifest: { ...manifest, assets, updated_at: new Date().toISOString() },
        asset: next,
    };
}
export function findAsset(manifest, selector) {
    if (selector.asset_id) {
        const byId = manifest.assets.find((a) => a.asset_id === selector.asset_id);
        if (byId)
            return byId;
    }
    if (selector.user_label) {
        const target = selector.user_label.trim().toLowerCase();
        if (target) {
            const byLabel = manifest.assets.find((a) => a.user_label.toLowerCase() === target);
            if (byLabel)
                return byLabel;
        }
    }
    return null;
}
export function mapAssetsForModel(manifest, modelId) {
    const perTypeIndex = new Map();
    const out = [];
    for (const asset of manifest.assets) {
        const next = (perTypeIndex.get(asset.type) ?? 0) + 1;
        perTypeIndex.set(asset.type, next);
        out.push({
            asset_id: asset.asset_id,
            user_label: asset.user_label,
            type: asset.type,
            model_ref: formatModelRef(modelId, next, asset.type),
        });
    }
    return out;
}
function normalizeLabelForMatching(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function metadataAliases(metadata) {
    const rawAliases = metadata?.aliases ?? metadata?.alias;
    if (typeof rawAliases === 'string')
        return [rawAliases];
    if (!Array.isArray(rawAliases))
        return [];
    return rawAliases.filter((item) => typeof item === 'string');
}
function labelCandidatesForAsset(asset) {
    return [asset.user_label, ...metadataAliases(asset.metadata)]
        .map((label) => label.trim())
        .filter((label, index, labels) => label.length > 0 && labels.indexOf(label) === index);
}
function normalizedTextMentionsLabel(normalizedText, normalizedLabel) {
    if (!normalizedText || !normalizedLabel)
        return false;
    return ` ${normalizedText} `.includes(` ${normalizedLabel} `);
}
function ambiguousLabelsForPrompt(manifest, promptText) {
    const normalizedText = normalizeLabelForMatching(promptText);
    if (!normalizedText)
        return [];
    const labelsByNormalized = new Map();
    for (const asset of manifest.assets) {
        for (const label of labelCandidatesForAsset(asset)) {
            const normalized = normalizeLabelForMatching(label);
            if (!normalized)
                continue;
            const entry = labelsByNormalized.get(normalized) ?? {
                display: label,
                assetIds: new Set(),
            };
            entry.assetIds.add(asset.asset_id);
            labelsByNormalized.set(normalized, entry);
        }
    }
    const ambiguous = [];
    for (const [normalized, entry] of labelsByNormalized) {
        if (entry.assetIds.size < 2)
            continue;
        if (!normalizedTextMentionsLabel(normalizedText, normalized))
            continue;
        ambiguous.push(entry.display);
    }
    return ambiguous.sort((a, b) => a.localeCompare(b));
}
export function validateAssetReferences(manifest, modelId, promptText) {
    const fmt = getModelRefFormat(modelId);
    const mapping = mapAssetsForModel(manifest, modelId);
    const refToAsset = new Map(mapping.map((m) => [m.model_ref, m]));
    const resolved = [];
    const dangling = [];
    const text = promptText || '';
    const seenTokens = new Set();
    for (const match of text.matchAll(fmt.scanRegex)) {
        const token = match[0];
        if (seenTokens.has(token))
            continue;
        seenTokens.add(token);
        const hit = refToAsset.get(token);
        if (hit) {
            resolved.push({ token, asset_id: hit.asset_id, user_label: hit.user_label });
            continue;
        }
        const parsed = fmt.parse(token);
        if (!parsed) {
            dangling.push({ token, reason: 'unknown_model_ref' });
            continue;
        }
        const sameType = mapping.filter((m) => !parsed.type || m.type === parsed.type);
        const aliasHit = sameType[parsed.index - 1];
        if (aliasHit) {
            resolved.push({ token, asset_id: aliasHit.asset_id, user_label: aliasHit.user_label });
        }
        else if (sameType.length === 0 || parsed.index > sameType.length) {
            dangling.push({ token, reason: 'index_out_of_range' });
        }
        else {
            dangling.push({ token, reason: 'unknown_model_ref' });
        }
    }
    for (const entry of getModelRefFormatEntries()) {
        const otherFormat = entry.format;
        if (otherFormat === fmt)
            continue;
        for (const match of text.matchAll(otherFormat.scanRegex)) {
            const token = match[0];
            if (seenTokens.has(token))
                continue;
            const parsedByTarget = fmt.parse(token);
            if (parsedByTarget)
                continue;
            const parsedByOther = otherFormat.parse(token);
            if (!parsedByOther)
                continue;
            seenTokens.add(token);
            dangling.push({
                token,
                reason: 'wrong_model_ref_format',
                expected_model_id: modelId,
            });
        }
    }
    return {
        resolved,
        dangling,
        ambiguous_labels: ambiguousLabelsForPrompt(manifest, text),
    };
}
export function listAssets(manifest) {
    return manifest.assets;
}
//# sourceMappingURL=manifest.js.map