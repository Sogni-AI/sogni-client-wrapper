const SEEDANCE_FORMAT = {
    format(index, type) {
        if (type === 'video')
            return `@Video${index}`;
        if (type === 'audio')
            return `@Audio${index}`;
        return `@Image${index}`;
    },
    parse(token) {
        const m = /^@(Image|Video|Audio)(\d+)$/.exec(token.trim());
        if (!m)
            return null;
        const idx = Number.parseInt(m[2], 10);
        if (!Number.isFinite(idx) || idx < 1)
            return null;
        const t = m[1] === 'Video' ? 'video' : m[1] === 'Audio' ? 'audio' : 'image';
        return { index: idx, type: t };
    },
    scanRegex: /@(?:Image|Video|Audio)\d+/g,
};
const GPT_IMAGE_2_FORMAT = {
    format(index, type) {
        if (type === 'video')
            return `Video ${index}`;
        if (type === 'audio')
            return `Audio ${index}`;
        return `Image ${index}`;
    },
    parse(token) {
        const m = /^(Image|Video|Audio)\s+(\d+)$/.exec(token.trim());
        if (!m)
            return null;
        const kind = m[1];
        const idx = Number.parseInt(m[2], 10);
        if (!Number.isFinite(idx) || idx < 1)
            return null;
        const t = kind === 'Video' ? 'video' : kind === 'Audio' ? 'audio' : 'image';
        return { index: idx, type: t };
    },
    scanRegex: /(?<!@)(?<!\b[Gg][Pp][Tt]\s)(?:\[(?:Image|Video|Audio)\s+\d+\]|\b(?:Image|Video|Audio)\s+\d+\b)/g,
};
const CONTEXT_FORMAT = {
    format(index, type) {
        const slot = Math.max(0, index - 1);
        if (type === 'video')
            return `context_video_${slot}`;
        if (type === 'audio')
            return `context_audio_${slot}`;
        return `context_image_${slot}`;
    },
    parse(token) {
        const m = /^context_(image|video|audio)_(\d+)$/.exec(token.trim());
        if (!m)
            return null;
        const slot = Number.parseInt(m[2], 10);
        if (!Number.isFinite(slot) || slot < 0)
            return null;
        return {
            index: slot + 1,
            type: m[1],
        };
    },
    scanRegex: /context_(?:image|video|audio)_\d+/g,
};
const MODEL_REF_FORMATS = {
    seedance: SEEDANCE_FORMAT,
    'gpt-image-2': GPT_IMAGE_2_FORMAT,
    ltx23: CONTEXT_FORMAT,
    wan: CONTEXT_FORMAT,
    'qwen-image-edit': CONTEXT_FORMAT,
    flux: GPT_IMAGE_2_FORMAT,
};
function cloneGlobalRegex(regex) {
    return new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
}
export function getModelRefFormat(modelId) {
    return getModelRefFormatResolution(modelId).format;
}
export function getModelRefFormatResolution(modelId) {
    const trimmed = modelId.trim().toLowerCase();
    if (trimmed in MODEL_REF_FORMATS) {
        return {
            format: MODEL_REF_FORMATS[trimmed],
            model_id: trimmed,
            fell_back: false,
        };
    }
    if (trimmed.startsWith('seedance'))
        return { format: SEEDANCE_FORMAT, model_id: 'seedance', fell_back: false };
    if (trimmed.startsWith('gpt-image') || trimmed.startsWith('flux')) {
        return {
            format: GPT_IMAGE_2_FORMAT,
            model_id: trimmed.startsWith('flux') ? 'flux' : 'gpt-image-2',
            fell_back: false,
        };
    }
    if (trimmed.startsWith('ltx') ||
        trimmed.startsWith('wan') ||
        trimmed.startsWith('qwen-image')) {
        return {
            format: CONTEXT_FORMAT,
            model_id: trimmed.startsWith('wan') ? 'wan' : trimmed.startsWith('qwen-image') ? 'qwen-image-edit' : 'ltx23',
            fell_back: false,
        };
    }
    console.warn(`[ASSET REF] Unknown model_id "${modelId}" fell back to GPT Image 2 model_ref format.`);
    return {
        format: GPT_IMAGE_2_FORMAT,
        model_id: 'unknown',
        fell_back: true,
    };
}
export function getModelRefFormatEntries() {
    return Object.entries(MODEL_REF_FORMATS)
        .map(([model_id, format]) => ({
        model_id,
        format: {
            ...format,
            scanRegex: cloneGlobalRegex(format.scanRegex),
        },
    }));
}
export function formatModelRef(modelId, index, type) {
    return getModelRefFormat(modelId).format(index, type);
}
export function listKnownAssetModelIds() {
    return Object.keys(MODEL_REF_FORMATS);
}
//# sourceMappingURL=modelRefRegistry.js.map