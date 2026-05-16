/**
 * Tool-definition prompt markers.
 *
 */
import { LITERAL_PROMPT_OVERRIDE } from './promptOverrideMarker.js';

export const LITERAL_VIDEO_PROMPT_OVERRIDE =
  `${LITERAL_PROMPT_OVERRIDE} Set skipPromptProcessing=true; for Seedance also set expandPrompt=false.`;

export const SEEDANCE_EXPAND_PROMPT_DESCRIPTION =
  'Seedance only. Whether to run the shared Seedance prompt shaper before dispatch. Defaults to true; set false only when the user explicitly asks to submit the compact prompt directly or not modify the prompt.';

export const GENERATE_VIDEO_SKIP_PROMPT_PROCESSING_DESCRIPTION =
  'Bypass automatic prompt shaping/refinement and voice-identity prompt formatting so the prompt text is sent unchanged to the video model. Set true ONLY when the user explicitly says not to modify/rewrite/enhance/expand/change/improve the prompt, or to use/send it exactly, verbatim, or as-is, AND the provided prompt already satisfies the tool requirements. Continue to set non-prompt parameters such as model, duration, count, aspect ratio, and seed. For Seedance literal prompt requests, also set expandPrompt=false. Do not set for ordinary underspecified requests.';

export const ANIMATE_PHOTO_SKIP_PROMPT_PROCESSING_DESCRIPTION =
  'Bypass automatic prompt shaping/refinement, image-description anchoring, transition-prompt rewriting, and voice-identity prompt formatting so the prompt text is sent unchanged to the video model. Set true ONLY when the user explicitly says not to modify/rewrite/enhance/expand/change/improve the prompt, or to use/send it exactly, verbatim, or as-is, AND the provided prompt already satisfies the tool requirements. Continue to set non-prompt parameters such as source indices, frameRole, model, duration, count, and aspect ratio. For Seedance literal prompt requests, also set expandPrompt=false. Do not set for ordinary underspecified requests.';

export const LITERAL_SEEDANCE_PROMPT_OVERRIDE =
  `${LITERAL_PROMPT_OVERRIDE} For Seedance, set expandPrompt=false.`;

export const SEEDANCE_TOOL_MULTIMODAL_REFERENCE_GUIDANCE = `Seedance supports multimodal loose reference assets: images (up to 9), videos (up to 3), and audios (up to 3), with no more than 12 asset files total. Use @Image1/@Video1/@Audio1 style references in creative briefs when assigning roles. Assign every useful reference asset a role and prefer positive preservation constraints. If an uploaded video is the source clip to transform, upscale, enhance, restyle, or remaster, use video_to_video with controlMode="seedance-v2v" instead of generate_video referenceVideoIndices.`;

export const SEEDANCE_TOOL_V2V_REFERENCE_GUIDANCE = `Seedance V2V reads @Video1 holistically. Use it for restyling, motion transfer, extension, subject replacement, or scene transformation, and assign @Video1 a clear role such as source clip, camera movement, action timing, edit rhythm, or continuation anchor.`;

export const SEEDANCE_TOOL_AUDIO_REFERENCE_GUIDANCE = `For Seedance audio-reference prompts, preserve exact spoken dialogue when the user supplied it, and assign @Image1/@Audio1 roles. If the user asks for speech without words, describe the vocal performance without inventing quoted dialogue. Treat lip-sync, voice cloning, and real-human reference behavior as provider-sensitive rather than guaranteed.`;
