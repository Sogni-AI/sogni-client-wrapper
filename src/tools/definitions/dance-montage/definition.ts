/**
 * Tool definition for dance_montage.
 * Enum and description generated from DANCE_PRESETS (single source of truth).
 */

import type { ToolDefinition } from '../types.js';
import { DANCE_PRESETS } from './dances.js';

const danceEnum = DANCE_PRESETS.map(d => d.id);

const danceParamDesc = DANCE_PRESETS
  .map(d => `"${d.id}": ${d.title} (${d.description}, max ${d.maxDuration}s).`)
  .join(' ');

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'dance_montage',
    description:
      'REQUIRED for ALL dance video requests — do NOT use animate_photo or generate_video for dances. Uses real choreography reference videos to transfer dance motion onto a photo via WAN 2.2 Animate Move. Output is always 9:16 480p portrait. Do NOT use this for bare TikTok/Reels/Shorts/social-video requests unless the user explicitly asks for a dance, choreography, dance trend, or named dance preset. UPLOADED PHOTO: When the user asks for a dance "using this photo" or "with this photo", call dance_montage directly on the uploaded photo; do NOT call edit_image/generate_image first just to prepare, stylize, restyle, reframe, make full-body, or reinterpret the subject. Words that identify a dance preset or vibe, such as "Barbie", "Metric", "Black Sheep", "Rasputin", or "TikTok dance trend", are NOT requests for image prep. Only create image prep first when the user explicitly asks for a new look, outfit, variation set, multiple characters, or loaded persona identity preservation. IMAGE PREP: When generating images for dance (via edit_image or generate_image), ALWAYS use aspectRatio="9:16". CRITICAL — IMAGE COUNT: Generate exactly 1 image (numberOfVariations=1) for dance requests UNLESS the user explicitly asks for variations, different looks, or multiple characters (e.g. "4 different outfits", "alternate between a cat and a dog"). A single consistent image is used for ALL video segments to ensure visual consistency in the final stitched dance video. When the user DOES request multiple variations, batch them into ONE tool call using numberOfVariations + Dynamic Prompts — never split into multiple batches. PERSONAS: When personas are loaded, ALWAYS generate images via edit_image FIRST (using the persona reference photos for identity preservation), then call dance_montage — it will automatically use all generated images. Never use imagePrompt for persona dance requests — edit_image with persona context photos produces far better likeness. USING GENERATED IMAGES: When images have already been generated earlier in the conversation, simply call dance_montage WITHOUT sourceImageIndex — all previously generated images are used automatically as alternating montage segments. Do NOT tell the user to "upload" images that were already generated. Requires at least one uploaded photo, previously generated image, or loaded personas. Best results with photos of people.',
    parameters: {
      type: 'object',
      properties: {
        dance: {
          type: 'string',
          enum: danceEnum,
          description: `Which dance choreography to use. ${danceParamDesc}.`,
        },
        duration: {
          type: 'number',
          description:
            'Total video duration in seconds. Range: 8-30. OMIT this parameter unless the user explicitly requests a specific length — the handler defaults to the chosen dance\'s reference video length (capped at 30s) so the full choreography plays through. Each dance has its own max based on its reference video; the handler caps automatically.',
          minimum: 8,
          maximum: 30,
        },
        sourceImageIndex: {
          type: 'number',
          description:
            'Which previously generated result image to use (0-based index). Use -1 for the original uploaded image. When omitted, all previously generated images are used automatically as alternating montage segments.',
        },
        imagePrompt: {
          type: 'string',
          description:
            'Creative style/look for auto-generated images when no pre-generated images are available and no personas are loaded. For persona requests, always generate images via edit_image first — it preserves identity far better. This is a fallback only. If omitted, uses a default full-body portrait style.',
        },
        singleClip: {
          type: 'boolean',
          description:
            'When true, renders the entire dance as one continuous clip (no stitching). Only works for durations ≤ 20s. Use when the user explicitly asks for a single video or one unbroken clip. Default: false (splits into segments for faster concurrent rendering).',
        },
      },
      required: ['dance'],
    },
  },
};
