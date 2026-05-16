import { randomUUID } from 'crypto';
import { SogniValidationError } from './errors';
export function generateAppId() {
    return randomUUID();
}
export function isImageProjectConfig(config) {
    return config.type === 'image';
}
export function isVideoProjectConfig(config) {
    return config.type === 'video';
}
export function isAudioProjectConfig(config) {
    return config.type === 'audio';
}
export function isWanVideoModel(modelId) {
    return modelId.startsWith('wan_');
}
export function isLtxVideoModel(modelId) {
    return modelId.startsWith('ltx2-') || modelId.startsWith('ltx23-');
}
export function isSeedanceVideoModel(modelId) {
    return modelId.startsWith('seedance-2-0');
}
export function getMaxContextImages(modelId) {
    if (modelId.includes('qwen_image_edit')) {
        return 3;
    }
    if (modelId.includes('kontext')) {
        return 2;
    }
    if (modelId.includes('flux')) {
        return 6;
    }
    return 0;
}
export function supportsContextImages(modelId) {
    return getMaxContextImages(modelId) > 0;
}
export function isCookieAuth(config) {
    return config.authType === 'cookies';
}
export function validateClientConfig(config) {
    if (config.authType !== undefined && !['token', 'cookies', 'apiKey'].includes(config.authType)) {
        throw new SogniValidationError('authType must be one of: "token", "cookies", "apiKey"');
    }
    const authType = config.authType ?? (config.apiKey ? 'apiKey' : 'token');
    if (authType === 'apiKey') {
        if (!config.apiKey || typeof config.apiKey !== 'string') {
            throw new SogniValidationError('apiKey is required and must be a string for apiKey auth');
        }
        if (config.username !== undefined && typeof config.username !== 'string') {
            throw new SogniValidationError('Username must be a string if provided');
        }
        if (config.password !== undefined && typeof config.password !== 'string') {
            throw new SogniValidationError('Password must be a string if provided');
        }
    }
    else if (authType !== 'cookies') {
        if (!config.username || typeof config.username !== 'string') {
            throw new SogniValidationError('Username is required and must be a string');
        }
        if (!config.password || typeof config.password !== 'string') {
            throw new SogniValidationError('Password is required and must be a string');
        }
    }
    if (authType === 'cookies') {
        if (config.username !== undefined && typeof config.username !== 'string') {
            throw new SogniValidationError('Username must be a string if provided');
        }
        if (config.password !== undefined && typeof config.password !== 'string') {
            throw new SogniValidationError('Password must be a string if provided');
        }
    }
    if (config.network && !['fast', 'relaxed'].includes(config.network)) {
        throw new SogniValidationError('Network must be either "fast" or "relaxed"');
    }
    if (config.testnet !== undefined && typeof config.testnet !== 'boolean') {
        throw new SogniValidationError('testnet must be a boolean');
    }
    if (config.socketEndpoint !== undefined && typeof config.socketEndpoint !== 'string') {
        throw new SogniValidationError('socketEndpoint must be a string');
    }
    if (config.restEndpoint !== undefined && typeof config.restEndpoint !== 'string') {
        throw new SogniValidationError('restEndpoint must be a string');
    }
    if (config.disableSocket !== undefined && typeof config.disableSocket !== 'boolean') {
        throw new SogniValidationError('disableSocket must be a boolean');
    }
    if (config.multiInstance !== undefined && typeof config.multiInstance !== 'boolean') {
        throw new SogniValidationError('multiInstance must be a boolean');
    }
    if (config.allowInsecureTLS !== undefined && typeof config.allowInsecureTLS !== 'boolean') {
        throw new SogniValidationError('allowInsecureTLS must be a boolean');
    }
    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
        throw new SogniValidationError('Timeout must be a positive number');
    }
    if (config.reconnectInterval !== undefined && (typeof config.reconnectInterval !== 'number' || config.reconnectInterval <= 0)) {
        throw new SogniValidationError('Reconnect interval must be a positive number');
    }
}
export function validateProjectConfig(config) {
    if (!config.modelId || typeof config.modelId !== 'string') {
        throw new SogniValidationError('Model ID is required and must be a string');
    }
    if (config.positivePrompt === undefined || config.positivePrompt === null || typeof config.positivePrompt !== 'string') {
        throw new SogniValidationError('Positive prompt is required and must be a string');
    }
    if (!config.type || !['image', 'video', 'audio'].includes(config.type)) {
        throw new SogniValidationError('Project type must be one of: "image", "video", "audio"');
    }
    if (config.numberOfMedia !== undefined) {
        if (typeof config.numberOfMedia !== 'number' || config.numberOfMedia < 1) {
            throw new SogniValidationError(`Number of ${config.type}s must be at least 1`);
        }
    }
    if (config.steps !== undefined) {
        if (typeof config.steps !== 'number' || config.steps < 1 || config.steps > 100) {
            throw new SogniValidationError('Steps must be between 1 and 100');
        }
    }
    if (config.guidance !== undefined) {
        if (typeof config.guidance !== 'number' || config.guidance < 0 || config.guidance > 30) {
            throw new SogniValidationError('Guidance must be between 0 and 30');
        }
    }
    if (isImageProjectConfig(config) || isVideoProjectConfig(config)) {
        if (config.width !== undefined) {
            if (typeof config.width !== 'number' || config.width < 256 || config.width > 2048) {
                throw new SogniValidationError('Width must be between 256 and 2048');
            }
        }
        if (config.height !== undefined) {
            if (typeof config.height !== 'number' || config.height < 256 || config.height > 2048) {
                throw new SogniValidationError('Height must be between 256 and 2048');
            }
        }
    }
    if (config.tokenType && !['sogni', 'spark'].includes(config.tokenType)) {
        throw new SogniValidationError('Token type must be either "sogni" or "spark"');
    }
    if (isImageProjectConfig(config)) {
        if (config.outputFormat && !['png', 'jpg'].includes(config.outputFormat)) {
            throw new SogniValidationError('Image output format must be either "png" or "jpg"');
        }
        if (config.startingImageStrength !== undefined) {
            if (typeof config.startingImageStrength !== 'number' || config.startingImageStrength < 0 || config.startingImageStrength > 1) {
                throw new SogniValidationError('Starting image strength must be between 0 and 1');
            }
        }
        if (config.contextImages !== undefined) {
            if (!Array.isArray(config.contextImages)) {
                throw new SogniValidationError('contextImages must be an array');
            }
            const maxImages = 6;
            if (config.contextImages.length > maxImages) {
                throw new SogniValidationError(`contextImages can have at most ${maxImages} images`);
            }
            for (let i = 0; i < config.contextImages.length; i++) {
                const img = config.contextImages[i];
                const isValid = img === true ||
                    Buffer.isBuffer(img) ||
                    (typeof Blob !== 'undefined' && img instanceof Blob);
                if (!isValid && img !== undefined) {
                    throw new SogniValidationError(`contextImages[${i}] must be a Buffer, Blob, or true (for pre-uploaded)`);
                }
            }
        }
    }
    if (isVideoProjectConfig(config)) {
        const validateHttpsUrlArray = (fieldName, values) => {
            if (!Array.isArray(values)) {
                throw new SogniValidationError(`${fieldName} must be an array`);
            }
            const normalizedValues = values;
            for (let i = 0; i < normalizedValues.length; i++) {
                const value = normalizedValues[i];
                if (typeof value !== 'string') {
                    throw new SogniValidationError(`${fieldName}[${i}] must be a string`);
                }
                let parsedUrl;
                try {
                    parsedUrl = new URL(value);
                }
                catch {
                    throw new SogniValidationError(`${fieldName}[${i}] must be a valid HTTPS URL`);
                }
                if (parsedUrl.protocol !== 'https:') {
                    throw new SogniValidationError(`${fieldName}[${i}] must be a valid HTTPS URL`);
                }
            }
            return normalizedValues;
        };
        if (config.outputFormat && config.outputFormat !== 'mp4') {
            throw new SogniValidationError('Video output format must be "mp4"');
        }
        if (config.frames !== undefined) {
            if (typeof config.frames !== 'number' || config.frames < 1 || config.frames > 2001) {
                throw new SogniValidationError('Frames must be between 1 and 2001');
            }
        }
        if (config.fps !== undefined) {
            if (typeof config.fps !== 'number' || config.fps < 1 || config.fps > 60) {
                throw new SogniValidationError('FPS must be between 1 and 60');
            }
        }
        if (config.shift !== undefined) {
            if (typeof config.shift !== 'number' || config.shift < 0 || config.shift > 10) {
                throw new SogniValidationError('Shift must be between 0 and 10');
            }
        }
        if (config.detailerStrength !== undefined) {
            if (typeof config.detailerStrength !== 'number' || config.detailerStrength < 0 || config.detailerStrength > 1) {
                throw new SogniValidationError('detailerStrength must be between 0 and 1');
            }
        }
        if (config.generateAudio !== undefined && typeof config.generateAudio !== 'boolean') {
            throw new SogniValidationError('generateAudio must be a boolean');
        }
        if (config.audioIdentityStrength !== undefined) {
            if (typeof config.audioIdentityStrength !== 'number' ||
                config.audioIdentityStrength < 0 ||
                config.audioIdentityStrength > 10) {
                throw new SogniValidationError('audioIdentityStrength must be between 0 and 10');
            }
        }
        const referenceImageUrls = config.referenceImageUrls !== undefined
            ? validateHttpsUrlArray('referenceImageUrls', config.referenceImageUrls)
            : [];
        const referenceVideoUrls = config.referenceVideoUrls !== undefined
            ? validateHttpsUrlArray('referenceVideoUrls', config.referenceVideoUrls)
            : [];
        const referenceAudioUrls = config.referenceAudioUrls !== undefined
            ? validateHttpsUrlArray('referenceAudioUrls', config.referenceAudioUrls)
            : [];
        if (isSeedanceVideoModel(config.modelId)) {
            if (config.fps !== undefined && config.fps !== 24) {
                throw new SogniValidationError('Seedance video models require fps to be 24');
            }
            if (config.duration !== undefined) {
                if (typeof config.duration !== 'number' || config.duration < 4 || config.duration > 15) {
                    throw new SogniValidationError('Seedance video duration must be between 4 and 15 seconds');
                }
            }
            const imageAssetCount = (config.referenceImage ? 1 : 0) +
                (config.referenceImageEnd ? 1 : 0) +
                referenceImageUrls.length;
            const videoAssetCount = (config.referenceVideo ? 1 : 0) + referenceVideoUrls.length;
            const audioAssetCount = (config.referenceAudio ? 1 : 0) +
                (config.referenceAudioIdentity ? 1 : 0) +
                referenceAudioUrls.length;
            if (imageAssetCount > 9) {
                throw new SogniValidationError('Seedance supports at most 9 image assets per request');
            }
            if (videoAssetCount > 3) {
                throw new SogniValidationError('Seedance supports at most 3 video assets per request');
            }
            if (audioAssetCount > 3) {
                throw new SogniValidationError('Seedance supports at most 3 audio assets per request');
            }
            if (imageAssetCount + videoAssetCount + audioAssetCount > 12) {
                throw new SogniValidationError('Seedance supports at most 12 total assets per request');
            }
            if (referenceAudioUrls.length > 0 && imageAssetCount === 0 && videoAssetCount === 0) {
                throw new SogniValidationError('Seedance audio URL references require at least one image or video reference');
            }
        }
    }
    if (isAudioProjectConfig(config)) {
        if (config.outputFormat && !['mp3', 'flac', 'wav'].includes(config.outputFormat)) {
            throw new SogniValidationError('Audio output format must be one of: "mp3", "flac", "wav"');
        }
        if (config.duration !== undefined) {
            if (typeof config.duration !== 'number' || config.duration < 10 || config.duration > 600) {
                throw new SogniValidationError('Audio duration must be between 10 and 600 seconds');
            }
        }
        if (config.bpm !== undefined) {
            if (typeof config.bpm !== 'number' || config.bpm < 30 || config.bpm > 300) {
                throw new SogniValidationError('Audio BPM must be between 30 and 300');
            }
        }
        if (config.promptStrength !== undefined) {
            if (typeof config.promptStrength !== 'number' || config.promptStrength < 0 || config.promptStrength > 10) {
                throw new SogniValidationError('promptStrength must be between 0 and 10');
            }
        }
        if (config.creativity !== undefined) {
            if (typeof config.creativity !== 'number' || config.creativity < 0 || config.creativity > 2) {
                throw new SogniValidationError('creativity must be between 0 and 2');
            }
        }
    }
}
export function createTimeoutPromise(timeoutMs, errorMessage = 'Operation timed out') {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(errorMessage));
        }, timeoutMs);
    });
}
export async function waitFor(condition, options = {}) {
    const { timeout = 30000, interval = 100, timeoutMessage = 'Wait condition timed out' } = options;
    const startTime = Date.now();
    while (true) {
        const result = await Promise.resolve(condition());
        if (result) {
            return;
        }
        if (Date.now() - startTime >= timeout) {
            throw new Error(timeoutMessage);
        }
        await sleep(interval);
    }
}
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function retry(fn, options = {}) {
    const { maxAttempts = 3, initialDelay = 1000, maxDelay = 10000, backoffFactor = 2, onRetry, } = options;
    let lastError;
    let delay = initialDelay;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt === maxAttempts) {
                throw lastError;
            }
            if (onRetry) {
                onRetry(attempt, lastError);
            }
            await sleep(delay);
            delay = Math.min(delay * backoffFactor, maxDelay);
        }
    }
    throw lastError;
}
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
export function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
export function isPlainObject(value) {
    return value !== null && typeof value === 'object' && value.constructor === Object;
}
export function deepMerge(target, ...sources) {
    if (!sources.length)
        return target;
    const source = sources.shift();
    if (!source)
        return target;
    if (isPlainObject(target) && isPlainObject(source)) {
        for (const key in source) {
            if (isPlainObject(source[key])) {
                if (!target[key])
                    Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            }
            else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    return deepMerge(target, ...sources);
}
export function sanitizeForLog(str, keysToHide = ['password', 'apiKey', 'token']) {
    let sanitized = str;
    keysToHide.forEach(key => {
        const regex = new RegExp(`(${key}["\']?\\s*[:=]\\s*["\']?)([^"',}\\s]+)`, 'gi');
        sanitized = sanitized.replace(regex, '$1***');
    });
    return sanitized;
}
export function debounce(func, waitMs) {
    let timeoutId = null;
    return function (...args) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, waitMs);
    };
}
export function throttle(func, limitMs) {
    let inThrottle = false;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limitMs);
        }
    };
}
//# sourceMappingURL=helpers.js.map