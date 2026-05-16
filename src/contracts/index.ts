export type { PromptContract } from './promptContract.js';
export { isPromptContract } from './promptContract.js';

export type {
  ToolGatingPolicy,
  ToolGatingPolicyTrigger,
  ToolGatingPolicyEffect,
} from './toolGatingPolicy.js';
export { isToolGatingPolicy } from './toolGatingPolicy.js';

export type { RepairRecipe, RepairRecipeMode } from './repairRecipe.js';
export { isRepairRecipe } from './repairRecipe.js';

export type { Signal, SignalSource, ContextHint, TurnPolicy } from './turnPolicy.js';
export { emptyTurnPolicy } from './turnPolicy.js';

export { ContractRegistry } from './registry.js';

export type { ClassifyTurnInput } from './evaluators.js';
export { classifyTurn } from './evaluators.js';

export type {
  ToolDefinitionLike,
  CompileToolsForTurnInput,
  CompiledToolset,
} from './evaluators.js';
export { compileToolsForTurn } from './evaluators.js';

export type {
  ToolCall,
  DispatchResult,
  DispatchToolCallInput,
} from './evaluators.js';
export { dispatchToolCall } from './evaluators.js';

export type {
  BuildContractTurnPolicyInput,
  CompiledContractToolSurface,
  CompileContractToolSurfaceInput,
  ContractMessageLike,
  ContractToolChoiceLike,
  ContractToolDefinitionLike,
} from './toolSurface.js';
export {
  DEFAULT_CONTRACT_CONTEXT_PREFIX,
  appendContractsContextToSystemContent,
  buildContractTurnPolicy,
  compileContractToolSurface,
  formatContractsContextBlock,
  normalizeContractMessages,
  reconcileToolChoiceForCompiledTools,
} from './toolSurface.js';

export type {
  ContractsTelemetryEvent,
  ContractsTelemetrySink,
  TurnClassifiedPayload,
  GatingPolicyAppliedPayload,
  PromptContractEmittedPayload,
  ToolDispatchResolvedPayload,
  RepairRecipeFiredPayload,
} from './telemetry.js';
export { isContractsTelemetryEvent, makeBufferedSink } from './telemetry.js';

// Shared contract-data (Phase 3 gating policies, Phase 4 repair
// recipes, Phase 5 prompt contracts). Cross-consumer: sogni-chat,
// sogni-api hosted chat, future SDKs.
export {
  MEDIA_TOOL_NAMES,
  PHASE_3_GATING_POLICIES,
  TOOL_SURFACE_GATING_POLICIES,
  IMAGE_CONTEXT_TOOL_NAMES,
  VIDEO_CONTEXT_TOOL_NAMES,
  PHASE_4_REPAIR_RECIPES,
  PHASE_5_PROMPT_CONTRACTS,
  CANONICAL_TOOL_CATALOG,
  TOOL_COST_METADATA,
  TOOL_PERMISSIONS,
  getCanonicalToolCatalogEntry,
  populateContractsGatingPolicies,
  populateContractsToolSurfaceGatingPolicies,
  populateContractsRepairRecipes,
  populateContractsPromptContracts,
  populateToolCostMetadata,
  populateToolPermissions,
  populateContractsDefaults,
  getToolCostMetadata,
  getToolPermission,
  getToolPermissionDecision,
  evaluatePermissionGate,
  toolRequiresUserApproval,
  listPaidTools,
  listToolsByRiskLevel,
  listCanonicalToolCatalogEntries,
  listHostedApiImplementedToolNames,
  listHostedApiToolCatalogEntries,
} from './data/index.js';
export type {
  ToolCostClass,
  ToolCostMetadata,
  ToolRiskLevel,
} from './data/toolCostMetadata.js';
export type {
  CanonicalToolCatalogEntry,
  ToolCatalogApiExecutorSupport,
  ToolCatalogCostMetadataStatus,
  ToolCatalogDefinitionSource,
  ToolCatalogFamily,
  ToolCatalogHostedApiSurface,
  ToolCatalogPromptContractStatus,
  ToolCatalogWorkflowEligibility,
} from './data/toolCatalog.js';
export type {
  PermissionGateInput,
  PermissionGateOutcome,
  ToolPermission,
  ToolPermissionDecision,
} from './data/toolPermissions.js';

