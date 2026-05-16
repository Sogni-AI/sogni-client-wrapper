export function uint8ArrayToDataUri(data, mimeType = 'image/jpeg') {
    const chunks = [];
    for (let i = 0; i < data.length; i += 8192) {
        chunks.push(String.fromCharCode(...data.subarray(i, i + 8192)));
    }
    return `data:${mimeType};base64,${btoa(chunks.join(''))}`;
}
//# sourceMappingURL=imageEncoding.js.map