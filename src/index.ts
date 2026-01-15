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
  ProjectConfig,
  ImageProjectConfig,
  VideoProjectConfig,
  ProjectResult,
  ProjectProgress,
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
  // Re-exported from Sogni SDK
  Project,
  Job,
  AvailableModel,
  SupernetType,
  TokenType,
  ImageOutputFormat,
  VideoOutputFormat,
  AudioFormat,
  VideoFormat,
  VideoWorkflowType,
  // ControlNet types
  ControlNetParams,
  ControlNetName,
  ControlNetMode,
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
  isCookieAuth,
  sleep,
  retry,
  formatBytes,
  formatDuration,
} from './utils/helpers';

// Default export
export { SogniClientWrapper as default } from './client/SogniClientWrapper';

