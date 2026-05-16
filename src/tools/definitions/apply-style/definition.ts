/**
 * Tool definition for apply_style.
 * Extracted from the superapp's chatTools.ts APPLY_STYLE_TOOL.
 */

import type { ToolDefinition } from '../types.js';
import { LITERAL_PROMPT_OVERRIDE } from '../../../contracts/promptOverrideMarker.js';
import { ASPECT_RATIO_DESCRIPTION } from '../../../media/index.js';

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'apply_style',
    description:
      'Apply an artistic style, era-specific look, or creative transformation to a photo. Use when the user wants to change the visual style (e.g., "make it look like the 70s", "oil painting style", "vintage polaroid look"). Can handle any creative transformation. One style per call. IMPORTANT: When previous results exist, this tool automatically uses the LATEST result image unless you specify a different sourceImageIndex or the user explicitly says "original". So just call it without sourceImageIndex for follow-up requests.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: `Style prompt for Qwen Image Edit 2511 (50-200 words, natural language sentences).

${LITERAL_PROMPT_OVERRIDE}

PROMPT ORDER: [IDENTITY LOCK if people] → [STYLE TRANSFER INSTRUCTION] → [PRESERVE UNMENTIONED DETAILS]

Rules:
- Use POSITIVE phrasing only. The model ignores negatives ("preserve exact facial likeness" NOT "don't change the face").
- Transfer the visual STYLE ONLY, not the identity. Borrow palette, texture, contrast behavior, and stylistic treatment — NOT face structure.
- Reference known art styles, artists, and franchises BY NAME to anchor the style — be specific, never generic.
- Describe specific visual characteristics: brushstrokes, color palette, texture, composition approach, mood.
- For era looks: describe the photographic qualities of that era (e.g., "warm faded Kodachrome tones with soft vignette, typical of 1970s amateur photography").
- CRITICAL for photos with people: FRONT-LOAD identity preservation BEFORE the style instruction. Start with "Preserve exact facial likeness, face structure, eye shape, nose shape, mouth shape, jawline, skin tone, hairline, apparent age, and overall recognizability." Then describe the style. End with "Keep the subject recognizable as the same person. Maintain exact positioning, poses, and composition."
- Go bold with pop culture and iconic styles: "Andy Warhol pop art with bold neon screen-print colors", "Banksy stencil street art with gritty urban textures", "Studio Ghibli watercolor with soft pastoral warmth", "Pixar 3D render with glossy skin and exaggerated features", "Tim Burton gothic with pale skin and dark spiraling backgrounds", "Van Gogh Starry Night with thick impasto swirls and vibrant blues", "Takashi Murakami superflat with psychedelic flowers and bold outlines".
- Always end with "Preserve the subject's identity, pose, and composition."`,
        },
        sourceImageIndex: {
          type: 'number',
          description:
            'Which result image to apply the style to (0-based index). Omit to use the latest result automatically (or the original if no results exist). Only set explicitly when the user specifies a particular image number or explicitly says "original" (use -1 for original).',
        },
        scale: {
          type: 'number',
          enum: [1, 1.5, 2, 3, 4],
          description:
            'Output scale multiplier relative to the source image size. 1 = same resolution as source (default). Use higher values when user asks to upscale, enlarge, make bigger, or increase resolution. Small images (<480px) are automatically upscaled to at least 480px regardless of this setting. Default: 1.',
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
