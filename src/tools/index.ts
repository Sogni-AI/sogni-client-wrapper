export { sanitizeBatchPrompt } from './shared/promptSanitizer.js';
export {
  classifyError,
  parseResultForError,
} from './shared/errorClassification.js';
export type {
  ClassifiedError,
  ParsedToolResultError,
} from './shared/errorClassification.js';
export {
  MODELS_BY_TOOL,
  getAlternativeModels,
  getModelArgKey,
  getModelOptions,
  isQualityTierTool,
} from './shared/modelRegistry.js';
export type { ModelOption } from './shared/modelRegistry.js';
export * from './shared/policyChecks.js';
export * from './shared/seedancePolicyErrors.js';
export {
  SEEDANCE_REFERENCE_LIMITS,
  SeedanceReferenceLimitError,
  validateSeedanceReferenceCounts,
} from './shared/seedanceReferences.js';
export type {
  SeedanceReferenceLimits,
  SeedanceReferenceLimitKind,
  SeedanceReferenceCounts,
} from './shared/seedanceReferences.js';
export * from './shared/llmHelpers.js';
export * from './shared/promptRefinementCache.js';
export * from './shared/imageEncoding.js';
export * from './shared/slotFailureSummary.js';
export * from './shared/visionDescriptionCache.js';
export * from './shared/downloadFilename.js';
export {
  addSubtitlesDefinition,
  animatePhotoDefinition,
  applyStyleDefinition,
  changeAngleDefinition,
  danceMontageDefinition,
  editImageDefinition,
  extendVideoDefinition,
  generateImageDefinition,
  generateMusicDefinition,
  generateVideoDefinition,
  generationToolDefinitions,
  orbitVideoDefinition,
  overlayVideoDefinition,
  refineResultDefinition,
  replaceVideoSegmentDefinition,
  restorePhotoDefinition,
  soundToVideoDefinition,
  stitchVideoDefinition,
  videoToVideoDefinition,
  OVERLAY_POSITIONS,
  STITCH_TRANSITION_TYPES,
  SUBTITLE_VERTICAL_POSITIONS,
  DANCE_PRESETS,
  resolveDancePresetForRequest,
} from './definitions/index.js';
export type { DancePreset, ToolDefinition } from './definitions/index.js';
export {
  isToolResultErr,
  isToolResultOk,
  mapLegacyToolErrorCategory,
  toolErr,
  toolOk,
} from './result.js';
export type {
  LegacyToolErrorCategory,
  ToolErrorCode,
  ToolResult,
  ToolResultAsset,
  ToolResultCost,
  ToolResultErr,
  ToolResultOk,
} from './result.js';
export { expandSingleSourceFanOutForPerClipPrompts } from './normalizeArgs.js';
export {
  type DynamicPromptBranch,
  type SceneDynamicPromptValidation,
  extractDynamicPromptBranches,
  isolateDynamicPromptSlot,
  buildDynamicPromptSlotPrompts,
  validateSceneDynamicPromptBatch,
  validateSingleDynamicPromptBranch,
  promptHasStoryboardBatchLanguage,
  promptHasLinkedVariantBatchLanguage,
  isStoryboardKeyframeBatchPrompt,
} from './shared/dynamicPromptBranches.js';
export { textExplicitlyRequestsMultipleImageOutputs } from './shared/multiImageIntent.js';
export { maybeAlignNumberOfVariationsToDynamicBranchCount } from './shared/numberOfVariationsAlignment.js';
