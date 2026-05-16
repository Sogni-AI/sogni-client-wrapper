import type { SogniChatMessage } from '../runtime/chatTypes.js';
import type { ToolDefinition } from '../tools/definitions/types.js';
import {
  LANGUAGE_LABELS,
  MUSIC_BPM,
  MUSIC_DURATION,
  MUSIC_KEY_SCALES,
  MUSIC_TIME_SIGNATURES,
  type TimeSignature,
} from '../media/musicSettings.js';
import { getRandomLyricsTheme } from './randomThemes.js';

export interface LyricsGenerationResult {
  lyrics: string;
  tempo: number | null;
  key: string | null;
  timeSignature: TimeSignature | null;
  duration: number | null;
}

export const LYRICS_MAX_TOKENS = 2048;

const LYRICS_SYSTEM_PROMPT = `You are an expert songwriter. Generate song lyrics using the ACE-Step structured format and return them via the compose_lyrics tool.

Section headers — each section tag can optionally include a vocal/performance modifier after a hyphen, e.g. [Section - modifier]. Choose modifiers that fit the song's mood and vary them across sections.
Common structures: Verse, Chorus, Bridge, Intro, Outro, Instrumental, Interlude, Build, Drop, Breakdown — but you can use any descriptive section name like Guitar Solo, Piano Interlude, Fade Out, etc.
Modifiers are free-form — describe vocal delivery or performance feel in your own words. Not every section needs one. Examples for inspiration: raspy, breathy, falsetto, belting, spoken word, humming, anthemic, gentle, building, harmonies, a cappella
Keep modifiers to one or two words per tag.

Rules:
- Write natural, creative lyrics that match the requested style/mood
- Keep line lengths appropriate for singing (6-10 syllables per line for optimal rhythm)
- Use CAPS for intense/shouted lines: "WE ARE THE FIRE!"
- Use parentheses for background vocals: "We rise together (together)"
- The lyrics should be suitable for a song, not a poem

Suggest a duration that fits the lyrics naturally at the chosen tempo.`;

const INSTRUMENTAL_SYSTEM_PROMPT = `You are an expert music composer and arranger. Design an instrumental music structure using the ACE-Step structured format and return it via the compose_instrumental tool.

Output ONLY section tags in brackets — one per line, nothing else between them. The AI music model interprets any text outside brackets as lyrics to sing, so do NOT include descriptions, directions, or any other text between section tags.

Section tags — use tags like [Intro], [Main Theme], [Bridge], [Build], [Drop], [Breakdown], [Climax], [Outro], [Guitar Solo], [Piano Interlude], [Fade Out], etc.
Each tag can optionally include a performance modifier after a hyphen, e.g. [Section - modifier]. Choose modifiers that describe the instrumental feel.
Modifiers are free-form — describe the energy, dynamics, or featured instruments. Examples: building, ambient, driving, melodic, percussive, atmospheric, powerful, delicate, syncopated, distorted

Example output format:
[Intro - ambient pads]
[Main Theme - driving guitar]
[Bridge - stripped back piano]
[Build - percussive, rising]
[Drop - powerful, full band]
[Outro - fade out]

Rules:
- Output ONLY bracketed section tags, one per line — NO text between sections
- Use modifiers within the brackets to convey dynamics, instrumentation, and energy
- Structure the sections to create a natural musical arc
- Match the requested style/mood

Suggest a duration that fits the structure naturally at the chosen tempo.`;

export const LYRICS_COMPOSITION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'compose_lyrics',
    description: 'Output the composed song lyrics and musical parameters',
    parameters: {
      type: 'object',
      properties: {
        lyrics: {
          type: 'string',
          description:
            'Song lyrics with enriched section headers (e.g. [Verse 1 - soft vocal]). Use \\n for newlines.',
        },
        bpm: { type: 'number', description: 'Tempo in beats per minute, e.g. 120 for a pop song' },
        keyscale: {
          type: 'string',
          description: 'Musical key and scale, e.g. "D minor", "A major", "F# minor"',
        },
        timesignature: {
          type: 'string',
          enum: ['2/4', '3/4', '4/4', '6/8'],
          description: 'Time signature. Most songs use 4/4; waltzes use 3/4',
        },
        duration: {
          type: 'number',
          description: 'Estimated song duration in seconds that fits the lyrics at the chosen tempo',
        },
      },
      required: ['lyrics', 'bpm', 'keyscale', 'timesignature', 'duration'],
    },
  },
};

