/**
 * Tool-definition prompt markers.
 *
 */
import { LITERAL_PROMPT_OVERRIDE } from './promptOverrideMarker.js';

export const LITERAL_VIDEO_PROMPT_OVERRIDE =
  `${LITERAL_PROMPT_OVERRIDE} Set skipPromptProcessing=true; for Seedance or Wan 3 also set expandPrompt=false.`;

export const SEEDANCE_EXPAND_PROMPT_DESCRIPTION =
  'Seedance and Wan 3 only. Whether to expand the prompt before dispatch. Defaults to true. For Wan 3, a successful Sogni expansion disables Alibaba prompt_extend to prevent a second rewrite; false disables both expansion layers so exact prompts remain exact.';

export const GENERATE_VIDEO_SKIP_PROMPT_PROCESSING_DESCRIPTION =
  'Bypass automatic prompt shaping/refinement and voice-identity prompt formatting so the prompt text is sent unchanged to the video model. Set true ONLY when the user explicitly says not to modify/rewrite/enhance/expand/change/improve the prompt, or to use/send it exactly, verbatim, or as-is, AND the provided prompt already satisfies the tool requirements. Continue to set non-prompt parameters such as model, duration, count, aspect ratio, and seed. For Seedance or Wan 3 literal prompt requests, also set expandPrompt=false. Do not set for ordinary underspecified requests.';

export const ANIMATE_PHOTO_SKIP_PROMPT_PROCESSING_DESCRIPTION =
  'Bypass automatic prompt shaping/refinement, image-description anchoring, transition-prompt rewriting, and voice-identity prompt formatting so the prompt text is sent unchanged to the video model. Set true ONLY when the user explicitly says not to modify/rewrite/enhance/expand/change/improve the prompt, or to use/send it exactly, verbatim, or as-is, AND the provided prompt already satisfies the tool requirements. Continue to set non-prompt parameters such as source indices, frameRole, model, duration, count, and aspect ratio. For Seedance or Wan 3 literal prompt requests, also set expandPrompt=false. Do not set for ordinary underspecified requests.';

export const LITERAL_SEEDANCE_PROMPT_OVERRIDE =
  `${LITERAL_PROMPT_OVERRIDE} For Seedance or Wan 3, set expandPrompt=false.`;

export const SEEDANCE_TOOL_MULTIMODAL_REFERENCE_GUIDANCE = `Seedance supports multimodal loose reference assets: images (up to 9), videos (up to 3), and audios (up to 3), with no more than 12 asset files total. Use @Image1/@Video1/@Audio1 style references in creative briefs when assigning roles. Assign every useful reference asset a role and prefer positive preservation constraints. If an uploaded video is the source clip to transform, upscale, enhance, restyle, or remaster, use video_to_video with controlMode="seedance-v2v" instead of generate_video referenceVideoIndices.`;

export const SEEDANCE_TOOL_V2V_REFERENCE_GUIDANCE = `Seedance V2V reads @Video1 holistically. Use it for restyling, motion transfer, extension, subject replacement, or scene transformation, and assign @Video1 a clear role such as source clip, camera movement, action timing, edit rhythm, or continuation anchor.`;

export const SEEDANCE_TOOL_AUDIO_REFERENCE_GUIDANCE = `For Seedance audio-reference prompts, preserve exact spoken dialogue when the user supplied it, and assign @Image1/@Audio1 roles. If the user asks for speech without words, describe the vocal performance without inventing quoted dialogue. Treat lip-sync, voice cloning, and real-human reference behavior as provider-sensitive rather than guaranteed.`;

export const HAPPYHORSE_TOOL_REFERENCE_GUIDANCE = `HappyHorse 1.1 takes image references only and renders a native synchronized audio track (always on; do not set generateAudio or a negative prompt). Pick the model by mode: happyhorse-1.1-t2v for text-to-video (no reference image), happyhorse-1.1-i2v for image-to-video from a single first frame, and happyhorse-1.1-r2v for reference-to-video with 1 to 9 reference images. For r2v, tag the images in the prompt as [Image 1]…[Image 9] and assign each a clear role. HappyHorse does not accept reference videos or reference audios.`;

export const HAPPYHORSE_GENERATE_VIDEO_MODEL_DESCRIPTION =
  'Alibaba HappyHorse 1.1 video models (third-party vendor — requires Premium Spark). Select by mode: "happyhorse-1.1-t2v" for text-to-video, "happyhorse-1.1-i2v" for image-to-video from one first-frame image, and "happyhorse-1.1-r2v" for reference-to-video with up to 9 reference images. Resolutions 720P and 1080P; duration 3-15 seconds at 24 fps; native synchronized audio is always generated (do not set generateAudio or negativePrompt). Supported aspect ratios: 16:9, 9:16, 1:1, 4:3, 3:4, 4:5, 5:4, 9:21, 21:9. ' +
  HAPPYHORSE_TOOL_REFERENCE_GUIDANCE;
