import type { ToolDefinition } from '../types.js';

export const STITCH_TRANSITION_TYPES = [
  'fade',
  'dissolve',
  'wipeleft',
  'wiperight',
  'slideup',
  'slidedown',
] as const;

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'stitch_video',
    description:
      'Concatenate whole videos end-to-end into one continuous video. This tool joins each source clip in full, in the order you pass — it does NOT interleave time slices, insert one clip inside another, or replace part of a video. ' +
      'WHEN TO USE: the user wants clips played one after another (whole clip A, then whole clip B), including adding a generated bumper / intro / outro / tag / sting before or after another video. Plain language: "stitch these together", "stitch A and B", "combine these clips", "join these into one video", "play the bumper before this clip". ' +
      'WHEN NOT TO USE — prefer replace_video_segment instead: any request to put one clip inside another, replace a window inside a video, alternate / interleave / splice short slices of multiple videos, insert clip X "into the middle of" clip Y, or swap out part of an existing video while keeping the rest. The word "stitch" in the user request does not by itself decide this tool — read what they actually want. If the user asks to "stitch X into the middle of Y" or "stitch X into Y starting at 5s", that is splice-into-middle and belongs to replace_video_segment. ' +
      'SOURCES: previously generated clips (non-negative indices into the session video-result array, populated by animate_photo, generate_video, sound_to_video, video_to_video, dance_montage — use videoStartIndex from their results to find the indices) and/or uploaded videos (negative indices: -1 = first uploaded video, -2 = second, etc.). Mix and match in any playback order — for example, pass [0, -1] to play the first generated clip followed by the first uploaded video (a generated bumper followed by the user\'s existing footage). ' +
      'When the user asks to stitch "these" or all uploaded videos and does not name a different playback order, use the current upload/UI order exactly: [-1, -2, ...]. If the user explicitly asks for a different order, honor that requested order. ' +
      'Requires at least 2 source videos in total. Never ask the user to re-upload videos that were already generated or that are already attached to the session. ' +
      'When the user generated music with generate_music in this same session and wants it on the stitch (or asked for a music video / soundtrack), pass a non-negative audioIndex to attach that generated track. ' +
      'When the user uploaded an audio file and wants it overlaid on the stitched video (e.g. "stitch the audio after", "overlay the audio", "audio on top of the video"), pass a negative audioIndex (-1 = first uploaded audio, -2 = second, etc.). In both cases the source clips\' own audio is replaced by the chosen track. ' +
      'When the user asks for a fade, dissolve, wipe, or slide between clips, pass `transition`; omit `transition` for a hard cut (the default).',
    parameters: {
      type: 'object',
      properties: {
        videoIndices: {
          type: 'array',
          items: { type: 'number' },
          description:
            'Ordered list of source video indices, in the desired playback order. ' +
            'Non-negative values are 0-based indices into the session generated-video array ' +
            '(results from animate_photo, generate_video, sound_to_video, video_to_video, ' +
            'dance_montage in this conversation). Negative values reference uploaded videos: ' +
            '-1 = first uploaded video, -2 = second, etc. Indices may be mixed — for example, ' +
            '[0, -1] plays the first generated clip followed by the first uploaded video. ' +
            'For vague "these clips" / "all uploaded videos" requests, use current upload/UI order ' +
            '[-1, -2, ...] unless the user explicitly says to reverse or otherwise reorder them.',
        },
        audioIndex: {
          type: 'number',
          description:
            'Optional index of the audio track to mux onto the stitched output. ' +
            'Non-negative values are 0-based indices into the session generated-audio array (results ' +
            'from generate_music). Negative values reference uploaded audio: -1 = first uploaded audio, ' +
            '-2 = second, etc. When set, the chosen track is muxed onto the stitched output and the ' +
            'source clips\' own audio is dropped. Use a non-negative value when the user generated ' +
            'music in the same session or asked for a soundtrack / music video stitch; use a negative ' +
            'value when the user wants their uploaded audio overlaid on the stitched video (e.g. ' +
            '"stitch the audio after", "overlay the audio"). Omit for a silent or source-audio-preserving stitch.',
        },
        transition: {
          type: 'object',
          description:
            'Optional crossfade between adjacent clips. Omit for a hard-cut concat. ' +
            'When set, every adjacent pair of clips is joined with the same transition type and duration.',
          properties: {
            type: {
              type: 'string',
              enum: [...STITCH_TRANSITION_TYPES],
              description:
                '"fade" / "dissolve" = soft mix; "wipeleft" / "wiperight" = horizontal wipe; ' +
                '"slideup" / "slidedown" = vertical slide. Maps to ffmpeg xfade transition names.',
            },
            durationSeconds: {
              type: 'number',
              minimum: 0.2,
              maximum: 2,
              description: 'Length of the crossfade in seconds. Default 0.5. Capped at 2s.',
            },
          },
          required: ['type'],
        },
      },
      required: ['videoIndices'],
    },
  },
};
