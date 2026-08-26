/**
 * Tool definition for video_to_video.
 * Based on workflow_video_to_video.mjs — WAN 2.2 Animate + LTX 2.5/2.3 V2V controls.
 */

import type { ToolDefinition } from '../types.js';
import {
  LITERAL_SEEDANCE_PROMPT_OVERRIDE,
  SEEDANCE_EXPAND_PROMPT_DESCRIPTION,
  SEEDANCE_TOOL_V2V_REFERENCE_GUIDANCE,
} from '../../../contracts/toolPromptMarkers.js';

const WAN3_VIDEO_MODEL_GUIDANCE =
  '"wan3.0-video" is Alibaba Wan 3: one canonical premium-vendor model for text-to-video, first-frame and first+last-frame animation, loose multimodal references, audio-driven generation, and uploaded-video editing/extension. It renders 2-30s at fixed 30 fps with optional native audio, supports 480p/720p/1080p and 16:9/4:3/1:1/3:4/9:16, accepts up to 10 reference images, 5 reference videos, and 5 reference audios, and uses plain per-type prompt labels Image 1, Video 1, and Audio 1. Do not send negativePrompt. Use animate_photo for native first/last frames, generate_video for text or loose references, sound_to_video when audio is the primary driver, and video_to_video with controlMode="seedance-v2v" for edits or extensions.';

