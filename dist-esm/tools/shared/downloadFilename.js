const MIME_EXTENSION_MAP = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/flac': 'flac',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
};
const EXTENSION_MEDIA_TYPE_MAP = {
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    webp: 'image',
    gif: 'image',
    avif: 'image',
    heic: 'image',
    heif: 'image',
    mp4: 'video',
    mov: 'video',
    webm: 'video',
    mp3: 'audio',
    wav: 'audio',
    flac: 'audio',
    m4a: 'audio',
    zip: 'archive',
};
export function slugify(name) {
    return name
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .slice(0, 60);
}
export function extensionFromMimeType(mimeType) {
    if (!mimeType)
        return null;
    const normalized = mimeType.split(';')[0].trim().toLowerCase();
    return MIME_EXTENSION_MAP[normalized] ?? null;
}
export function extensionFromUrl(url) {
    if (!url)
        return null;
    const dataMatch = url.match(/^data:([^;,]+)[;,]/i);
    if (dataMatch)
        return extensionFromMimeType(dataMatch[1]);
    try {
        const parsed = new URL(url, 'https://chat.sogni.ai');
        const match = parsed.pathname.match(/\.([a-z0-9]{2,5})$/i);
        return normalizeDownloadExtension(match?.[1] ?? null);
    }
    catch {
        const path = url.split(/[?#]/, 1)[0];
        const match = path.match(/\.([a-z0-9]{2,5})$/i);
        return normalizeDownloadExtension(match?.[1] ?? null);
    }
}
export function normalizeDownloadExtension(extension, mediaType) {
    if (!extension)
        return null;
    const normalized = extension.replace(/^\./, '').trim().toLowerCase();
    if (!normalized)
        return null;
    const resolvedMediaType = EXTENSION_MEDIA_TYPE_MAP[normalized];
    if (!resolvedMediaType)
        return null;
    if (mediaType && resolvedMediaType !== mediaType)
        return null;
    return normalized === 'jpeg' ? 'jpg' : normalized;
}
export function defaultExtensionForDownloadType(type) {
    if (type === 'video')
        return 'mp4';
    if (type === 'audio')
        return 'mp3';
    return 'jpg';
}
export function replaceFilenameExtension(filename, extension) {
    const normalized = normalizeDownloadExtension(extension);
    if (!normalized)
        return filename;
    const basename = filename.replace(/\.[^./\\]+$/, '');
    return `${basename}.${normalized}`;
}
export function buildDownloadFilename(originalFileName, index, type = 'restored', metadata, extension) {
    const defaultSlug = type === 'audio' ? 'music' : type === 'video' ? 'video' : 'photo';
    const slug = originalFileName ? slugify(originalFileName) : defaultSlug;
    const mediaType = type === 'video' ? 'video' : type === 'audio' ? 'audio' : 'image';
    const ext = normalizeDownloadExtension(extension, mediaType) || defaultExtensionForDownloadType(type);
    const parts = ['sogni'];
    if (type === 'original') {
        parts.push('original');
    }
    else if (type === 'video') {
        parts.push('video');
    }
    else if (type === 'audio') {
        parts.push('audio');
    }
    else if (type === 'styled') {
        parts.push('styled');
    }
    else {
        parts.push('chat');
    }
    parts.push(slug);
    if (metadata) {
        if (metadata.model) {
            parts.push(slugify(metadata.model));
        }
        if (metadata.width && metadata.height) {
            parts.push(`${metadata.width}x${metadata.height}`);
        }
        if (metadata.duration) {
            parts.push(`${metadata.duration}s`);
        }
        if (metadata.fps) {
            parts.push(`${metadata.fps}fps`);
        }
        if (metadata.seed != null) {
            parts.push(`seed${metadata.seed}`);
        }
    }
    if (index != null)
        parts.push(String(index));
    return `${parts.join('-')}.${ext}`;
}
export function buildZipFilename(originalFileName) {
    const slug = originalFileName ? slugify(originalFileName) : 'photos';
    return `sogni-chat-${slug}.zip`;
}
//# sourceMappingURL=downloadFilename.js.map