// Literal-prompt override marker (Phase 8.2-prep). PUBLIC-bucket tool
// definitions import this sentinel from contracts/ instead of PRIVATE
// `prompts/`.
export { LITERAL_PROMPT_OVERRIDE } from './promptOverrideMarker.js';

// Backbone tool-name catalog constants (Phase 8.2-prep). Pure-data
// tool-name lists consumed by `contracts/data/toolCatalog.ts` and
// re-exported from `backbone/` for back-compat.
export {
  BACKBONE_APP_TOOL_NAMES,
  BACKBONE_COMPOSITION_TOOL_NAMES,
  BACKBONE_DURABLE_HOSTED_CREATIVE_TOOL_NAMES,
  BACKBONE_GENERATION_TOOL_NAMES,
  BACKBONE_HOSTED_APP_TOOL_NAMES,
} from './backboneToolCatalog.js';
export type { BackboneAppToolName } from './backboneToolCatalog.js';

// Backbone durable-workflow shape contracts (Phase 8.2-prep). Type-
// only / pure-data slice consumed by `runtime/durableWorkflowClient.ts`
// and re-exported from `backbone/` for back-compat.
export {
  BACKBONE_DURABLE_HOSTED_STEP_TOOL_NAMES,
  BACKBONE_MODEL_KB_VERSION,
  BACKBONE_ROUTING_POLICY_VERSION,
  BACKBONE_SCHEMA_VERSION,
} from './backboneDurableWorkflow.js';
export type {
  BackboneDurableHostedStepToolName,
  BackboneDurableWorkflowInput,
  BackboneDurableWorkflowPlanStep,
  BackboneDurableWorkflowRunContract,
  BackboneDurableWorkflowStepInput,
  BackboneVersionManifest,
  BackboneWorkflowDependencyTransform,
  BackboneWorkflowStatus,
  BackboneWorkflowStepDependencyBinding,
} from './backboneDurableWorkflow.js';

// Storyboard shape contracts (Phase 8.1). Type-only slice consumed by
// `agent/campaignStoryboard.ts` and the `storyboard/` adapter registry
// so neither side has to import the other.
export {
  CAMPAIGN_STORYBOARD_METADATA_PREFIX,
  CAMPAIGN_STORYBOARD_SCHEMA_VERSION,
} from './storyboard.js';
export type {
  CampaignPreservePriority,
  CampaignProductionMode,
  CampaignReferenceAsset,
  CampaignReferenceAssetType,
  CampaignReferenceUsageScope,
  CampaignSceneSpec,
  CampaignStoryboard,
  CampaignStoryboardValidationResult,
  CampaignTransition,
  CampaignVoiceLine,
} from './storyboard.js';

export * from './hostedToolValidation.js';

// Random-theme seeds (Phase 8.5-prep). Pure-data helper extracted from
// `prompts/randomThemes.ts` so PUBLIC-bucket consumers (sogni-web's
// llmHelpers, the future `@sogni-ai/sogni-intelligence-client` carve-
// out) can import without crossing into PRIVATE `prompts/`.
export {
  RANDOM_THEMES,
  RANDOM_LYRICS_THEMES,
  getRandomTheme,
  getRandomLyricsTheme,
} from './randomThemes.js';

// ID-LoRA prompt helpers (Phase 8.5-prep). Self-contained helper module
// extracted from `prompts/audioIdPrompt.ts`. No internal `prompts/`
// dependencies, so the entire surface ships in the PUBLIC bucket.
export {
  ID_LORA_MAX_TOKENS,
  ID_LORA_COMPOSITION_TOOL,
  buildIdLoRaConversionMessages,
  parseToolCallIdLoRaParts,
  formatIdLoRaPrompt,
} from './idLoraPrompt.js';
export type { IdLoRaPromptParts } from './idLoraPrompt.js';