export const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "video_to_video",
    description:
      'Transform an existing video using AI. Uses WAN 2.2 Animate (move/replace) with a reference image, LTX 2.5 V2V controls by default (canny/pose/depth/detailer plus distilled inpaint/outpaint), LTX 2.3 as rollback, or Seedance V2V when explicitly requested. LTX 2.5 Fast, HQ, and Pro use the release-validated official Distilled workflow for canny/pose/depth/detailer/inpaint/outpaint; Dev is not publicly routed until upstream publishes and Sogni validates an official ComfyUI Dev recipe. Requires an uploaded video file. Use when the user wants to animate a photo with video motion, replace subjects, restyle footage, extend its canvas, regenerate a region, or enhance quality. Wan 3 source-video editing and continuation uses videoModel="wan3.0-video" with controlMode="seedance-v2v".',
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: `Describe the TARGET appearance (not the transformation process). 2-4 present-tense sentences.

${LITERAL_SEEDANCE_PROMPT_OVERRIDE}

For LTX 2.5 or 2.3 canny/depth/pose modes, the source video preserves composition, depth, or motion. Spend prompt detail on style, atmosphere, lighting, surface texture, color palette, scale, and pacing. LTX 2.5 Fast, HQ, and Pro use the release-validated official Distilled workflow for canny/pose/depth/detailer/inpaint/outpaint; Dev is not publicly routed until upstream publishes and Sogni validates an official ComfyUI Dev recipe.

Examples by mode:
- animate-move (DEFAULT — WAN 2.2 Animate Move: applies camera/motion from source video to reference image): "Smooth cinematic camera movement following the subject through the scene."
- animate-replace (WAN 2.2 Animate Replace: replaces the subject in the source video with the reference image): "The person from the reference photo performing the actions from the video."
- canny (LTX 2.5 default; LTX 2.3 rollback — edge-detection restyle): "Hand-drawn watercolor anime style with soft ink edges, muted teal and coral palette, rain mist, neon reflections, warm rim light, preserving original silhouettes and composition."
- pose (LTX 2.5 or LTX 2.3 — tracks skeleton and transfers the reference-image subject): "A glossy cartoon robot from the reference image performs the source video's motion, with brushed metal texture, glowing cyan joints, and energetic stage lighting." This mode requires a reference image as well as the source video.
- depth (LTX 2.5 default; LTX 2.3 rollback — depth-map restyle): "A misty alpine valley at golden hour, expansive scale, volumetric haze, cool blue shadows, warm rim light, cinematic depth, lingering continuous shot."
- detailer (LTX 2.5 default; LTX 2.3 rollback — enhance quality): DESCRIBE THE SOURCE, do not request changes. Append quality qualifiers only. E.g. "The same scene, ultra-sharp and clean, crisp high-resolution detail, preserving all original content, composition, and color." Avoid words like "enhanced textures", "restyled", or any new subjects/objects — they cause drift.
- seedance-v2v (BytePlus Dreamina Seedance 2.0 V2V): "Restyle the source clip in a watercolor look with soft ink edges, while preserving its motion and composition." Use natural prose; Seedance reads the reference video holistically rather than via control-net constraints, so describe target style/mood/dialogue rather than control strength.
- outpaint (LTX 2.5 default; LTX 2.3 rollback — canvas extension): describe what fills the NEWLY REVEALED area around the original frame, consistent with the source scene. E.g. "The same street scene continues seamlessly into the newly revealed space — more wet asphalt, parked cars, and glowing shopfronts, matching the original lighting and perspective." Set outpaintPosition (and optionally outpaintAspectRatio); no mask needed.
- inpaint (LTX 2.5 default; LTX 2.3 rollback — masked region regeneration): describe ONLY what the inpainted region should become; the rest of the frame is preserved. E.g. "A vintage red convertible parked at the curb, matching the scene's lighting and shadows." If the user supplied a mask, set maskImageIndex. If no mask was supplied, omit maskImageIndex so execution derives a mask from the source video and prompt.

Present tense. Positive phrasing. Concrete visual details.

NON-SEEDANCE POSITIVE CONSTRAINTS: For LTX 2.5, LTX 2.3, and WAN 2.2 modes, prompt is a positive prompt. Translate user avoid/no/don't constraints into affirmative production constraints instead of copying negative phrasing. Preserve exact quoted visible text when the user explicitly requests it; keep surrounding surfaces blank.

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
            "How the source video and reference image interact. Pick by user intent:\n" +
            '• "animate-move" (DEFAULT) — WAN 2.2 Animate Move. Applies camera movement and motion from the source video to the reference image, bringing a still photo to life. Requires sourceImageIndex.\n' +
            '• "animate-replace" — WAN 2.2 Animate Replace. Replaces the subject in the source video with the person/character from the reference image, keeping the video\'s background and motion. Requires sourceImageIndex.\n' +
            '• "canny" — LTX 2.5 (default) or 2.3 edge-detection control. Best for restyling while preserving exact composition and silhouettes. Video-only.\n' +
            '• "pose" — LTX 2.5 (default) or 2.3 skeletal tracking. Best for transferring the person/character from a required reference image while keeping the source video\'s motion. Requires sourceImageIndex (or the sole available reference image).\n' +
            '• "depth" — LTX 2.5 (default) or 2.3 depth-map control. Best for scenes with perspective, camera movement, or volumetric content. Video-only.\n' +
            '• "detailer" — LTX 2.5 (default) or 2.3 quality enhancement. Describe the original scene with quality qualifiers and do not request content changes.\n' +
            '• "outpaint" — distilled LTX 2.5 (default) or LTX 2.3 canvas extension. Set outpaintPosition and optionally outpaintAspectRatio; Pro/dev is not supported for this mode.\n' +
            '• "inpaint" — distilled LTX 2.5 (default) or LTX 2.3 masked region regeneration. Set maskImageIndex when supplied; Pro/dev is not supported for this mode.\n' +
            `• "seedance-v2v" — BytePlus Dreamina Seedance 2.0 video-to-video. Use only when the user explicitly asks for Seedance on the uploaded source video, such as a Seedance upscale, enhance, remaster, restyle, or transform. High-fidelity quality, native audio, time-coded scene control. ${SEEDANCE_TOOL_V2V_REFERENCE_GUIDANCE} Distinct from canny/depth/pose which use control-net constraints — Seedance treats the reference video holistically.\n` +
            'Canny vs depth: canny preserves silhouettes and fine outlines — pick it for subject-led scenes and graphic restyles. Depth preserves 3D structure — pick it for scenes where the camera moves or spatial layout matters more than edge fidelity. Default: "animate-move".\n\nUse seedance-v2v with videoModel="wan3.0-video" for Wan 3 source-video editing or continuation; describe Video 1 as the source in the prompt.',
        },
        negativePrompt: {
          type: "string",
          description:
            "Advanced non-Seedance only. Use this field only when the user explicitly asks to set a separate negative prompt. For ordinary avoid/no/don't constraints on LTX 2.3 or WAN 2.2, translate them into affirmative production constraints inside prompt instead; do not move them here. Do not set when controlMode is seedance-v2v or videoModel is seedance2/seedance2-mini/seedance2-5.\n\nWan 3 has no negativePrompt request field; do not set this for wan3.0-video.",
        },
        videoModel: {
          type: "string",
          enum: ["ltx25-v2v", "ltx23-v2v", "wan22-animate", "seedance2", "seedance2-mini", "seedance2-5", "wan3.0-video"],
          description:
            'Model selector for this video-to-video request. Usually omit: non-Seedance controls default to "ltx25-v2v"; use "ltx23-v2v" only for rollback. LTX 2.5 Fast, HQ, and Pro currently use the release-validated official Distilled workflow for canny, pose, depth, detailer, inpaint, and outpaint. Dev is not publicly routed until upstream publishes and Sogni validates an official ComfyUI Dev recipe. For controlMode="seedance-v2v", Seedance quality is selected only by model: use "seedance2-mini" for faster/lower-cost drafts and use "seedance2" for full-quality Seedance or 1080p/4K. "seedance2-5" supports 480p/720p, 4-30s at 24 fps, native audio, and first/last-frame conditioning; keep "seedance2" for 1080p/4K. ' +
            WAN3_VIDEO_MODEL_GUIDANCE,
        },
        generateAudio: {
          type: "boolean",
          description:
            "Whether the returned video should include generated or retained audio. Omit to include audio by default; set false when the user asks for silent output or no audio.",
        },
        targetResolution: {
          type: "number",
          description:
            'Seedance or Wan 3 V2V only. Short-side output resolution target in pixels. Use when the user asks for a bare named resolution such as "480p", "720p", "1080p", "2160p", or "4K" without exact dimensions. Seedance V2V full supports 4K; Seedance V2V Mini, Fast, and Seedance 2.5 support 480p and 720p only, so never set 1080p or 4K for "seedance2-5". Wan 3 supports exactly 480p, 720p, and 1080p. Preserve the source video shape instead of forcing landscape pixels.',
        },
        sourceImageIndex: {
          type: "number",
          description:
            'Optional 0-based reference-image index. Required for "animate-move", "animate-replace", and "pose" when more than one image is available; the sole available image may be auto-selected. LTX pose always dispatches both the source video and a reference image. Ignored by "canny", "depth", "detailer", "outpaint", and "inpaint".',
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
            'Output video duration in seconds. Per-model range: WAN 2.2/LTX modes = 2-20s; Wan 3 = 2-30s subject to input-video plus output duration staying at or below 30s; Seedance 2.0 and Mini = 4-15s; Seedance 2.5 = 4-30s. If omitted, the tool matches the uploaded source video duration when available (capped to the selected model range); otherwise it falls back to 10s for WAN Animate Move/Replace and 5s for LTX/Seedance/Wan 3 modes. For long stitched/bulk WAN Animate Move/Replace work with no explicit per-clip length, prefer about 10s clips rather than 5s chunks. Only pass this when the user explicitly requests a different length.',
          minimum: 2,
          maximum: 30,
        },
        smartDuration: {
          type: "boolean",
          description:
            "Wan 3 only. Let Wan 3 choose 2-30 output seconds. Do not also set duration; input plus output must stay within the provider's 30-second limit. Sogni reserves 30 seconds and settles down to actual duration.",
        },
        wan3TaskType: {
          type: "string",
          enum: ["edit", "extend"],
          description:
            'Wan 3 only. Use "edit" to transform the source or "extend" to continue it. For extension, explicitly describe the intended continuation.',
        },
        ratio: {
          type: "string",
          enum: ["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16"],
          description: 'Wan 3 only. Output ratio. Use "adaptive" to let the provider choose from the source; omit to use the provider default.',
        },
        referenceFileUrl: {
          type: "string",
          description:
            "Wan 3 only. One public HTTPS document URL for additional edit/extension context (DOCX/DOC/XLSX/XLS/PPTX/PPT/PDF/TXT/KEY/PAGES/NUMBERS/Markdown, up to 100 MB; PDF/DOCX/DOC/PPTX/PPT/KEY/PAGES up to 50 pages). Mutually exclusive with referenceLinkUrl.",
        },
        referenceLinkUrl: {
          type: "string",
          description:
            "Wan 3 only. One public HTTPS webpage URL for additional edit/extension context. Mutually exclusive with referenceFileUrl.",
        },
        watermark: {
          type: "boolean",
          description: "Wan 3 only. Add Alibaba's visible watermark. Defaults to false.",
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

definition.function.description +=
  ' Wan 3 source-video editing and continuation uses videoModel="wan3.0-video" with controlMode="seedance-v2v".';
