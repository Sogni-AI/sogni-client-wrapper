/**
 * Sogni Client Wrapper
 * Enhanced Node.js wrapper for Sogni AI SDK with n8n compatibility
 */

// Main client
export { SogniClientWrapper } from './client/SogniClientWrapper';

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
  WalletBalanceProvider,
  WalletBalanceInfo,
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
  ExecuteChatToolsOptions,
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
  ContentPart,
  TextContentPart,
  ImageUrlContentPart,
  ChatCompletionParams,
  ChatCompletionChunk,
  ChatCompletionResult,
  ChatJobStateEvent,
  ChatTokenUsage,
  LLMCostEstimation,
  LLMJobCost,
  LLMModelInfo,
  LLMParamConstraint,
  ToolDefinition,
  ToolCall,
  ToolCallDelta,
  ToolCallFunction,
  ToolChoice,
  ToolFunction,
  ToolExecutionOptions,
  ToolExecutionProgress,
  ToolExecutionResult,
  ToolHistoryEntry,
  InputMedia,
  ProjectEvent,
  JobEvent,
  // ControlNet types
  ControlNetParams,
  ControlNetName,
  ControlNetMode,
  VideoControlNetName,
  VideoControlNetParams,
} from './types';

export { ClientEvent } from './types';

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
} from './utils/errors';

// Utilities
export {
  generateAppId,
  validateClientConfig,
  validateProjectConfig,
  isImageProjectConfig,
  isVideoProjectConfig,
  isAudioProjectConfig,
  isCookieAuth,
  sleep,
  retry,
  formatBytes,
  formatDuration,
  getMaxContextImages,
  supportsContextImages,
} from './utils/helpers';

// SDK chat tool-calling helpers
export {
  ChatStream,
  ChatToolsApi,
  CurrentAccount,
  SogniTools,
  buildSogniTools,
  isSogniToolCall,
  parseToolCallArguments,
} from '@sogni-ai/sogni-client';

// Default export
export { SogniClientWrapper as default } from './client/SogniClientWrapper';
