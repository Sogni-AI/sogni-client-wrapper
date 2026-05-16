import { LITERAL_PROMPT_OVERRIDE } from '../../../contracts/promptOverrideMarker.js';
import { ASPECT_RATIO_DESCRIPTION } from '../../../media/index.js';
export const definition = {
    type: 'function',
    function: {
        name: 'refine_result',
        description: 'Make ANY edit to an existing result image. This is the DEFAULT tool for follow-up requests after results exist. Use whenever the user wants to modify, adjust, or build upon a previous result — including brightness, color, sharpening, object removal, background changes, further restoration, or any other edit. If the user does not specify which image, use the most recent result (index 0 if only one result, or the last result the user referenced). Only use restore_photo instead if the user explicitly wants to start over from the original upload.',
        parameters: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: `Targeted refinement prompt for Qwen Image Edit 2511 (50-150 words, natural language sentences).

${LITERAL_PROMPT_OVERRIDE}

PROMPT ORDER: [IDENTITY LOCK if people] → [SPECIFIC CHANGE] → [PRESERVE EVERYTHING ELSE]

Rules:
- Use POSITIVE phrasing only. The model ignores negatives ("preserve exact facial likeness" NOT "don't change the face").
- Describe ONLY what needs to change (the delta). The base image already contains most of the truth — do not rewrite the entire image.
- Be specific about what to change: "warmer skin tones", "cooler shadows", "sharper facial features", "more natural greens".
- For creative refinements: lean into specifics — "add more dramatic Rembrandt lighting", "push the colors more toward Warhol neon pop", "make the anime eyes larger and more expressive", "add more superhero energy with glowing effects".
- CRITICAL for photos with people: FRONT-LOAD identity preservation before the edit. Start with "Preserve exact facial likeness, face structure, eye shape, nose shape, mouth shape, jawline, skin tone, hairline, apparent age, and overall recognizability."
- ALWAYS end with "Preserve all unmentioned details" to prevent unwanted changes.

BATCH VARIATIONS: Only use Dynamic Prompt syntax when the user explicitly asks to explore different refinement directions. Example: "refine with {more contrast|softer lighting|richer colors}". Default to identical prompts for refine_result batches.`,
                },
                sourceImageIndex: {
                    type: 'number',
                    description: 'Which result image to refine (0-based index). If the user specifies an image number, use that index. If omitted, the latest result is used automatically. When multiple results exist and the user previously referenced a specific one, use that one.',
                },
                numberOfVariations: {
                    type: 'number',
                    description: 'Number of variations (1-16). Use 1 unless user requests multiple. Default: 1.',
                    minimum: 1,
                    maximum: 16,
                },
                scale: {
                    type: 'number',
                    enum: [1, 1.5, 2, 3, 4],
                    description: 'Output scale multiplier relative to the source image size. 1 = same resolution as source (default). Use higher values when user asks to upscale, enlarge, make bigger, or increase resolution. Small images (<480px) are automatically upscaled to at least 480px regardless of this setting. Default: 1.',
                },
                aspectRatio: {
                    type: 'string',
                    description: ASPECT_RATIO_DESCRIPTION,
                },
            },
            required: ['prompt'],
        },
    },
};
//# sourceMappingURL=definition.js.map