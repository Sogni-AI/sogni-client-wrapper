/**
 * Tool definition for add_subtitles.
 *
 * Burns subtitles onto a previously rendered or uploaded video using ffmpeg's
 * `subtitles` filter. The caller may provide cues directly as a structured
 * array, or pass a complete SRT/VTT string. Auto-transcription is intentionally
 * stubbed — the server returns a typed STT_NOT_AVAILABLE error until a
 * dedicated speech-to-text backend lands.
 */

import type { ToolDefinition } from '../types.js';

export const SUBTITLE_VERTICAL_POSITIONS = ['bottom', 'top', 'center'] as const;

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_subtitles',
    description:
      'Burn subtitles into a video from caller-supplied cues or an SRT/VTT string. ' +
      'Use when the user asks to add captions, subtitles, on-screen dialogue, or burned-in lyrics to a video. ' +
      'Either pass `cues` as an array of {startSeconds, endSeconds, text}, or pass a full `srt` string. ' +
      'Pace cues like real subtitles: split the script into multiple short cues (typically 1.5–4 seconds each, ' +
      '~1–8 words per cue, roughly 15–20 characters per second of cue duration). Never burn a single cue that ' +
      'spans the entire clip — even a static image should get progressively revealed lines, not one paragraph ' +
      'held on screen the whole time. ' +
      'Auto-transcription (auto_transcribe=true) is not yet enabled and will return USER_INPUT_INCOMPLETE — ' +
      'when the user has not supplied lines, ask them for the cue text and timing instead of calling with auto_transcribe. ' +
      'If the user explicitly asks you to write, invent, improvise, or make up captions/subtitles, create a few short, ' +
      'generic cue lines yourself and call this tool with cues; do not ask a follow-up for exact wording in that case.',
    parameters: {
      type: 'object',
      properties: {
        sourceVideoIndex: {
          type: 'number',
          description:
            'Which video to subtitle. Default: -1 (most recent generated or uploaded video). ' +
            'Non-negative values are 0-based indices into prior generated video results. ' +
            'Negative values reference uploaded videos.',
        },
        cues: {
          type: 'array',
          description:
            'Ordered subtitle cues. Each cue has startSeconds, endSeconds, and the line of text to display. ' +
            'Provide either `cues` or `srt`, not both. Aim for multiple short cues (1.5–4s each, ~1–8 words) ' +
            'rather than one long cue spanning the full clip.',
          items: {
            type: 'object',
            properties: {
              startSeconds: { type: 'number', minimum: 0 },
              endSeconds: { type: 'number', minimum: 0 },
              text: { type: 'string' },
            },
            required: ['startSeconds', 'endSeconds', 'text'],
          },
        },
        srt: {
          type: 'string',
          description:
            'Full SRT (or VTT) document as a string, used in place of `cues`. Useful when the user pastes ' +
            'a subtitle file directly. Provide either `cues` or `srt`, not both.',
        },
        auto_transcribe: {
          type: 'boolean',
          description:
            'Reserved for future speech-to-text support. Currently returns USER_INPUT_INCOMPLETE so the LLM ' +
            'can ask the user to supply cues. Do not set this — gather cue text from the user instead.',
        },
        style: {
          type: 'object',
          description: 'Optional styling overrides for the burned subtitles.',
          properties: {
            fontSizePct: {
              type: 'number',
              minimum: 1,
              maximum: 30,
              description: 'Font size as a percentage of the video height. Default 6.',
            },
            color: {
              type: 'string',
              description: 'Subtitle fill color. Default "#FFFFFF".',
            },
            outlineColor: {
              type: 'string',
              description: 'Subtitle outline color. Default "#000000".',
            },
            position: {
              type: 'string',
              enum: [...SUBTITLE_VERTICAL_POSITIONS],
              description: 'Vertical placement of the subtitle line. Default "bottom".',
            },
          },
        },
      },
    },
  },
};
