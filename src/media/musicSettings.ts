export type MusicRenderMode = 'speed' | 'quality' | 'best';

export enum MusicModel {
  speed = 'ace_step_1.5_xl_turbo',
  quality = 'ace_step_1.5_xl_sft',
  best = 'minimax_music3',
}

export const MUSIC_MODELS = {
  speed: {
    steps: { min: 4, max: 16, default: 8 },
    shift: { min: 1, max: 5, default: 3 },
    guidance: null,
    sampler: { allowed: ['euler', 'euler_ancestral'], default: 'euler' },
    scheduler: { allowed: ['simple'], default: 'simple' },
  },
  quality: {
    steps: { min: 10, max: 200, default: 50 },
    shift: { min: 1, max: 5, default: 3 },
    guidance: { min: 1, max: 15, default: 5 },
    sampler: { allowed: ['euler', 'euler_ancestral', 'er_sde'], default: 'er_sde' },
    scheduler: { allowed: ['simple', 'linear_quadratic'], default: 'linear_quadratic' },
  },
  // MiniMax Music 3: autoregressive composer. duration is a per-model override of
  // MUSIC_DURATION (300s cap) and is treated as a ceiling — the model may end the
  // song early at a musical resolution. No BPM/key/timesig controls; describe
  // tempo and key in the prompt caption instead.
  best: {
    steps: { min: 10, max: 100, default: 30 },
    shift: null,
    guidance: { min: 1, max: 5, default: 1.7 },
    promptStrength: { min: 0, max: 10, default: 1.7 },
    topK: { min: 1, max: 16384, default: 50 },
    duration: { min: 10, max: 300, default: 60 },
    sampler: { allowed: ['euler'], default: 'euler' },
    scheduler: { allowed: ['simple'], default: 'simple' },
  },
} as const;

export const MUSIC_DURATION = { min: 10, max: 600, default: 30 };
export const MUSIC_BPM = { min: 30, max: 300, default: 120 };

export const MUSIC_TIME_SIGNATURES = {
  '2': '2/4',
  '3': '3/4',
  '4': '4/4',
  '6': '6/8',
};

export type TimeSignature = keyof typeof MUSIC_TIME_SIGNATURES;

export const MUSIC_KEY_SCALES = [
  '',
  'A major',
  'A minor',
  'A# major',
  'A# minor',
  'Ab major',
  'Ab minor',
  'A♯ major',
  'A♯ minor',
  'A♭ major',
  'A♭ minor',
  'B major',
  'B minor',
  'B# major',
  'B# minor',
  'Bb major',
  'Bb minor',
  'B♯ major',
  'B♯ minor',
  'B♭ major',
  'B♭ minor',
  'C major',
  'C minor',
  'C# major',
  'C# minor',
  'Cb major',
  'Cb minor',
  'C♯ major',
  'C♯ minor',
  'C♭ major',
  'C♭ minor',
  'D major',
  'D minor',
  'D# major',
  'D# minor',
  'Db major',
  'Db minor',
  'D♯ major',
  'D♯ minor',
  'D♭ major',
  'D♭ minor',
  'E major',
  'E minor',
  'E# major',
  'E# minor',
  'Eb major',
  'Eb minor',
  'E♯ major',
  'E♯ minor',
  'E♭ major',
  'E♭ minor',
  'F major',
  'F minor',
  'F# major',
  'F# minor',
  'Fb major',
  'Fb minor',
  'F♯ major',
  'F♯ minor',
  'F♭ major',
  'F♭ minor',
  'G major',
  'G minor',
  'G# major',
  'G# minor',
  'Gb major',
  'Gb minor',
  'G♯ major',
  'G♯ minor',
  'G♭ major',
  'G♭ minor',
] as const;

export const MUSIC_LANGUAGES = [
  'unknown',
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ru',
  'ja',
  'ko',
  'zh',
  'ar',
  'hi',
  'nl',
  'pl',
  'sv',
  'tr',
  'vi',
  'th',
  'id',
  'cs',
  'da',
  'fi',
  'el',
  'he',
  'hu',
  'no',
  'ro',
  'sk',
  'uk',
  'bg',
  'hr',
  'lt',
  'sr',
  'ca',
  'is',
  'ms',
  'tl',
  'bn',
  'fa',
  'ne',
  'pa',
  'sw',
  'ta',
  'te',
  'ur',
  'az',
  'ht',
  'la',
  'sa',
  'yue',
] as const;

export const LANGUAGE_LABELS: Record<string, string> = {
  unknown: 'Auto-detect',
  ar: 'Arabic',
  az: 'Azerbaijani',
  bg: 'Bulgarian',
  bn: 'Bengali',
  ca: 'Catalan',
  cs: 'Czech',
  da: 'Danish',
  de: 'German',
  el: 'Greek',
  en: 'English',
  es: 'Spanish',
  fa: 'Persian',
  fi: 'Finnish',
  fr: 'French',
  he: 'Hebrew',
  hi: 'Hindi',
  hr: 'Croatian',
  ht: 'Haitian Creole',
  hu: 'Hungarian',
  id: 'Indonesian',
  is: 'Icelandic',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  la: 'Latin',
  lt: 'Lithuanian',
  ms: 'Malay',
  ne: 'Nepali',
  nl: 'Dutch',
  no: 'Norwegian',
  pa: 'Punjabi',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  sa: 'Sanskrit',
  sk: 'Slovak',
  sr: 'Serbian',
  sv: 'Swedish',
  sw: 'Swahili',
  ta: 'Tamil',
  te: 'Telugu',
  th: 'Thai',
  tl: 'Tagalog',
  tr: 'Turkish',
  uk: 'Ukrainian',
  ur: 'Urdu',
  vi: 'Vietnamese',
  yue: 'Cantonese',
  zh: 'Chinese',
};

export const MUSIC_LANGUAGE_OPTIONS = MUSIC_LANGUAGES.map((code) => ({
  value: code,
  label: LANGUAGE_LABELS[code] || code,
})).sort((a, b) => {
  if (a.value === 'unknown') return -1;
  if (b.value === 'unknown') return 1;
  return a.label.localeCompare(b.label);
});

export const KEY_SCALE_LABELS: Record<string, string> = {
  '': 'Auto',
};

export const MUSIC_OUTPUT_FORMATS = ['mp3', 'wav', 'flac'] as const;
export type AudioOutputFormat = (typeof MUSIC_OUTPUT_FORMATS)[number];

export const IMAGINE_LABELS = {
  processing: 'Composing...',
  idle: 'Compose',
};

export function getMusicModel(mode: MusicRenderMode): string {
  if (mode === 'best') return MusicModel.best;
  return mode === 'speed' ? MusicModel.speed : MusicModel.quality;
}
