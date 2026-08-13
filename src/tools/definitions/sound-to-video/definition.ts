/**
 * Tool definition for sound_to_video.
 * Based on workflow_sound_to_video.mjs — audio-driven video generation.
 */

import type { ToolDefinition } from '../types.js';
import {
  LITERAL_SEEDANCE_PROMPT_OVERRIDE,
  SEEDANCE_EXPAND_PROMPT_DESCRIPTION,
  SEEDANCE_TOOL_AUDIO_REFERENCE_GUIDANCE,
} from '../../../contracts/toolPromptMarkers.js';
import { ASPECT_RATIO_DESCRIPTION } from '../../../media/index.js';

export const definition: ToolDefinition = {
  type: "function",
  function: {
    name: "sound_to_video",
    description:
      'Generate video synchronized to audio. Use when the user has uploaded an audio file (mp3, wav, m4a, flac) and the audio is the primary sync target, especially uploaded-audio-only workflows. Also use after generate_music ("turn that song into a video", "make a music video from that"). Auto-detects generated audio from generate_music if no audio file is uploaded. Seedance animate_photo/generate_video can also attach uploaded audio as a loose @Audio reference when an image or video reference anchors the request; use this tool instead when the soundtrack itself should drive the video. If the user provides a reference image, use ltx25-ia2v by default (ltx23-ia2v is rollback); for lip-sync with a face image, use wan-s2v; if no image, use ltx25-a2v by default (ltx23-a2v is rollback). If the user wants dialogue/audio WITHOUT pre-existing audio, use animate_photo instead (LTX 2.5 and LTX 2.3 generate audio natively). Note: Persona voice clips from resolve_personas are NOT used by this tool — for persona voice identity in video, use animate_photo or generate_video with videoModel="ltx23" because LTX 2.5 has no compatible ID-LoRA. LONG AUDIO ON SEEDANCE: Seedance 2.0, Mini, and Fast cap each clip at 15s; Seedance 2.5 renders up to 30s in one call, so prefer seedance2-5 for 16-30s audio instead of splitting. When the user uploads audio longer than the per-clip cap of the selected model and Seedance is selected (seedance2, seedance2-mini, seedance2-fast, or seedance2-5), do NOT clamp to 15s and drop the rest — split the run into multiple sound_to_video calls in the same turn (one per 15s segment, so a 20s audio becomes two clips: audioStart=0 duration=15, then audioStart=15 duration=5) and finish with a single stitch_video call referencing the resulting clip indices in order with audioIndex pointing at the same uploaded audio so the stitched output carries the full original soundtrack. LTX/WAN models accept up to 20s per clip, so single-call is fine for them.',
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: `Describe the video like a cinematographer. Let the audio define timing — use the prompt for visual interpretation. One flowing paragraph, present tense, specific natural language.

${LITERAL_SEEDANCE_PROMPT_OVERRIDE}

STRUCTURE: shot/style and scale → subject → environment, lighting, color, texture, atmosphere → visual action synced to audio → camera movement. For LTX 2.3 image+audio mode, do not re-describe static details already visible in the reference image; focus on motion, action, camera, and how the image responds to the audio.

MOTION PACING: Scale complexity to duration. <=6s: 1 main visual beat + 1 simple camera move. Around 10s: 2-3 clear beats + 1 camera move. >10s: up to 4 beats in clear sequence. Let the audio define timing, but avoid stacking subject, camera, and environment motion in short clips.

BLOCKING: Direct layout when it affects the shot: left/right placement, foreground/background, facing direction, and relative distance between subjects.

LIP-SYNC: Shot framing, speaker's appearance and setting, physical performance synced to audio — gestures, expressions, jaw movement between phrases. Include acting beats.

MUSIC VISUALIZATION: Visual style, environment, and how elements react to rhythm and energy.

AUDIO-REACTIVE: Motion and visual changes that correspond to sounds in the track.

LTX VOCABULARY: camera (tracking, dolly, pan, tilt, handheld, static frame), lighting/atmosphere (golden hour, neon glow, dramatic shadows, fog, rain, smoke, reflections), scale/pacing (expansive, epic, intimate, claustrophobic, slow motion, time-lapse, lingering shot, continuous shot), style/genre (film noir, painterly, cyberpunk, stop-motion, claymation, 2D/3D animation, hand-drawn, fantasy, thriller, experimental film).

AVOID: Vague prompts, too many competing visual elements, abstract descriptions without visible behavior, rigid numeric constraints, readable text or logos. QUOTING RULE: ONLY use double quotes for spoken dialogue. Never quote on-screen text, overlay text, titles, captions, signs, or any visual text — describe them without quotes.

NON-SEEDANCE POSITIVE CONSTRAINTS: For ltx25-ia2v, ltx25-a2v, ltx23-ia2v, ltx23-a2v, and wan-s2v, prompt is a positive prompt. Translate user avoid/no/don't constraints into affirmative production constraints instead of copying negative phrasing. Preserve exact quoted visible text or dialogue when the user explicitly requests it; keep surrounding surfaces blank.

BATCH VARIATIONS: When numberOfVariations > 1, use Dynamic Prompt syntax to vary the visual interpretation while keeping audio sync intent consistent. This is one Sogni project with multiple jobs, so prefer it when all outputs share the same audio source/window, image source, model, duration, dimensions, and parameters and only prompt text varies. Example: "{abstract neon visualization|nature scene with swaying trees|urban street with rain} synced to the beat".`,
        },
        expandPrompt: {
          type: "boolean",
          description: SEEDANCE_EXPAND_PROMPT_DESCRIPTION,
        },
        negativePrompt: {
          type: "string",
          description:
            "Advanced LTX 2.5/LTX 2.3/WAN only. The LTX A2V and IA2V workflows accept this separate negative prompt. Use it only when the user explicitly asks to set one. Do not set for Seedance.",
        },
        audioSourceIndex: {
          type: "number",
          description:
            "Index of the uploaded audio file to use (0-based, from uploaded files list). If only one audio file is uploaded, use 0. If no audio was uploaded but generate_music was used earlier, omit this — the tool will automatically find the generated audio.",
        },
        sourceImageIndex: {
          type: "number",
          description:
            "Optional index of an uploaded image to use as the starting frame (0-based). Required for lip-sync models (WAN S2V). For audio-only-to-video models (LTX 2.3 A2V), this is optional — omit it to generate video purely from text + audio.",
        },
        audioStart: {
          type: "number",
          description:
            'Start offset in seconds into the audio track. Use when the user says "start 20 seconds in", "skip the intro", "use the chorus at 1:30", etc. Default: 0 (beginning of audio). The video will be synced to the audio starting from this point.',
          minimum: 0,
        },
        duration: {
          type: "number",
          description:
            "Video duration in seconds. Default: 5. Range: 2-30; the usable window is per-model and the host clamps to it: LTX 2.3 and WAN accept 2-20, Seedance 2.0/Mini/Fast accept 4-15, and Seedance 2.5 accepts 4-30 — only seedance2-5 can use the 16-30s part of this range. For music videos, use the MAXIMUM duration the selected model allows (20 for LTX/WAN, 30 for \"seedance2-5\") since the audio is always longer than the video limit. Use when the user explicitly requests a specific length.",
          minimum: 2,
          maximum: 30,
        },
        videoModel: {
          type: "string",
          enum: ["wan-s2v", "seedance2", "seedance2-mini", "seedance2-fast", "seedance2-5", "ltx25-ia2v", "ltx25-a2v", "ltx23-ia2v", "ltx23-a2v"],
          description:
            '"ltx25-ia2v" (default with image) and "ltx25-a2v" (default without image): LTX 2.5 image+audio and audio-only modes; Fast/HQ use distilled INT8 and Pro uses dev INT8 with its required official Speed LoRA refinement. ' +
            'Video model. "ltx23-ia2v" (rollback with image): LTX 2.3 image+audio to video, audio-reactive with a reference image; Fast/HQ use the distilled 8-step worker and Default Media Quality Pro uses the non-distilled dev worker. "ltx23-a2v" (rollback without image): LTX 2.3 audio-only to video, no image needed, creates video purely from text prompt + audio with the same quality-tier routing. "wan-s2v": WAN 2.2 sound-to-video, best for lip-sync with a face image, fast 4-step. "seedance2": full Seedance 2.0 audio-reference video, 4-15s. "seedance2-mini": Seedance 2.0 Mini, 720p cap, fastest/lower-cost Seedance option. "seedance2-fast": Seedance 2.0 Fast legacy option. Seedance quality is selected only by this model value: pick "seedance2-mini" for faster/lower-cost drafts or explicit Mini requests, pick "seedance2-fast" only when the user says Seedance Fast / seedance-fast, and pick "seedance2" for full/non-fast Seedance or 1080p/4K. Do not infer the Seedance model from Default Media Quality Fast/HQ/Pro. "seedance2-5": Seedance 2.5, the newest Seedance generation — 480p and 720p ONLY (it cannot render 1080p or 4K), 4-30s per clip at a fixed 24 fps, native audio, first-and-last-frame conditioning, and a much larger reference budget than the 2.0 family: up to 30 images, 10 videos, and 10 audios, with no more than 30 reference media files in total. Choose "seedance2-5" when the user asks for Seedance 2.5, wants a single continuous Seedance clip longer than 15s (2.5 renders up to 30s in one call instead of being split and stitched), or wants a first-and-last-frame Seedance transition. Keep "seedance2" for 1080p/4K requests, which Seedance 2.5 cannot satisfy. ' +
            SEEDANCE_TOOL_AUDIO_REFERENCE_GUIDANCE +
            ' Omit to auto-select based on whether an image is present.',
        },
        generateAudio: {
          type: "boolean",
          description:
            "Whether the returned video should include audio. Omit to include audio by default; set false when the user asks for silent output or no audio. The reference audio is still required and still drives generation even when the returned video has no audio track.",
        },
        numberOfVariations: {
          type: "number",
          description:
            "Number of video variations to generate (1-16). Use with one Dynamic Prompt branch when all variations share the same audio source/window, image source, model, duration, dimensions, and parameters and only prompt text varies. This creates one Sogni project with multiple jobs. Default: 1.",
          minimum: 1,
          maximum: 16,
        },
        targetResolution: {
          type: "number",
          description:
            'Short-side video resolution target in pixels. Use ONLY when the user asks for a bare named resolution such as "480p", "720p", or "1080p" without exact pixels or an output orientation. This preserves the source/reference aspect ratio. Do NOT set exact-pixel aspectRatio for bare named resolution requests. If the user says "720p portrait" or "720p landscape", use exact-pixel aspectRatio instead.',
        },
        aspectRatio: {
          type: "string",
          description: ASPECT_RATIO_DESCRIPTION,
        },
      },
      required: ["prompt"],
    },
  },
};
