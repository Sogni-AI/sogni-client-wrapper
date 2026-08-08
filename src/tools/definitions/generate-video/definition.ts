/**
 * Tool definition for generate_video.
 * Based on workflow_text_to_video.mjs — text-to-video without a source image.
 */

import type { ToolDefinition } from '../types.js';
import {
  GENERATE_VIDEO_SKIP_PROMPT_PROCESSING_DESCRIPTION,
  LITERAL_VIDEO_PROMPT_OVERRIDE,
  SEEDANCE_EXPAND_PROMPT_DESCRIPTION,
  SEEDANCE_TOOL_MULTIMODAL_REFERENCE_GUIDANCE,
  HAPPYHORSE_GENERATE_VIDEO_MODEL_DESCRIPTION,
} from '../../../contracts/toolPromptMarkers.js';
import { ASPECT_RATIO_DESCRIPTION } from '../../../media/index.js';

export const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "generate_video",
    description:
      'Generate a video from text or Seedance multimodal references. LTX 2.3 generates audio natively (dialogue, sounds, ambient music) — describe audio in the prompt. If the user provides exact speech, include it in double quotes; if they only imply speech, describe the performance and voice without inventing quoted words. Never use placeholders such as "while speaking", "dialogue begins", "explaining", or "final line lands". PERSONA VOICE: Only when the user explicitly asks to use/clone a registered persona voice clip, call resolve_personas first, then set voicePersonaName to select which persona\'s voice clip to use. Do not set voicePersonaName for ordinary character dialogue or inferred voices; describe those voices in the prompt for native LTX audio. For cross-persona narration (e.g. David narrates a video of Aleyna), resolve both personas and set voicePersonaName to the narrator only if that registered voice was requested. Persona voice requires ltx23 (WAN 2.2 does not support voice identity). For non-Seedance syncing to a specific song or audio track, use sound_to_video instead. For non-Seedance animation from a locked source photo, use animate_photo. Do NOT use for My Personas unless generating a Seedance reference-based video — standard persona videos use resolve_personas → edit_image → animate_photo. SEEDANCE DEFAULT: For seedance2, seedance2-mini, seedance2-fast, or seedance2-5, default to exactly one video (4-15s on 2.0/Mini/Fast, 4-30s on seedance2-5) unless the user explicitly asks for multiple separate outputs. Multiple beats, shots, or scene descriptions in one up-to-15s Seedance prompt are still one video. If the user requests one continuous Seedance video longer than 15s, prefer seedance2-5, which renders up to 30s in a single call; beyond 30s (or on 2.0/Mini/Fast) preserve the requested total duration in the prompt/context and let chat orchestration split it into supported segment renders and stitch them instead of clamping it to a short excerpt. Uploaded/generated storyboard, shot-sheet, or trailer-concept images used as Seedance references should become one Seedance generate_video call by default; do not extract panels with edit_image and do not animate the storyboard sheet with LTX unless the user explicitly asks for separate non-Seedance clips. Seedance loose image, video, and audio references go through this tool; do not use animate_photo sourceImageIndex/frameRole/endImageIndex for Seedance. If an uploaded video is the source clip to transform, upscale, enhance, restyle, or remaster, use video_to_video with controlMode="seedance-v2v" instead of generate_video referenceVideoIndices. If the uploaded audio is the primary sync target, lip-sync target, or requested as sound-to-video/audio-sync, use sound_to_video with videoModel="seedance2-mini" instead of this tool unless the user asks for full Seedance. Use referenceAudioIndices here only when audio is a loose reference under an image/video-anchored Seedance shot. For Seedance, every image — first frame, last frame, or loose reference — is passed through referenceImageIndices (auto-uploaded as referenceImageUrls). Anchor frame intent in the prompt with @Image tags such as "Use @Image1 as the opening shot reference. Begin the video with a composition, subject placement, lighting, mood, and camera framing that closely match @Image1." (or @Image2 as the final shot reference). For seamless-loop or "first frame and last frame identical" requests with a single uploaded image, anchor it explicitly as both: "Use @Image1 as both the first frame and last frame so the video loops cleanly back to the opening composition." Assign each useful @Image/@Video/@Audio tag a role. APPROVED STORYBOARD PRODUCTION: When the user asks for a production workflow from an approved storyboard, the chat orchestrator should use the durable CampaignStoryboard contract: render the composite board, audit it, generate per-scene GPT Image 2 keyframes, then render Seedance scene clips and stitch them. Do not replace that with a generic storyboard-reference video unless the user asks for a fast draft. PARTIAL VIDEO EDITS: Do NOT call generate_video to re-render an existing rendered/uploaded video just to change part of it (the bumper, the intro, the end card, a single scene, the last few seconds, etc.). Use replace_video_segment for that — it preserves the unchanged portion, keeps the original audio outside the replaced window, and costs far less. Likewise use extend_video to add new time to the end without rewriting the rest. If the request is vague, ask about vision/mood/style first. Only call once you have clear creative intent.',
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: `Write one flowing paragraph like a cinematographer describing a shot. Present tense, specific natural language. Longer clips need longer prompts; close-ups need more detail than wide shots.

${LITERAL_VIDEO_PROMPT_OVERRIDE}

STRUCTURE: shot/style → subject (age, clothing, hairstyle, distinguishing details) → environment, lighting, atmosphere → action beat by beat → camera movement → audio and dialogue.

CAST CONTINUITY: For screenplay, script, storyboard, commercial, series, or other longer-form video tasks with recurring characters, use stable character names and repeat the same visual anchors every time they appear (age range, build, hairstyle, outfit silhouette, color palette, signature prop/accessory, posture, voice). Do not rename, merge, redesign, or drift characters between scenes unless the user asks.

MOTION PACING: Scale complexity to duration. <=6s: 1 main action beat + 1 simple camera move. Around 10s: 2-3 clear action beats + 1 camera move. >10s: up to 4 action beats in clear sequence. Prefer fewer readable beats over dense micro-actions, especially in short clips.

BLOCKING: Direct the layout like scene blocking. State left/right placement, foreground/background, facing toward/away, and relative distance when multiple subjects or important objects are involved.

ACTION: Drive motion with concrete verbs. Specify who moves, what moves, how it moves, and what the camera does. Avoid generic phrases like "comes alive."

DIALOGUE: Put user-provided spoken lines in double quotes. For screenplay-style or longer-form tasks, prefix each spoken line with a stable speaker tag outside the quotes, e.g. CHARACTER: "We made it." Break long speech into short quoted phrases with acting beats between them (gestures, pauses, glances). If the user asks for speech but provides no exact words, describe the visible delivery, voice quality, and emotion without inventing quoted dialogue; ask only when exact wording is the point of the request. Never write placeholders such as "while speaking", "dialogue begins", "explaining", or "final line lands". Show emotion through visible behavior — not "she is sad", instead "she looks down, pauses, and her voice cracks". QUOTING RULE: ONLY use double quotes for spoken dialogue. Never quote on-screen text, overlay text, titles, captions, signs, or any visual text — describe them without quotes.

STORYBOARD TEXT: For storyboard references, structural headings, section numbers, slide titles, panel titles, and captions may become short audio-only narration/voiceover or key-message beats, but they are not subtitles, title cards, lower thirds, or visible overlays unless the user explicitly asks for visible text/on-screen text/title card/subtitle/lower third/signage/CTA. Do not concatenate storyboard labels into run-on voiceover; use separate brief phrases with pauses.

AUDIO: Prompt sound intentionally — voice quality, volume, room tone, ambience, music, weather, footsteps. Include language or accent if relevant. Useful voice/volume anchors: whisper, mutter, shout, scream, energetic announcer, resonant voice with gravitas, distorted radio-style, robotic monotone, childlike curiosity.

CAMERA: Cinematic terms — close-up, tracking shot, dolly in, handheld, slow arc, static frame. Describe movement relative to subject.

For specific characters (movies, TV): describe visual appearance — don't rely on names alone.

For complex/creative scenes (characters, dialogue, skits): capture the full creative intent. The system auto-expands into a detailed prompt.

AVOID: Vague prompts, too many characters at once, conflicting lighting logic, readable text or logos, abstract emotions with no visible behavior, rigid numeric constraints (exact angles, counts, speeds).

NON-SEEDANCE POSITIVE CONSTRAINTS: For videoModel="ltx23" or "wan22", prompt is a positive prompt. Translate user avoid/no/don't constraints into affirmative production constraints instead of copying negative phrasing. Preserve exact quoted visible text or dialogue when the user explicitly requests it; keep surrounding surfaces blank.

BATCH VARIATIONS: When numberOfVariations > 1, use Dynamic Prompt syntax. This is one Sogni project with multiple jobs, so prefer it when all outputs share the same references, model, duration, dimensions, and generation parameters and only prompt text varies. Lock in any camera/subject/style the user specified, vary the rest. Example: "slow dolly in on a city street {at dawn with golden light|during a rainstorm|at night with neon reflections}".`,
        },
        expandPrompt: {
          type: "boolean",
          description: SEEDANCE_EXPAND_PROMPT_DESCRIPTION,
        },
        skipPromptProcessing: {
          type: "boolean",
          description: GENERATE_VIDEO_SKIP_PROMPT_PROCESSING_DESCRIPTION,
        },
        duration: {
          type: "number",
          description:
            "Video duration in seconds. Default: 5. Range: 2-30; the usable window is per-model and the host clamps to it: LTX 2.3 and WAN accept 2-20, Seedance 2.0/Mini/Fast accept 4-15, and Seedance 2.5 accepts 4-30 — only seedance2-5 can use the 16-30s part of this range. Use when the user explicitly requests a specific length.",
          minimum: 2,
          maximum: 30,
        },
        negativePrompt: {
          type: "string",
          description:
            "Advanced LTX/WAN only. Use this field only when the user explicitly asks to set a separate negative prompt. MiniMax H3 has no negative-prompt input; put requested exclusions in prompt. Do not set for MiniMax H3, Seedance, or HappyHorse.",
        },
        videoModel: {
          type: "string",
          enum: [
            "ltx23",
            "wan22",
            "seedance2",
            "seedance2-mini",
            "seedance2-fast",
            "seedance2-5",
            "minimax-h3-t2v",
            "minimax-h3-t2v-turbo",
            "happyhorse-1.1-t2v",
            "happyhorse-1.1-i2v",
            "happyhorse-1.1-r2v",
            "minimax-h3-r2v",
          ],
          description:
            'Video model. "ltx23" (default): LTX 2.3 with native audio. "wan22": quick simple motion without audio. "minimax-h3-t2v": standard 20-step MiniMax H3 text-to-video; "minimax-h3-t2v-turbo": 4-step Turbo text-to-video. Both use native audio, fixed 24fps, 5.17-15.08s, and a 768p-class 32px-grid canvas; use animate_photo for H3 image-conditioned modes. Base and Turbo T2V/I2V/FLF2V prompts use the exact ordered fields integrated_multimodal_description, overall_soundscape, and non_diegetic_music; I2V/FLF2V prepend the official alignment line. "minimax-h3-r2v": MiniMax H3 reference-to-video with up to 9 images, 3 videos, and 3 audios (12 files total); at least one visual reference (image or video) is required and audio alone is invalid. Ref2VA has no Turbo variant. Select references with referenceImageIndices/referenceVideoIndices/referenceAudioIndices and address them with the official <Subject N>/<Picture N>/<Video N>/<Audio N> semantics. Seedance quality is selected only by model: use "seedance2-mini" for Seedance 2.0 Mini or faster/lower-cost 720p iteration, use "seedance2-fast" only when the user explicitly asks for Seedance Fast / seedance-fast, and use "seedance2" for the full Seedance 2.0 model, explicit non-fast/full-quality requests, 1080p/4K requests, or generated/uploaded storyboard images unless the user explicitly asks for a draft, Mini, or the fast model. Do not use Default Media Quality Fast/HQ/Pro or targetResolution to represent Seedance quality. "seedance2-5": Seedance 2.5, the newest Seedance generation — 480p and 720p ONLY (it cannot render 1080p or 4K), 4-30s per clip at a fixed 24 fps, native audio, first-and-last-frame conditioning, and a much larger reference budget than the 2.0 family: up to 30 images, 10 videos, and 10 audios, with no more than 30 reference media files in total. Choose "seedance2-5" when the user asks for Seedance 2.5, wants a single continuous Seedance clip longer than 15s (2.5 renders up to 30s in one call instead of being split and stitched), or wants a first-and-last-frame Seedance transition. Keep "seedance2" for 1080p/4K requests, which Seedance 2.5 cannot satisfy. ' +
            SEEDANCE_TOOL_MULTIMODAL_REFERENCE_GUIDANCE +
            ' ' +
            HAPPYHORSE_GENERATE_VIDEO_MODEL_DESCRIPTION,
        },
        generateAudio: {
          type: "boolean",
          description:
            "Whether the returned video should include generated/native audio. Omit to include audio by default; set false only when the user explicitly asks for silent output or no audio. Supported by LTX, MiniMax H3, and Seedance; not supported by WAN or HappyHorse.",
        },
        referenceImageIndices: {
          type: "array",
          items: { type: "number" },
          description:
            "Seedance or MiniMax H3 r2v image references. Use negative indices for uploaded images and non-negative indices for generated image results. Seedance uses @Image tags. H3 Ref2VA requires at least one visual reference—an image or video—and uses the official <Subject N>/<Picture N> semantics; these are loose references, not locked first frames.",
        },
        referenceVideoIndices: {
          type: "array",
          items: { type: "number" },
          description:
            'Seedance or MiniMax H3 r2v loose video references. Use negative indices for uploaded videos and non-negative indices for generated video results. Seedance uses @Video tags; H3 uses <Video 1>, <Video 2>, and so on in selection order. A video may be the only H3 Ref2VA visual reference. Do not use this for source-video transforms; use video_to_video instead.',
        },
        referenceAudioIndices: {
          type: "array",
          items: { type: "number" },
          description:
            'Seedance or MiniMax H3 r2v loose audio references. Use negative indices for uploaded audio files and non-negative indices for generated audio results. Seedance uses @Audio tags; H3 uses <Audio 1>, <Audio 2>, and so on in selection order. H3 Ref2VA audio may accompany an image or video, but audio alone is invalid.',
        },
        width: {
          type: "number",
          description:
            'Video width in pixels. LTX 2.3: 640-3840. WAN: 480-1536. Default resolution depends on model and quality tier: LTX Fast about 720p and High/Pro about 1080p; WAN Fast uses 480p short side and High/Pro uses 720p short side. Set width only when the user specifies an exact width or orientation-qualified exact pixels. A bare named resolution like "720p resolution" is a short-side target, not an instruction to make landscape 1280x720. If the user gives only one exact dimension, set only that dimension and preserve/infer the sensible aspect ratio. User-requested exact dimensions override the default media quality. Mappings when orientation is explicit: 480p landscape=854x480, 480p portrait=480x854, 720p landscape=1280x720, 720p portrait=720x1280, 1080p landscape=1920x1080, 1080p portrait=1080x1920, 4K landscape=3840x2160. Non-step values are accepted when in bounds; LTX snaps to the nearest 64px step and WAN snaps to the nearest 16px step internally, so do not ask the user to adjust by a few pixels.',
        },
        height: {
          type: "number",
          description:
            'Video height in pixels. LTX 2.3: 640-3840. WAN: 480-1536. Set height only when the user specifies an exact height or orientation-qualified exact pixels. A bare named resolution like "720p resolution" is a short-side target; do not convert it to landscape dimensions unless the user says landscape/horizontal/widescreen. If the user gives only one exact dimension, set only that dimension and preserve/infer the sensible aspect ratio. User-requested exact dimensions override Default Media Quality, including Pro. Non-step values are accepted when in bounds; LTX snaps to the nearest 64px step and WAN snaps to the nearest 16px step internally, so do not ask the user to adjust by a few pixels.',
        },
        targetResolution: {
          type: "number",
          description:
            'Short-side video resolution target in pixels. Use when the user asks for a bare named resolution such as "480p", "720p", "1080p", "2160p", or "4K" without exact pixels or an output orientation. This is resolution only, not a Seedance quality tier: Seedance quality is selected by videoModel ("seedance2", "seedance2-mini", or "seedance2-fast"). Seedance 2.0 full supports 4K; Seedance Mini, Fast, and Seedance 2.5 support 480p/720p only, so never set 1080p or 4K for "seedance2-5". Do not set targetResolution from Default Media Quality Fast/HQ/Pro. If omitted for Seedance, the host uses the selected model default. This preserves/inherits the current video shape instead of forcing landscape. Do NOT set width, height, or exact-pixel aspectRatio for bare named resolution requests. If the user says "720p portrait", "720p landscape", "4K portrait", or "4K landscape", use exact width/height/aspectRatio instead.',
        },
        numberOfVariations: {
          type: "number",
          description:
            "Number of variations (1-16). Use with one Dynamic Prompt branch for multiple prompt-only takes that share the same references, model, duration, dimensions, and parameters. This creates one Sogni project with multiple jobs. Use 1 unless the user explicitly requests multiple separate video outputs. For Seedance, default to 1 unless the user explicitly requests separate outputs.",
          minimum: 1,
          maximum: 16,
        },
        aspectRatio: {
          type: "string",
          description: ASPECT_RATIO_DESCRIPTION,
        },
        voicePersonaName: {
          type: "string",
          description:
            'ONLY when the user explicitly requests a registered/reference persona voice clip. Name of the persona whose voice clip to use as referenceAudioIdentity. Set this when the narrator/speaker is a different persona than the one described in the video (e.g. "David" narrates a scene featuring Aleyna), or to explicitly select a requested voice when multiple personas with voice clips are resolved. Do NOT set this for ordinary character dialogue, inferred voices, or personas without a voice clip — LTX 2.3 generates voice natively from the text prompt instead. Requires ltx23.',
        },
      },
      required: ["prompt"],
    },
  },
};
