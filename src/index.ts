/**
 * Sogni Client Wrapper
 * Enhanced Node.js wrapper for Sogni AI SDK with n8n compatibility
 */

// Main client
export { SogniClientWrapper } from './client/SogniClientWrapper.js';

// Types
export type {
  SogniClientConfig,
  AuthType,
  TokenAuthConfig,
  CookieAuthConfig,
  ApiKeyAuthConfig,
  ProjectConfig,
  ImageProjectConfig,
  VideoProjectConfig,
  AudioProjectConfig,
  ProjectResult,
  ProjectProgress,
  VideoCostEstimateParams,
  AudioCostEstimateParams,
  CostEstimate,
  ConnectionStatus,
  ConnectionState,
  ModelInfo,
  BalanceInfo,
  SizePreset,
  GetModelsOptions,
  CreateProjectOptions,
  ErrorData,
  JobCompletedData,
  JobFailedData,
  ChatErrorData,
  QwenImageEditConfig,
  // Re-exported from Sogni SDK
  Project,
  Job,
  AvailableModel,
  SupernetType,
  TokenType,
  AudioProjectParams,
  ImageOutputFormat,
  VideoOutputFormat,
  AudioOutputFormat,
  AudioFormat,
  VideoFormat,
  VideoWorkflowType,
  ChatMessage,
  ChatCompletionParams,
  ChatCompletionChunk,
  ChatCompletionResult,
  ChatJobStateEvent,
  ContentPart,
  TextContentPart,
  ImageUrlContentPart,
  ChatTokenUsage,
  LLMCostEstimation,
  LLMJobCost,
  LLMModelInfo,
  LLMParamConstraint,
  LLMSamplingDefaults,
  ToolDefinition,
  ToolCall,
  ToolCallDelta,
  ToolCallFunction,
  ToolChoice,
  ToolFunction,
  SogniToolsMode,
  ToolExecutionOptions,
  ToolExecutionProgress,
  ToolExecutionResult,
  ToolHistoryEntry,
  CreativeWorkflowArtifact,
  CreativeWorkflowEvent,
  CreativeWorkflowRecord,
  CreativeWorkflowSseEvent,
  CreativeWorkflowStatus,
  CreativeWorkflowHostedToolName,
  ListCreativeWorkflowOptions,
  StartCreativeWorkflowOptions,
  StartCreativeWorkflowParams,
  StreamCreativeWorkflowEventsOptions,
  InputMedia,
  ProjectEvent,
  JobEvent,
  // ControlNet types
  ControlNetParams,
  ControlNetName,
  ControlNetMode,
  VideoControlNetName,
  VideoControlNetParams,
} from './types/index.js';

export { ClientEvent } from './types/index.js';

// Errors
export {
  SogniError,
  SogniConnectionError,
  SogniAuthenticationError,
  SogniProjectError,
  SogniTimeoutError,
  SogniBalanceError,
  SogniValidationError,
  SogniConfigurationError,
  SogniModelNotFoundError,
  SogniNetworkError,
} from './utils/errors.js';

// Utilities
export {
  generateAppId,
  validateClientConfig,
  validateProjectConfig,
  isImageProjectConfig,
  isVideoProjectConfig,
  isAudioProjectConfig,
  isWanVideoModel,
  isLtxVideoModel,
  isSeedanceVideoModel,
  isCookieAuth,
  sleep,
  retry,
  formatBytes,
  formatDuration,
  getMaxContextImages,
  supportsContextImages,
} from './utils/helpers.js';

// SDK chat tool-calling helpers
export {
  ChatStream,
  CreativeWorkflowsApi,
  SogniClient,
  SogniTools,
  isSogniToolCall,
  parseCreativeWorkflowSseChunk,
  parseToolCallArguments,
} from '@sogni-ai/sogni-client';

// Default export
export { SogniClientWrapper as default } from './client/SogniClientWrapper.js';
