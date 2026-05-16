/**
 * Storyboard shape contracts.
 *
 */
import type {
  StoryboardPlanningContract,
  StoryboardPlanningSource,
} from '../public-skill-runtime/index.js';

export const CAMPAIGN_STORYBOARD_SCHEMA_VERSION = 'campaign-storyboard/v1' as const;
export const CAMPAIGN_STORYBOARD_METADATA_PREFIX = 'SOGNI_CAMPAIGN_STORYBOARD_JSON:';

export type CampaignReferenceAssetType =
  | 'character'
  | 'logo'
  | 'product'
  | 'style'
  | 'first_frame'
  | 'last_frame'
  | 'motion_reference'
  | 'audio_reference'
  | 'storyboard'
  | 'background'
  | 'other';

export type CampaignReferenceUsageScope =
  | 'global'
  | 'scenes'
  | 'end_card_only'
  | 'motion_only'
  | 'style_only';

export type CampaignPreservePriority = 'critical' | 'high' | 'medium' | 'low';
export type CampaignProductionMode = 'fast_draft' | 'production';

export interface CampaignReferenceAsset {
  id: string;
  tag?: string;
  sourceIndex?: number;
  assetType: CampaignReferenceAssetType;
  usageScope: CampaignReferenceUsageScope;
  preservePriority: CampaignPreservePriority;
  description: string;
  assignedSceneIds: string[];
}

export interface CampaignVoiceLine {
  sceneId: string;
  startSec: number | null;
  endSec: number | null;
  text: string;
  delivery: string;
  priority: 'required' | 'optional';
}

export interface CampaignSceneSpec {
  id: string;
  index: number;
  title: string;
  startSec: number | null;
  endSec: number | null;
  durationSec: number | null;
  purpose: string;
  productFeature: string;
  visual: string;
  action: string;
  camera: string;
  lighting: string;
  transitionIn: string;
  transitionOut: string;
  dialogue: string;
  voiceoverLines: CampaignVoiceLine[];
  audioSfx: string[];
  music: string;
  referenceUsage: string[];
  visibleText: string[];
  metadataLabels: string[];
  mustAvoid: string[];
  firstFrame: string;
  lastFrame: string;
}

export interface CampaignTransition {
  fromSceneId: string;
  toSceneId: string;
  description: string;
  audioBridge: string;
}

export interface CampaignStoryboard {
  schemaVersion: typeof CAMPAIGN_STORYBOARD_SCHEMA_VERSION;
  project: {
    title: string;
    durationSec: number | null;
    targetVideoAspectRatio: string;
    storyboardCanvasAspectRatio: string;
    storyboardCellAspectRatio: string;
    storyboardLayout: string;
    layoutSource?: StoryboardPlanningSource;
    outputUse: 'storyboard_image' | 'video_prompt' | 'both';
    productionMode: CampaignProductionMode;
  };
  planningContract?: StoryboardPlanningContract;
  references: CampaignReferenceAsset[];
  creativeBrief: {
    concept: string;
    oneSentenceStorySpine: string;
    toneProgression: string[];
    visualStyle: string;
    mustInclude: string[];
    mustAvoid: string[];
    brandRules: string[];
  };
  voiceover: {
    fullScript: string;
    lines: CampaignVoiceLine[];
  };
  scenes: CampaignSceneSpec[];
  transitions: CampaignTransition[];
  endCard: {
    requiredText: string[];
    logoReferenceId?: string;
    holdDurationSec: number;
    visualTreatment: string;
  };
  audio: {
    musicArc: string;
    globalSfxPalette: string[];
  };
  source: {
    prompt: string;
    userIntentText: string;
    approvedScriptContext: string | null;
    frameCount: number;
    promptAuthorship?: 'user' | 'assistant';
  };
}

export interface CampaignStoryboardValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Seedance storyboard reference fallback prompt.
 */
export const SEEDANCE_STORYBOARD_REFERENCE_PROMPT =
  'Create a full-screen cinematic video from the storyboard in @Image1. Treat @Image1 as the controlling source for shot order and intent, and as a source layout reference: use the thumbnails, timing, Dialogue/VO, Audio/SFX, timecodes, camera/motion notes, transitions, and scene order as instructions, not as a visual board to reproduce. Do not display the storyboard grid, borders, caption bars, storyboard title/footer text, panel numbers, section labels, slide titles, headings, or transcribed narration. Convert the ordered thumbnails into full-screen chronological beats; do not reuse only one or two motifs while skipping panels. When the board has panel titles, captions, section numbers, slide titles, or headings but no formal Dialogue/VO labels, treat those labels as short audio-only narration/voiceover or key-message beats in order unless they are clearly visual-only metadata. Voice each label as its own brief phrase with a pause; do not concatenate labels into run-on sentences and do not speak panel numbers. Show storyboard labels as visible text only when the user explicitly asks for visible text, subtitles, a title card, lower third, signage, or a title/end frame. Preserve the story spine, character/product/reference continuity, and cause-and-effect progression between beats. Treat transitions as motion instructions, not unrelated hard cuts unless the storyboard explicitly asks for hard cuts. Use brand color, lighting, product imagery, and composition instead of invented typography. Keep visible text limited to exact copy the user or storyboard explicitly marks as on-screen text, signage, title text, or end-frame text. Use a music/SFX arc that follows the storyboard audio notes and lands the final beat. Keep unrelated UI, extra logos, microtext, subtitles, and extra scenes out of the frame.';
