/**
 * Prompt sanitizer for batch variation generation.
 *
 * Image models (especially Qwen Image Edit) interpret certain phrases as
 * instructions to render grids/collages/montages inside a single output.
 * This strips those patterns so each output is always a single image.
 */

/**
 * Phrases that cause models to generate grids or collages.
 * Each regex is applied case-insensitively with word boundaries.
 */
const GRID_PATTERNS: RegExp[] = [
  // Multiplicity adjectives + nouns
  /\b(?:different|various|varying|multiple|several|many|diverse|assorted|all|range of|variety of|array of|series of|set of|collection of)\s+(?:facial\s+)?(?:expressions?|poses?|angles?|versions?|variations?|looks?|smiles?|moods?|emotions?|faces?|views?|shots?|styles?|options?|takes?|scenes?|settings?|environments?|worlds?)\b/gi,
  // Count + nouns (e.g. "8 different expressions", "9 versions", "8 separate images")
  /\b\d+\s+(?:completely\s+|totally\s+|very\s+)?(?:different|unique|distinct|varying|varied|separate|individual)?\s*(?:facial\s+)?(?:expressions?|poses?|angles?|versions?|variations?|looks?|smiles?|moods?|emotions?|faces?|views?|shots?|styles?|options?|takes?|images?|photos?|pictures?|portraits?|copies|duplicates|scenes?|settings?|environments?|worlds?)\b/gi,
  // Grid/collage/montage/composite layout language
  /\b(?:grid|collage|montage|composite|triptych|diptych|side[- ]by[- ]side|side[- ]to[- ]side|split[- ]?screen|photo[- ]?sheet|contact[- ]?sheet|mood[- ]?board|lineup|line[- ]?up|tile[ds]?|tiling|rows?\s+(?:of|and)\s+columns?|columns?\s+(?:of|and)\s+rows?)\b/gi,
  // "each with/showing/featuring different..."
  /\beach\s+(?:with|showing|featuring|displaying|having|in)\s+(?:a\s+)?(?:different|unique|distinct|its own)\b/gi,
  // "each one" / "each version" standalone
  /\beach\s+(?:one|version|variation|image|copy)\b/gi,
  // "show/display/create multiple/different..."
  /\b(?:show|display|create|generate|make|render|produce)\s+(?:multiple|different|various|several|all)\b/gi,
  // "switching up" / "switch up" (causes multi-face grids)
  /\b(?:switch(?:ing)?|mix(?:ing)?)\s+up\b/gi,
  // "N of them" / "N of these" (e.g. "give me 8 of them")
  /\b\d+\s+of\s+(?:them|these|those)\b/gi,
  // "multiple copies/duplicates/instances"
  /\b(?:multiple|several|many)\s+(?:copies|duplicates|instances|repeats)\b/gi,
  // Bare "N versions/variations" without adjective (e.g. "8 versions")
  /\b\d+\s+(?:versions?|variations?|renditions?|interpretations?|depictions?|iterations?)\b/gi,
  // "repeated/repeating N times" or "the same X repeated"
  /\b(?:repeated|repeating|repeat)\s+\d*\s*(?:times?)?\b/gi,
  // "put/place them together" / "all together" / "in one image/frame"
  /\b(?:put|place|fit|arrange)\s+(?:them|these|those|it)\s+(?:all\s+)?(?:together|into one|in one)\b/gi,
  /\ball\s+(?:together|in\s+one\s+(?:image|frame|picture|photo))\b/gi,
];

const SINGULARIZE_PATTERNS: Array<[RegExp, string]> = [
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

function countPatternReplacement(match: string, ...args: unknown[]): string {
  const offset = typeof args[args.length - 2] === 'number' ? args[args.length - 2] as number : 0;
  const source = typeof args[args.length - 1] === 'string' ? args[args.length - 1] as string : '';
  const before = source.slice(Math.max(0, offset - 8), offset);
  const after = source.slice(offset + match.length, offset + match.length + 8);
  const touchesAspectOrDimension =
    /(?:\d\s*[:/x×]\s*|\bby\s*)$/i.test(before)
    || /^\s*(?::|\/|x|×|\bby\b)\s*\d/i.test(after);
  return touchesAspectOrDimension ? match : '';
}

/**
 * Strip grid/collage-causing language from a prompt.
 * Safe to call on any prompt — only strips patterns that provoke multi-image
 * layouts within a single output.
 *
 * Protects Dynamic Prompt groups ({a|b|c}) from being modified — grid patterns
 * are only applied to text OUTSIDE curly-brace groups.
 */
export function sanitizeBatchPrompt(prompt: string): string {
  // Extract {…} dynamic prompt groups, replacing them with placeholders so
  // grid-pattern regexes cannot match or corrupt content inside them.
  const groups: string[] = [];
  const PLACEHOLDER_PREFIX = '\x00DP';
  const placeholder = (i: number) => `${PLACEHOLDER_PREFIX}${i}\x00`;

  let shielded = prompt.replace(/\{[^{}]+\}/g, (match) => {
    // Only protect groups that look like dynamic prompts (contain |)
    if (match.includes('|')) {
      groups.push(match);
      return placeholder(groups.length - 1);
    }
    return match;
  });

  // Apply grid-pattern removal to the text outside dynamic groups.
  for (const [pattern, replacement] of SINGULARIZE_PATTERNS) {
    pattern.lastIndex = 0;
    shielded = shielded.replace(pattern, replacement);
  }
  for (const pattern of GRID_PATTERNS) {
    pattern.lastIndex = 0;
    shielded = shielded.replace(pattern, countPatternReplacement);
  }

  // Collapse multiple spaces and trim
  shielded = shielded.replace(/\s{2,}/g, ' ').replace(/\s+([.,;!?])/g, '$1').trim();
  // Remove leading/trailing commas or periods left by stripping
  shielded = shielded.replace(/^[,.\s]+/, '').replace(/[,.\s]+$/, '').trim();

  // Reinsert dynamic prompt groups
  let result = shielded;
  for (let i = 0; i < groups.length; i++) {
    result = result.replace(placeholder(i), groups[i]);
  }

  return result;
}
