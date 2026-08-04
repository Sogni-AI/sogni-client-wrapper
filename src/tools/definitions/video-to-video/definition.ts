/**
 * Tool definition for video_to_video.
 * Based on workflow_video_to_video.mjs — WAN 2.2 Animate + LTX-2.3 V2V ControlNet.
 */

import type { ToolDefinition } from '../types.js';
import {
  LITERAL_SEEDANCE_PROMPT_OVERRIDE,
  SEEDANCE_EXPAND_PROMPT_DESCRIPTION,
  SEEDANCE_TOOL_V2V_REFERENCE_GUIDANCE,
} from '../../../contracts/toolPromptMarkers.js';

export const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "video_to_video",
    description:
      'Transform an existing video using AI. Uses WAN 2.2 Animate (move/replace) with a reference image to animate a photo with the video\'s motion or swap the video\'s subject, LTX-2.3 V2V ControlNet (canny/pose/depth/detailer) for video-only transforms, LTX-2.3 outpaint to extend/expand the video canvas (e.g. make a vertical clip widescreen) or inpaint to regenerate a masked region of the video, or Seedance V2V when the user explicitly asks to transform, upscale, enhance, restyle, or remaster an uploaded video with Seedance. Requires an uploaded video file. Use when the user wants to animate a photo with video motion, replace subjects in a video, restyle an existing video, extend or expand a video frame, regenerate part of a video, or enhance video quality.',
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: `Describe the TARGET appearance (not the transformation process). 2-4 present-tense sentences.

${LITERAL_SEEDANCE_PROMPT_OVERRIDE}

For LTX-2.3 canny/depth/pose modes, the source video preserves composition, depth, or motion. Spend prompt detail on style, atmosphere, lighting, surface texture, color palette, scale, and pacing.

Examples by mode:
- animate-move (DEFAULT — WAN 2.2 Animate Move: applies camera/motion from source video to reference image): "Smooth cinematic camera movement following the subject through the scene."
- animate-replace (WAN 2.2 Animate Replace: replaces the subject in the source video with the reference image): "The person from the reference photo performing the actions from the video."
- canny (LTX-2.3 — edge-detection restyle): "Hand-drawn watercolor anime style with soft ink edges, muted teal and coral palette, rain mist, neon reflections, warm rim light, preserving original silhouettes and composition."
- pose (LTX-2.3 — tracks skeleton, replace person): "A glossy cartoon robot with exaggerated proportions, brushed metal texture, glowing cyan joints, energetic stage lighting, preserving the original dance timing and pose."
- depth (LTX-2.3 — depth-map restyle): "A misty alpine valley at golden hour, expansive scale, volumetric haze, cool blue shadows, warm rim light, cinematic depth, lingering continuous shot."
- detailer (LTX-2.3 — enhance quality): DESCRIBE THE SOURCE, do not request changes. Append quality qualifiers only. E.g. "The same scene, ultra-sharp and clean, crisp high-resolution detail, preserving all original content, composition, and color." Avoid words like "enhanced textures", "restyled", or any new subjects/objects — they cause drift.
- seedance-v2v (BytePlus Dreamina Seedance 2.0 V2V): "Restyle the source clip in a watercolor look with soft ink edges, while preserving its motion and composition." Use natural prose; Seedance reads the reference video holistically rather than via control-net constraints, so describe target style/mood/dialogue rather than control strength.
- outpaint (LTX-2.3 — canvas extension): describe what fills the NEWLY REVEALED area around the original frame, consistent with the source scene. E.g. "The same street scene continues seamlessly into the newly revealed space — more wet asphalt, parked cars, and glowing shopfronts, matching the original lighting and perspective." Set outpaintPosition (and optionally outpaintAspectRatio); no mask needed.
- inpaint (LTX-2.3 — masked region regeneration): describe ONLY what the inpainted region should become; the rest of the frame is preserved. E.g. "A vintage red convertible parked at the curb, matching the scene's lighting and shadows." If the user supplied a mask, set maskImageIndex. If no mask was supplied, omit maskImageIndex so execution derives a mask from the source video and prompt.

Present tense. Positive phrasing. Concrete visual details.

NON-SEEDANCE POSITIVE CONSTRAINTS: For LTX-2.3 and WAN 2.2 modes, prompt is a positive prompt. Translate user avoid/no/don't constraints into affirmative production constraints instead of copying negative phrasing. Preserve exact quoted visible text when the user explicitly requests it; keep surrounding surfaces blank.

BATCH VARIATIONS: When numberOfVariations > 1, use Dynamic Prompt syntax to vary the artistic treatment while keeping control mode and structural intent consistent. Example: "transform to {watercolor with soft edges|oil painting with bold strokes|anime with clean lines} style".`,
        },
        expandPrompt: {
          type: "boolean",
          description: SEEDANCE_EXPAND_PROMPT_DESCRIPTION,
        },
        videoSourceIndex: {
          type: "number",
          description:
            "Which uploaded video to transform. OMIT this field when there is only one uploaded video — the tool auto-selects it. Only pass when you need to pick among multiple uploaded videos. Indexing: 0-based (0 = first uploaded video, 1 = second). Note: this differs from analyze_video which uses negative indices; this tool also tolerates the negative form (-1 = first uploaded) for convenience.",
        },
        controlMode: {
          type: "string",
          enum: [
            "animate-move",
            "animate-replace",
            "canny",
            "pose",
            "depth",
            "detailer",
            "outpaint",
            "inpaint",
            "seedance-v2v",
          ],
          description:
            "How the source video and (optional) reference image interact. Pick by user intent:\n" +
            '• "animate-move" (DEFAULT) — WAN 2.2 Animate Move. Applies camera movement and motion from the source video to the reference image, bringing a still photo to life. Requires sourceImageIndex.\n' +
            '• "animate-replace" — WAN 2.2 Animate Replace. Replaces the subject in the source video with the person/character from the reference image, keeping the video\'s background and motion. Requires sourceImageIndex.\n' +
            '• "canny" — LTX-2.3 edge-detection control. Best for restyling while preserving exact composition and silhouettes (e.g. "make this footage look like anime / oil painting / watercolor"). Use for subjects with crisp edges — people, objects, graphics. Video-only; no reference image needed.\n' +
            '• "pose" — LTX-2.3 skeletal tracking. Best for replacing a person while keeping their motion (e.g. "turn this dancer into a robot"). Image optional — if provided, controls appearance; otherwise the prompt drives appearance. Requires person-centric motion.\n' +
            '• "depth" — LTX-2.3 depth-map control. Best for restyling scenes with perspective, camera movement, or volumetric content (landscapes, interiors, camera pans). Preserves 3D spatial layout rather than 2D edges; more forgiving than canny when edges are noisy. Video-only.\n' +
            '• "detailer" — LTX-2.3 quality enhancement. Sharpens detail and texture WITHOUT restyling. The prompt must DESCRIBE THE ORIGINAL scene with quality qualifiers (sharp, clean, high-resolution) — never request content changes, new textures, or a new look. Pick this when the user asks to "improve quality", "enhance", "upscale", or "sharpen" without a creative transformation.\n' +
            '• "outpaint" — LTX-2.3 canvas extension. Extend or expand the video frame outward, or convert it to a new aspect ratio (e.g. "make this vertical clip widescreen", "add more space on the right", "extend the scene"). Positional and mask-free: set outpaintPosition for where the original frame sits in the expanded canvas, and optionally outpaintAspectRatio for the target shape. The prompt describes what fills the new area. Video-only.\n' +
            '• "inpaint" — LTX-2.3 masked region regeneration. Regenerate or replace a specific region of the source video while preserving the rest (e.g. "replace the billboard", "change what\'s on the table"). If the user provides an uploaded mask image, set maskImageIndex to it. If no mask is provided, omit maskImageIndex; execution derives a mask from the source video and prompt before dispatch. The prompt describes only the target inpainted region. Video-only.\n' +
            `• "seedance-v2v" — BytePlus Dreamina Seedance 2.0 video-to-video. Use only when the user explicitly asks for Seedance on the uploaded source video, such as Seedance Fast upscale, enhance, remaster, restyle, or transform. High-fidelity quality, native audio, time-coded scene control. ${SEEDANCE_TOOL_V2V_REFERENCE_GUIDANCE} Distinct from canny/depth/pose which use control-net constraints — Seedance treats the reference video holistically.\n` +
            'Canny vs depth: canny preserves silhouettes and fine outlines — pick it for subject-led scenes and graphic restyles. Depth preserves 3D structure — pick it for scenes where the camera moves or spatial layout matters more than edge fidelity. Default: "animate-move".',
        },
        negativePrompt: {
          type: "string",
          description:
            "Advanced non-Seedance only. Use this field only when the user explicitly asks to set a separate negative prompt. For ordinary avoid/no/don't constraints on LTX 2.3 or WAN 2.2, translate them into affirmative production constraints inside prompt instead; do not move them here. Do not set when controlMode is seedance-v2v or videoModel is seedance2/seedance2-mini/seedance2-fast.",
        },
        videoModel: {
          type: "string",
          enum: ["ltx23-v2v", "wan22-animate", "seedance2", "seedance2-mini", "seedance2-fast"],
          description:
            'Model selector for this video-to-video request. Usually omit; controlMode chooses the non-Seedance model. For controlMode="seedance-v2v", Seedance quality is selected only by model: use "seedance2-mini" for faster/lower-cost drafts or explicit Mini requests, use "seedance2-fast" only when the user asks for Seedance Fast / seedance-fast, and use "seedance2" for full/non-fast Seedance or 1080p/4K. Do not infer the Seedance model from Default Media Quality Fast/HQ/Pro or from 480p/720p resolution requests alone.',
        },
        generateAudio: {
          type: "boolean",
          description:
            "Whether the returned video should include generated or retained audio. Omit to include audio by default; set false when the user asks for silent output or no audio.",
        },
        targetResolution: {
          type: "number",
          description:
            'Seedance V2V only. Short-side output resolution target in pixels. Use when the user asks for a bare named resolution such as "480p", "720p", or "1080p" without exact dimensions. For Seedance V2V Mini/Fast, 480p and 720p are supported; preserve the source video shape instead of forcing landscape pixels.',
        },
        sourceImageIndex: {
          type: "number",
          description:
            'Optional index of a reference image (0-based). Required for "animate-move" and "animate-replace". Optional for "pose" (controls appearance if provided). Ignored by "canny", "depth", "detailer", "outpaint", and "inpaint".',
        },
        outpaintPosition: {
          type: "string",
          enum: ["center", "top", "bottom", "left", "right"],
          description:
            'controlMode="outpaint" only. Where the ORIGINAL frame is anchored inside the expanded canvas, which determines the direction the canvas grows: "left" anchors the original on the left and adds new space on the right; "right" adds space on the left; "top" adds space below; "bottom" adds space above; "center" expands all sides evenly. Default: "center". Pick by the user\'s direction ("extend to the right" → "left"; "make it wider"/"widescreen" → "center").',
        },
        outpaintAspectRatio: {
          type: "string",
          enum: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
          description:
            'controlMode="outpaint" only. OPTIONAL target aspect ratio for the expanded canvas (e.g. "16:9" to make a vertical clip widescreen). The canvas only grows to reach this ratio — the original content is never cropped. Omit to expand moderately in the direction implied by outpaintPosition. Only set when the user names a target shape or orientation.',
        },
        maskImageIndex: {
          type: "number",
          description:
            'controlMode="inpaint" only. Optional 0-based index of an uploaded mask IMAGE that marks the region to regenerate (white pixels = regenerate, black = preserve). Omit when the user did not provide a mask; execution will derive one from the source video and prompt. Ignored by every other controlMode.',
        },
        duration: {
          type: "number",
          description:
            'Output video duration in seconds. Range: 2-20 for WAN/LTX modes and 4-15 for controlMode="seedance-v2v". If omitted, the tool matches the uploaded source video duration when available (capped to the selected model range); otherwise it falls back to 10s for WAN Animate Move/Replace and 5s for LTX-2.3/Seedance modes. For long stitched/bulk WAN Animate Move/Replace work with no explicit per-clip length, prefer about 10s clips rather than 5s chunks. Only pass this when the user explicitly requests a different length.',
          minimum: 2,
          maximum: 20,
        },
        numberOfVariations: {
          type: "number",
          description:
            "Number of video variations to generate (1-16). Default: 1.",
          minimum: 1,
          maximum: 16,
        },
      },
      required: ["prompt"],
    },
  },
};
