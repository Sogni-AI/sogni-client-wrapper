export const IMAGE_MIN_DIMENSION = 480;
export const IMAGE_MAX_DIMENSION = 2048;
export const IMAGE_DIMENSION_STEP = 8;
export function parseAspectRatio(value) {
    if (!value)
        return undefined;
    const trimmed = value.trim();
    const exactMatch = trimmed.match(/^(\d+)\s*[xX\u00d7]\s*(\d+)$/);
    if (exactMatch) {
        const w = parseInt(exactMatch[1], 10);
        const h = parseInt(exactMatch[2], 10);
        if (w > 0 && h > 0)
            return { type: 'exact', width: w, height: h };
    }
    const ratioMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
    if (ratioMatch) {
        const ratioW = parseFloat(ratioMatch[1]);
        const ratioH = parseFloat(ratioMatch[2]);
        if (ratioW > 0 && ratioH > 0)
            return { type: 'ratio', ratioW, ratioH };
    }
    return undefined;
}
export function calculateOutputDimensions(srcWidth, srcHeight, options) {
    const { scale = 1, minDim = IMAGE_MIN_DIMENSION, maxDim = IMAGE_MAX_DIMENSION, step = IMAGE_DIMENSION_STEP, aspectRatio, } = options ?? {};
    let w;
    let h;
    const parsed = parseAspectRatio(aspectRatio);
    if (parsed?.type === 'exact') {
        w = parsed.width * scale;
        h = parsed.height * scale;
    }
    else if (parsed?.type === 'ratio') {
        const srcArea = srcWidth * srcHeight * scale * scale;
        const ratio = parsed.ratioW / parsed.ratioH;
        w = Math.sqrt(srcArea * ratio);
        h = srcArea / w;
    }
    else {
        w = srcWidth * scale;
        h = srcHeight * scale;
    }
    const smaller = Math.min(w, h);
    if (smaller < minDim) {
        const upscale = minDim / smaller;
        w *= upscale;
        h *= upscale;
    }
    const larger = Math.max(w, h);
    if (larger > maxDim) {
        const downscale = maxDim / larger;
        w *= downscale;
        h *= downscale;
    }
    w = Math.max(step, Math.round(w / step) * step);
    h = Math.max(step, Math.round(h / step) * step);
    return { width: w, height: h };
}
//# sourceMappingURL=imageDimensions.js.map