// Image-prompt helpers (Phase 8.5-prep). Model-aware prompt-engineering
// surface (system prompt + tool definition + message builder + parser)
// extracted from `prompts/imagePrompt.ts`. Depends only on the
// contracts-local `randomThemes` plus the already-public runtime and
// tools/definitions type modules.
export {
  IMAGE_PROMPT_MAX_TOKENS,
  IMAGE_PROMPT_TOOL,
  buildImagePromptMessages,
  parseToolCallPrompt,
} from './imagePrompt.js';
export type {
  ImagePromptingType,
  BuildImagePromptMessagesInput,
} from './imagePrompt.js';

// Music-composition prompt helpers (Phase 8.5-prep). Lyrics +
// instrumental composition surface (system prompts, tool definitions,
// message builders, result parser) extracted from
// `prompts/musicComposition.ts`. Depends only on the already-public
// `media/musicSettings` and the contracts-local `randomThemes`.
export {
  LYRICS_MAX_TOKENS,
  LYRICS_COMPOSITION_TOOL,
  INSTRUMENTAL_COMPOSITION_TOOL,
  buildLyricsMessages,
  buildInstrumentalMessages,
  parseToolCallResult,
} from './musicComposition.js';
export type { LyricsGenerationResult } from './musicComposition.js';

// Video-composition prompt helpers (Phase 8.5-prep). LTX-2 + Wan 2.2
// video prompt-engineering surface (system prompts, tool definition,
// message builders, parser, supporting types) extracted from
// `prompts/videoComposition.ts`. Depends only on the contracts-local
// `randomThemes`, the already-public `runtime/chatTypes` /
// `tools/definitions/types`, and the pure-logic
// `tools/shared/llmHelpers` module (zero further imports).
export {
  SCRIPT_MAX_TOKENS,
  SCRIPT_COMPOSITION_TOOL,
  CHARACTER_REFERENCE_VIDEO_COMPOSITION_SYSTEM_PROMPT,
  buildLtxScriptMessages,
  buildWanScriptMessages,
  parseToolCallScript,
  buildCharacterReferenceVideoCompositionMessages,
  parseCompositionToolScriptFromResult,
} from './videoComposition.js';
export type {
  VideoFramePromptOptions,
  ScriptOptions,
  GenerateWanPromptParams,
  CharacterReferenceVideoCompositionMessageInput,
  CompositionToolCallResultLike,
} from './videoComposition.js';

// Compose-workflow destination-models shape (Phase 8.5-prep). The only
// piece of `prompts/composeWorkflow.ts` that ships in the PUBLIC bucket
// — a small pure data shape consumed by `buildComposeWorkflowToolArgs`
// and by sogni-web's llmHelpers.
export type { ComposeWorkflowDestinationModels } from './composeWorkflowTypes.js';

// Hosted composition tool helpers (Phase 8.5-prep). Argument-shaping
// helpers and dispatcher-message builder for the hosted synchronous
// creative tools, extracted from `prompts/hostedComposition.ts`. Depends
// only on contracts-local helpers (`composeWorkflowTypes`,
// `imagePrompt`, `randomThemes`, `videoComposition`) plus the
// already-public `runtime/chatTypes` and `workflows/types`.
export {
  HOSTED_COMPOSITION_ROUTER_MAX_TOKENS,
  buildEnhancePromptToolArgs,
  buildLyricsCompositionToolArgs,
  buildInstrumentalCompositionToolArgs,
  buildScriptCompositionToolArgs,
  buildComposeWorkflowToolArgs,
  buildComposeWorkflowTemplateToolArgs,
  buildWanScriptCompositionToolArgs,
  buildHostedCompositionToolMessages,
} from './hostedComposition.js';
export type {
  HostedCompositionToolName,
  HostedCompositionToolRequest,
  BuildEnhancePromptToolArgsInput,
  BuildLyricsCompositionToolArgsInput,
  BuildInstrumentalCompositionToolArgsInput,
  BuildScriptCompositionToolArgsInput,
  BuildComposeWorkflowToolArgsInput,
  ComposeWorkflowTemplateInputDeclArg,
  BuildComposeWorkflowTemplateToolArgsInput,
} from './hostedComposition.js';
