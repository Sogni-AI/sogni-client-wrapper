/**
 * Tool definition for animate_photo.
 * Extracted from the superapp's chatTools.ts ANIMATE_PHOTO_TOOL.
 */

import type { ToolDefinition } from '../types.js';
import {
  ANIMATE_PHOTO_SKIP_PROMPT_PROCESSING_DESCRIPTION,
  LITERAL_VIDEO_PROMPT_OVERRIDE,
} from '../../../contracts/toolPromptMarkers.js';
import { ASPECT_RATIO_DESCRIPTION } from '../../../media/index.js';

export const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "animate_photo",
    description:
      'Animate a photo into video with motion, audio, and dialogue using LTX 2.3 or WAN 2.2. Do NOT use this tool for seedance2, seedance2-mini, or seedance2-fast. Seedance 2.0 media references must go through generate_video with referenceImageIndices/referenceVideoIndices/referenceAudioIndices and @Image/@Video/@Audio role text in the prompt; for seamless-loop Seedance requests with one uploaded image, the prompt should anchor it as both the first frame and last frame. LTX/WAN NOTE: uploaded audio files are not loose references for ltx23/wan22; use sound_to_video when uploaded audio is the primary sync target. DANCE REQUESTS ("make them dance", "do the X dance"): use dance_montage — NOT this tool. LTX 2.3 generates audio natively — describe dialogue and ambient sounds directly in the prompt (do NOT pre-generate audio for this tool). If the user provides exact speech, include it in double quotes; if they only imply speech, describe the performance and voice without inventing quoted words. Avoid placeholders such as "while speaking", "dialogue begins", "explaining", or "final line lands". PERSONA VOICE: Only when the user explicitly asks to use/clone a registered persona voice clip, call resolve_personas first, then set voicePersonaName to select which persona\'s voice clip to use. Do not set voicePersonaName for ordinary character dialogue or inferred voices; describe those voices in the prompt for native LTX audio. For cross-persona narration (e.g. David narrates a video of Aleyna), resolve both personas and set voicePersonaName to the narrator only if that registered voice was requested. Persona voice requires ltx23 because WAN 2.2 does not support voice identity. PERSONA PIPELINE: For persona videos, ensure an image of the persona exists before calling animate_photo. The standard pipeline is: resolve_personas → edit_image → animate_photo. If a suitable persona image already exists (user uploaded one, a prior edit_image/generate_image result, OR the user explicitly says to use the Persona image/reference photo directly), skip edit_image and animate directly. After resolve_personas, this tool can animate the injected persona image directly when that explicit direct-use instruction is given. Auto-uses the latest result image (from any prior tool) unless sourceImageIndex is set. Supports start-frame (default), end-frame, and start+end interpolation modes for LTX/WAN — ask the user which frame role their image should play if they mention "end frame", "last frame", or provide two images. FIRST+LAST FRAME WORKFLOW: When the user wants a non-Seedance video using two different scenes as start and end frames, prefer generating both images in a single generate_image/edit_image call with numberOfVariations=2 and Dynamic Prompts, then call animate_photo with frameRole="both", sourceImageIndex=0, endImageIndex=1. If the user explicitly wants separately created frame assets, preserve that staged instruction while keeping indices correct. In frameRole="both", the handler automatically inspects both images and upgrades the base prompt into a scene-aware smooth transition prompt, so your prompt should state the desired transition style, action, dialogue, and audio rather than trying to list every visible object. If the request is vague, analyze the image first and suggest 2-3 specific animation ideas tailored to what you see. Call once you have clear creative intent. N-VIDEOS PATTERN: Avoid sequential animate_photo calls for N outputs. For a single fixed source/end frame where only prompt text varies, use sourceImageIndex + numberOfVariations=N + one Dynamic Prompt branch in prompt so Sogni submits one project with multiple jobs. If the user explicitly asks for Dynamic Prompt or Dynamic Template syntax, prefer this one-project path whenever every output uses the same source/end frames and shared settings, even if they also ask to stitch the completed clips afterward. Use sourceImageIndices/prompts for multi-segment stitched non-Seedance video, different source/end assets, different audio windows, different durations/dimensions, isolated retry lifecycle, or other per-output parameters. sourceImageIndices supports up to 16 entries; there is NO 3-clip cap, so do not split one planned batch into "first 3" and "remaining" calls. For a dialogue-heavy total-duration request with no explicit per-clip duration, prefer 15-second clips on ltx23 (30s total = 2 clips × 15s) and 10-second clips on wan22 (60s total on wan22 = 6 clips × 10s; do NOT pick 4 clips × 15s on wan22 — the wan22 worker rejects clips longer than 10s). Multi-source flavors: (A) SHARED CONTENT — when all N clips have the same dialogue/motion but different source visuals (different scenes, outfits, environments, persona looks), first generate N distinct images via ONE edit_image/generate_image call with numberOfVariations=N + Dynamic Prompts {|}, then call animate_photo with sourceImageIndices=[start..start+N-1] and a single shared `prompt`. If all segments intentionally reuse the primary uploaded image and only prompt text varies, use sourceImageIndex=-1, frameRole="both" if requested, endImageIndex=-1 if requested, numberOfVariations=N, and one Dynamic Prompt branch in prompt. Each branch option must be a complete natural-language motion prompt; do not include "clip N", source-frame boilerplate, "overall request context", or instructions to follow the user request. For a long scripted/dialogue/storyboard video from a single supplied/uploaded image where each segment needs isolated exact dialogue or per-segment wiring, use sourceImageIndices=[-1,-1,...] and per-clip prompts. Only set frameRole="both" and endImageIndex=-1 when the user explicitly says the same uploaded/source/original image should be both the first and last frame of every segment. If the user requests generated source images first, honor that image stage, then animate the generated result indices. When using generated scene keyframes and each clip should begin and end on its own scene image for stitching, call animate_photo with frameRole="both" and sourceImageIndices=[start..end] but OMIT endImageIndex; do not set endImageIndex=-1 unless every source is the uploaded image. (B) PER-CLIP CONTENT — when source/end asset wiring or other per-output parameters differ, pass BOTH sourceImageIndices AND `prompts` (an array of N strings, one per clip) in the same single call. Each prompt must independently anchor the visible characters, scene action, camera, audio, exact screenplay-style speaker tags, and exact quoted dialogue for that segment. If you just wrote or displayed a script/table, copy the exact dialogue lines into the corresponding per-clip prompts; do not summarize them as speech activity. If using named speaker tags with any multi-person reference image or generated scene keyframe, include one explicit cast map in each prompt that binds each name to visible position, clothing, and props/actions, e.g. SPEAKER_A = left person holding a prop; SPEAKER_B = center person with tablet; SPEAKER_C = right person near table. Do not also describe the same people again as generic man/boy/girl/woman/character subjects. For screenplay, storyboard, commercial, series, or other longer-form tasks with recurring characters, preserve the same character names and repeated visual anchors in every per-clip prompt where each character appears. Use the standard single-source path (numberOfVariations only) when the user wants motion variety from a single fixed frame.',
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: `I2V RULE: Do NOT re-describe what is visible in the input image. Focus on the transition from stillness — motion, expression changes, what happens next, camera movement, and sound.

${LITERAL_VIDEO_PROMPT_OVERRIDE}

STRUCTURE: "[How the subject begins to move]. [What changes next]. [Camera behavior]. [Audio]."

MOTION PACING: Scale complexity to duration. <=6s: 1 main action beat + 1 simple camera move. Around 10s: 2-3 clear action beats + 1 camera move. >10s: up to 4 action beats in clear sequence. Prefer fewer readable beats over dense micro-actions, especially in short clips.

BLOCKING: Use the image as the anchor and direct only meaningful layout changes. If the prompt introduces multiple moving subjects, state left/right placement, foreground/background, facing toward/away, and relative distance.

ACTION: One flowing paragraph. Describe motion beat by beat with temporal connectors ("as", "then", "while"). Specify who moves, what moves, how it moves, and what the camera does. One main thread — avoid too many actions at once or generic phrases like "comes alive."

DIALOGUE: Put user-provided spoken lines in double quotes. For screenplay-style or longer-form tasks, prefix each spoken line with a stable speaker tag outside the quotes, e.g. CHARACTER: "We made it." Break long speech into short quoted phrases with acting beats between them (gestures, pauses, glances). If the user asks for speech but provides no exact words, describe the visible delivery, voice quality, and emotion without inventing quoted dialogue; ask only when exact wording is the point of the request. Never write placeholders such as "while speaking", "dialogue begins", "explaining", or "final line lands". Show emotion through visible behavior, not labels. LTX 2.3 generates audio natively. QUOTING RULE: ONLY use double quotes for spoken dialogue. Never quote on-screen text, overlay text, titles, captions, signs, or any visual text — describe them without quotes (e.g. bold white text reading CONGRATULATIONS overlays the lower third).

AUDIO: Prompt sound intentionally — voice quality, volume, room tone, ambience, music, weather, footsteps. Include language or accent if relevant. Useful voice/volume anchors: whisper, mutter, shout, scream, energetic announcer, resonant voice with gravitas, distorted radio-style, robotic monotone, childlike curiosity.

CAMERA: Cinematic terms — slow push-in, static tripod, handheld, slow arc, dolly in. Describe movement relative to subject.

For first+last-frame transitions (frameRole="both"), write a concise base request for the transition style, action, dialogue, and audio. The handler will inspect both frames and expand it into a scene-aware prompt that maps visible objects and subjects between frames.

For specific characters (movies, TV): describe visual appearance — don't rely on names alone.

For complex/creative scenes (characters talking, skits), capture full creative intent — system auto-expands into detailed prompt.

AVOID: Re-describing the image, vague prompts, too many actions at once, abstract emotions without visible behavior, rigid numeric constraints, readable text or logos.

POSITIVE CONSTRAINT TRANSLATION: For LTX 2.3 and WAN 2.2, the prompt field is a positive prompt. Translate user avoid/no/don't constraints into affirmative production constraints instead of copying negative phrasing. Examples: "no people in background" -> single subject focus with an empty background; "no text" -> clean blank surfaces; "don't make it blurry" -> crisp sharp focus; "no weird hands" -> natural anatomically consistent hands; "no mouth movement, no talking, no lip syncing" -> silent expression-only physical performance with facial motion independent of speech timing; "don't change the room" -> the same room and layout remain consistent; "keep flames consistent" -> flame and ember movement remains consistent with the source scene. Preserve exact quoted visible text or dialogue when the user explicitly requests it, and keep surrounding surfaces blank. For Dynamic Prompt batches, put these translated shared constraints before the "{...}" branch so every variation inherits them.

WAN 2.2 ("wan22"): 30-150 words, subtle natural movements. Motion-only visual prompt; omit soundtrack, ambience, room tone, music, hums, sighs, spoken words, voice, and SFX cues because WAN does not generate audio.

BATCH VARIATIONS: When numberOfVariations > 1, use Dynamic Prompt syntax to vary motion, camera, or atmosphere while preserving the user's specified elements. This is one Sogni project with multiple jobs, so prefer it when all outputs share the same source/end frames and generation parameters and only prompt text varies. Example: "{gentle sway with drifting embers|slow paw wave with a tiny head tilt|small hop with soft fur motion}".`,
        },
        expandPrompt: {
          type: "boolean",
          description:
            "Optional. Set false only for pipeline-authored prompts that should bypass model-specific prompt expansion.",
        },
        skipPromptProcessing: {
          type: "boolean",
          description: ANIMATE_PHOTO_SKIP_PROMPT_PROCESSING_DESCRIPTION,
        },
        videoModel: {
          type: "string",
          enum: ["ltx23", "wan22", "minimax-h3-i2v", "minimax-h3-flf2v"],
          description:
            'Which video model to use. "ltx23" (default): LTX 2.3 with native audio. "wan22": quick simple motion without audio, up to 10s. "minimax-h3-i2v": MiniMax H3 from one first frame. "minimax-h3-flf2v": MiniMax H3 between required first and last frames; use frameRole="both" and provide the end frame. H3 generates native audio at fixed 24fps for 5.17-15.08s and has no negative-prompt input. Do not set Seedance here; use generate_video with Seedance references.',
        },
        negativePrompt: {
          type: "string",
          description:
            "Advanced LTX/WAN only. Use this field only when the user explicitly asks to set a separate negative prompt. MiniMax H3 has no negative-prompt input; put requested exclusions in prompt.",
        },
        generateAudio: {
          type: "boolean",
          description:
            "Whether the returned video should include generated/native audio. Omit to include audio by default; set false only when the user explicitly asks for silent output or no audio. Supported by LTX and MiniMax H3; ignored by audio-less WAN.",
        },
        duration: {
          type: "number",
          description:
            'Video duration in seconds. Default: 5. Per-model range: ltx23 = 2-20s, wan22 = 2-10s, MiniMax H3 = 5.17-15.08s snapped to its valid frame grid. For longer totals, batch clips via sourceImageIndices.',
        },
        targetResolution: {
          type: "number",
          description:
            'Short-side video resolution target in pixels. Use when the user asks for a bare named resolution such as "480p", "720p", or "1080p" without exact pixels or an output orientation. This preserves the source image aspect ratio. Do NOT set width, height, or exact-pixel aspectRatio for bare named resolution requests. If the user says "720p portrait" or "720p landscape", use exact-pixel aspectRatio instead.',
        },
        sourceImageIndex: {
          type: "number",
          description:
            'Which image to use as the START frame. Use 0-based non-negative indices for generated result images. Use negative indices for uploaded images: -1 = first/primary upload, -2 = second upload, -3 = third upload, etc. Omit to auto-select: uses the latest result for "start"/"end" modes, or the FIRST result for "both" mode. IMPORTANT: When frameRole is "both", set this to the start frame image index and endImageIndex to the end frame image index.',
        },
        sourceImageIndices: {
          type: "array",
          items: { type: "number" },
          minItems: 1,
          maxItems: 16,
          description:
            'Array of source frame indices — one video is generated per entry as its own SDK project, all running in PARALLEL. Use this when outcomes need different source images, different end frames, isolated retry lifecycle, or other per-clip asset wiring/parameters. If every outcome uses the same source/end frames and only prompt text differs, prefer sourceImageIndex with numberOfVariations=N and one Dynamic Prompt branch in `prompt` so Sogni creates one project with multiple jobs. Use 0-based non-negative result indices for generated images. Use negative indices for uploaded images: -1 = first/primary upload, -2 = second upload, -3 = third upload, etc. Repeating -1 is allowed for true multi-project workflows that intentionally reuse the same uploaded image while varying per-clip assets or parameters. By default all projects share the `prompt`/`voice`/`duration`, but you can pass `prompts` (array) to give each clip its own dialogue/motion when multi-project fan-out is required. Avoid sequential animate_photo calls for N outputs. Do NOT combine with `numberOfVariations` or `sourceImageIndex`. Use frameRole="end" with sourceImageIndices only when the user explicitly says the repeated uploaded/generated image is the last/end frame for each clip and no first/start frame should be supplied; in that case omit endImageIndex/endImageIndices because each sourceImageIndices entry is the end frame. You MAY combine with frameRole="both" when clips need start and end frames. For adjacent transition chains across generated images, use sourceImageIndices=[start..end-1] and endImageIndices=[start+1..end] so N images produce N-1 transition clips. If the uploaded/original image starts the chain and generated results are the remaining frames, use sourceImageIndices=[-1,start..end-1] and endImageIndices=[start..end]. If the user supplies multiple uploaded images as the actual keyframe sequence, use adjacent negative uploaded indices, e.g. 5 uploaded images become sourceImageIndices=[-1,-2,-3,-4], endImageIndices=[-2,-3,-4,-5], frameRole="both", prompts length 4, then stitch_video. If the user specifies transition motion, camera behavior, actions, dialogue, or audio, copy those instructions into every corresponding per-clip prompt; only invent a generic smooth transition when the user does not specify one. If the user asks for a seamless loop or final transition from the last image back to the first, close the chain by including the last image as a source and the first image as the final end frame, e.g. 5 uploaded images become sourceImageIndices=[-1,-2,-3,-4,-5], endImageIndices=[-2,-3,-4,-5,-1]. For generated scene keyframes that should each loop to themselves, omit endImageIndex/endImageIndices so each source image is also its own end frame. Set endImageIndex=-1 only when every sourceImageIndices entry is also -1 and every segment reuses the first uploaded image. Range: 1–16 indices. For generated image batches, values MUST be read from the latest edit_image/generate_image tool result\'s `startIndex` field. If startIndex=3 and 4 images were generated in that batch, pass `[3,4,5,6]` (NOT `[0,1,2,3]`). Do NOT assume generated indices start at 0 — they don\'t if there are prior results in the conversation.',
        },
        prompts: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 16,
          description:
            'Per-clip prompts for multi-project fan-out — use when each output needs different source/end assets, isolated retry lifecycle, or other per-clip wiring/parameters. If all outputs share the same source/end frames and only prompt text differs, put the full per-output prompts in ONE Dynamic Prompt branch in `prompt` and set numberOfVariations=N instead. When this field is required, it MUST be paired with `sourceImageIndices` and have the SAME length. Each entry is the full prompt for the corresponding source image. If a clip has speech, include exact spoken words in double quotes with stable speaker tags; do NOT write placeholders like "while speaking", "dialogue begins", "explaining", or "final line lands". If you just wrote a script/table/storyboard, copy that clip\'s exact dialogue into this prompt. When named speakers appear in a multi-person reference image or generated keyframe, start each entry with one compact cast map that binds names to visible anchors before dialogue, e.g. Cast map: SPEAKER_A is the left person holding the prop; SPEAKER_B is the center person with the tablet; SPEAKER_C is the right person near the table. Then move directly into action/dialogue; do not describe those same people again as generic man/boy/girl/woman/character subjects. This prevents speaker tags from being assigned to the wrong visible character. When set, the top-level `prompt` parameter is ignored (still required by the schema — just pass any descriptive string, e.g. a brief summary of the batch). Example: 4 source images of a couple, "make each video have a different joke" → sourceImageIndices=[0,1,2,3], prompts=["Cast map: She is the left woman in the blue dress; He is the right man in the gray jacket. She says: \\"Why did the scarecrow win an award?\\" He grins.", "Cast map: He is the right man in the gray jacket; She is the left woman in the blue dress. He says: \\"Because he was outstanding in his field!\\" She laughs.", "...", "..."]. Omit this whenever the same source/end assets and parameters can be represented as one Dynamic Prompt batch.',
        },
        numberOfVariations: {
          type: "number",
          description:
            "Number of variations (1-16). Use this with one Dynamic Prompt branch when the user explicitly requests multiple prompt-only takes from the same source/end frames. This creates one Sogni project with multiple jobs. Use 1 unless the user explicitly requests multiple separate video outputs; use sourceImageIndices/prompts instead only when assets or parameters differ per output.",
          minimum: 1,
          maximum: 16,
        },
        aspectRatio: {
          type: "string",
          description: ASPECT_RATIO_DESCRIPTION,
        },
        frameRole: {
          type: "string",
          enum: ["start", "end", "both"],
          description:
            'How to use the source image(s). "start" (default): first frame. "end": last frame. "both": interpolate between first and last frames. For end-frame fan-out, use frameRole="end" with sourceImageIndices. MiniMax H3 i2v supports only "start"; MiniMax H3 flf2v requires "both" plus an end image. For single clips using "both", set sourceImageIndex and endImageIndex; fan-out can use matching sourceImageIndices/endImageIndices.',
        },
        endImageIndex: {
          type: "number",
          description:
            'Which image to use as the END frame. Use 0-based non-negative indices for generated results. Use negative indices for uploaded images: -1 = first/primary upload, -2 = second upload, -3 = third upload, etc. For a single frameRole="both" transition between two different images, set this to the desired end frame. For sourceImageIndices fan-out where each generated keyframe should also be its own last frame, OMIT this field. Use a shared uploaded endImageIndex only when every sourceImageIndices entry is also an uploaded image; otherwise use endImageIndices for per-clip end frames.',
        },
        endImageIndices: {
          type: "array",
          items: { type: "number" },
          minItems: 1,
          maxItems: 16,
          description:
            'Per-clip END frame indices for sourceImageIndices fan-out. Use ONLY with frameRole="both". Length MUST exactly match sourceImageIndices. Use 0-based non-negative indices for generated results and negative indices for uploaded images (-1 first upload, -2 second upload, etc.). Use this for transition chains between generated images, e.g. 5 generated images at indices [0,1,2,3,4] should become 4 transition clips with sourceImageIndices=[0,1,2,3], endImageIndices=[1,2,3,4], prompts length 4, duration as requested, then stitch_video. If the chain starts on the uploaded image and continues through generated results [0,1,2,3], use sourceImageIndices=[-1,0,1,2] and endImageIndices=[0,1,2,3]. If the user supplies 5 uploaded images as the sequence, use sourceImageIndices=[-1,-2,-3,-4] and endImageIndices=[-2,-3,-4,-5]. If the user requests a seamless loop or final transition back to the first image, append that loop closure: sourceImageIndices=[-1,-2,-3,-4,-5], endImageIndices=[-2,-3,-4,-5,-1]. Do NOT also set endImageIndex when using this.',
        },
        voicePersonaName: {
          type: "string",
          description:
            'ONLY when the user explicitly requests a registered/reference persona voice clip. Name of the persona whose voice clip to use as referenceAudioIdentity. Set this when the narrator/speaker is a different persona than the one shown in the video (e.g. "David" narrates a video of Aleyna), or to explicitly select a requested voice when multiple personas with voice clips are resolved. Do NOT set this for ordinary character dialogue, inferred voices, or personas without a voice clip — LTX 2.3 generates voice natively from the text prompt instead. Requires ltx23.',
        },
      },
      required: ["prompt"],
    },
  },
};
