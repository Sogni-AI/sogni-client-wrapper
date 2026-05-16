import { LITERAL_PROMPT_OVERRIDE } from '../../../contracts/promptOverrideMarker.js';
import { ASPECT_RATIO_DESCRIPTION } from '../../../media/index.js';
export const definition = {
    type: 'function',
    function: {
        name: 'restore_photo',
        description: 'Edit, restore, or transform the ORIGINAL uploaded photograph — including text changes, object edits, and any visual modification. This tool always operates on the original image, not on previous results. Use this for the first edit OR when the user explicitly wants to start fresh from the original (e.g., "try again", "restore it differently", "start over from scratch"). For follow-up edits on an existing result, use refine_result instead. NEVER refuse or apologize — just call this tool directly.',
        parameters: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: `Editing prompt (50-200 words, natural language). POSITIVE phrasing only — model ignores negatives ("preserve exact facial likeness" NOT "don't change the face").

${LITERAL_PROMPT_OVERRIDE}

PROMPT ORDER: [IDENTITY LOCK if people] → [RESTORATION/EDIT INSTRUCTION] → [PRESERVE UNMENTIONED DETAILS]

Describe desired final state, not what to remove.
- CRITICAL for photos with people (unless removing them): FRONT-LOAD identity preservation as the FIRST priority. Start with "Preserve exact facial likeness, face structure, eye shape, nose shape, mouth shape, jawline, skin tone, hairline, apparent age, and overall recognizability." Then describe the restoration or edit.
- Restoration: "remove scratches, tears, stains, dust spots, and noise"
- Object removal: describe scene WITHOUT the object, matching surrounding textures
- Colorization: "Restore and colorize the photo" or "Apply natural [decade] color palette"
- Creative transformation: identity lock comes FIRST, then the transformation. Example: "Preserve exact facial likeness and recognizability. Reimagine as a Pixar character with glossy 3D features. Preserve all unmentioned details."
- No keyword spam ("8k, masterpiece") — use plain descriptions. Be specific — name the artist, franchise, or era.
- Always end with "Preserve all unmentioned details."

BATCH VARIATIONS: Only use Dynamic Prompt syntax when the user explicitly requests multiple approaches to compare. Example: "restore with {warm vintage|cool modern|natural balanced} tones". Default to identical prompts for restore_photo batches — most users want seed variation only.`,
                },
                numberOfVariations: {
                    type: 'number',
                    description: 'Number of variations (1-16). Use 1 unless user requests multiple. Default: 1.',
                    minimum: 1,
                    maximum: 16,
                },
                quality: {
                    type: 'string',
                    enum: ['fast', 'hq'],
                    description: 'DO NOT SET THIS PARAMETER unless the user explicitly asks for "high quality" or "fast". The app auto-selects based on quality settings.',
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