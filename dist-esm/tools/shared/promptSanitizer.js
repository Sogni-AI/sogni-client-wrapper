const GRID_PATTERNS = [
    /\b(?:different|various|varying|multiple|several|many|diverse|assorted|all|range of|variety of|array of|series of|set of|collection of)\s+(?:facial\s+)?(?:expressions?|poses?|angles?|versions?|variations?|looks?|smiles?|moods?|emotions?|faces?|views?|shots?|styles?|options?|takes?|scenes?|settings?|environments?|worlds?)\b/gi,
    /\b\d+\s+(?:completely\s+|totally\s+|very\s+)?(?:different|unique|distinct|varying|varied|separate|individual)?\s*(?:facial\s+)?(?:expressions?|poses?|angles?|versions?|variations?|looks?|smiles?|moods?|emotions?|faces?|views?|shots?|styles?|options?|takes?|images?|photos?|pictures?|portraits?|copies|duplicates|scenes?|settings?|environments?|worlds?)\b/gi,
    /\b(?:grid|collage|montage|composite|triptych|diptych|side[- ]by[- ]side|side[- ]to[- ]side|split[- ]?screen|photo[- ]?sheet|contact[- ]?sheet|mood[- ]?board|lineup|line[- ]?up|tile[ds]?|tiling|rows?\s+(?:of|and)\s+columns?|columns?\s+(?:of|and)\s+rows?)\b/gi,
    /\beach\s+(?:with|showing|featuring|displaying|having|in)\s+(?:a\s+)?(?:different|unique|distinct|its own)\b/gi,
    /\beach\s+(?:one|version|variation|image|copy)\b/gi,
    /\b(?:show|display|create|generate|make|render|produce)\s+(?:multiple|different|various|several|all)\b/gi,
    /\b(?:switch(?:ing)?|mix(?:ing)?)\s+up\b/gi,
    /\b\d+\s+of\s+(?:them|these|those)\b/gi,
    /\b(?:multiple|several|many)\s+(?:copies|duplicates|instances|repeats)\b/gi,
    /\b\d+\s+(?:versions?|variations?|renditions?|interpretations?|depictions?|iterations?)\b/gi,
    /\b(?:repeated|repeating|repeat)\s+\d*\s*(?:times?)?\b/gi,
    /\b(?:put|place|fit|arrange)\s+(?:them|these|those|it)\s+(?:all\s+)?(?:together|into one|in one)\b/gi,
    /\ball\s+(?:together|in\s+one\s+(?:image|frame|picture|photo))\b/gi,
];
const SINGULARIZE_PATTERNS = [
    [
        /\b(create|generate|make|render|produce)\s+\d+\s+(?:completely\s+|totally\s+|very\s+)?(?:different|unique|distinct|varying|varied|separate|individual)?\s*(scenes?|settings?|environments?|worlds?)\s+(featuring|with|of)\b/gi,
        '$1 a single scene $3',
    ],
    [
        /\b(create|generate|make|render|produce)\s+\d+\s+(?:completely\s+|totally\s+|very\s+)?(?:different|unique|distinct|varying|varied|separate|individual)?\s*(images?|photos?|pictures?|portraits?)\s+(featuring|with|of)\b/gi,
        '$1 a single image $3',
    ],
    [
        /\b(?:in|across)\s+(?:different|various|varying|multiple|several|many|diverse|assorted)\s+(?:scenes?|settings?|environments?|worlds?)\s*:/gi,
        'in this setting:',
    ],
    [
        /\bfor\s+all\s+(?:scenes?|settings?|environments?|worlds?|images?|photos?|pictures?|portraits?)\b/gi,
        'for the image',
    ],
];
function countPatternReplacement(match, ...args) {
    const offset = typeof args[args.length - 2] === 'number' ? args[args.length - 2] : 0;
    const source = typeof args[args.length - 1] === 'string' ? args[args.length - 1] : '';
    const before = source.slice(Math.max(0, offset - 8), offset);
    const after = source.slice(offset + match.length, offset + match.length + 8);
    const touchesAspectOrDimension = /(?:\d\s*[:/x×]\s*|\bby\s*)$/i.test(before)
        || /^\s*(?::|\/|x|×|\bby\b)\s*\d/i.test(after);
    return touchesAspectOrDimension ? match : '';
}
export function sanitizeBatchPrompt(prompt) {
    const groups = [];
    const PLACEHOLDER_PREFIX = '\x00DP';
    const placeholder = (i) => `${PLACEHOLDER_PREFIX}${i}\x00`;
    let shielded = prompt.replace(/\{[^{}]+\}/g, (match) => {
        if (match.includes('|')) {
            groups.push(match);
            return placeholder(groups.length - 1);
        }
        return match;
    });
    for (const [pattern, replacement] of SINGULARIZE_PATTERNS) {
        pattern.lastIndex = 0;
        shielded = shielded.replace(pattern, replacement);
    }
    for (const pattern of GRID_PATTERNS) {
        pattern.lastIndex = 0;
        shielded = shielded.replace(pattern, countPatternReplacement);
    }
    shielded = shielded.replace(/\s{2,}/g, ' ').replace(/\s+([.,;!?])/g, '$1').trim();
    shielded = shielded.replace(/^[,.\s]+/, '').replace(/[,.\s]+$/, '').trim();
    let result = shielded;
    for (let i = 0; i < groups.length; i++) {
        result = result.replace(placeholder(i), groups[i]);
    }
    return result;
}
//# sourceMappingURL=promptSanitizer.js.map