export const INSTRUMENTAL_COMPOSITION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'compose_instrumental',
    description: 'Output the composed instrumental music structure and musical parameters',
    parameters: {
      type: 'object',
      properties: {
        structure: {
          type: 'string',
          description:
            'Instrumental structure as ONLY bracketed section tags, one per line, with NO text between them (e.g. [Intro - ambient pads]\\n[Main Theme - driving guitar]\\n[Bridge - stripped back]). Use \\n for newlines.',
        },
        bpm: {
          type: 'number',
          description: 'Tempo in beats per minute, e.g. 120 for an upbeat track',
        },
        keyscale: {
          type: 'string',
          description: 'Musical key and scale, e.g. "D minor", "A major", "F# minor"',
        },
        timesignature: {
          type: 'string',
          enum: ['2/4', '3/4', '4/4', '6/8'],
          description: 'Time signature. Most songs use 4/4; waltzes use 3/4',
        },
        duration: {
          type: 'number',
          description: 'Estimated track duration in seconds that fits the structure at the chosen tempo',
        },
      },
      required: ['structure', 'bpm', 'keyscale', 'timesignature', 'duration'],
    },
  },
};

export function buildLyricsMessages(
  prompt: string,
  language: string,
  musicPrompt: string,
  randomTheme?: string,
): SogniChatMessage[] {
  const messages: SogniChatMessage[] = [{ role: 'system', content: LYRICS_SYSTEM_PROMPT }];
  let userMessage: string;
  if (prompt.trim()) {
    userMessage = prompt;
  } else {
    const theme = randomTheme || getRandomLyricsTheme();
    userMessage = `Come up with a unique, original song about: ${theme}. Be creative and surprising.`;
  }
  if (musicPrompt) {
    userMessage += `\n\nMusic style context: ${musicPrompt}`;
  }
  if (language && language !== 'unknown') {
    userMessage += `\n\nWrite the lyrics in: ${LANGUAGE_LABELS[language]}`;
  }
  messages.push({ role: 'user', content: userMessage });
  return messages;
}

export function buildInstrumentalMessages(
  prompt: string,
  musicPrompt: string,
  randomTheme?: string,
): SogniChatMessage[] {
  const messages: SogniChatMessage[] = [{ role: 'system', content: INSTRUMENTAL_SYSTEM_PROMPT }];
  let userMessage: string;
  if (prompt.trim()) {
    userMessage = prompt;
  } else {
    const theme = randomTheme || getRandomLyricsTheme();
    userMessage = `Come up with a unique, original instrumental piece inspired by: ${theme}. Be creative and surprising.`;
  }
  if (musicPrompt) {
    userMessage += `\n\nMusic style context: ${musicPrompt}`;
  }
  messages.push({ role: 'user', content: userMessage });
  return messages;
}

function parseTimeSignature(value: unknown): TimeSignature | null {
  const str = String(value ?? '');
  const map: Record<string, TimeSignature> = { '2/4': '2', '3/4': '3', '4/4': '4', '6/8': '6' };
  if (map[str]) return map[str];
  const signatures = Object.keys(MUSIC_TIME_SIGNATURES);
  if (signatures.includes(str)) return str as TimeSignature;
  return null;
}

function parseTempo(value: unknown): number | null {
  const num = Number(value);
  if (!isNaN(num) && num >= MUSIC_BPM.min && num <= MUSIC_BPM.max) return Math.round(num);
  return null;
}

function parseDuration(value: unknown): number | null {
  const num = Number(value);
  if (!isNaN(num) && num >= MUSIC_DURATION.min && num <= MUSIC_DURATION.max) return Math.round(num);
  return null;
}

function parseKeyScale(value: unknown): string | null {
  if (!value) return null;
  const str = String(value);
  const found = MUSIC_KEY_SCALES.find((k) => k.toLowerCase() === str.toLowerCase());
  return found || null;
}

export function parseToolCallResult(args: Record<string, unknown>): LyricsGenerationResult {
  const rawText = String(args.lyrics || args.structure || '');
  const lyrics = rawText.includes('\n') ? rawText : rawText.replace(/\\n/g, '\n');
  return {
    lyrics: lyrics.trim(),
    tempo: parseTempo(args.bpm),
    key: parseKeyScale(args.keyscale),
    timeSignature: parseTimeSignature(args.timesignature),
    duration: parseDuration(args.duration),
  };
}
