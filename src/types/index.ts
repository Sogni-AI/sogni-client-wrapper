/**
 * Type definitions for Sogni Client Wrapper
 */

import type {
  Project,
  Job,
  AvailableModel,
  ProjectParams as SogniProjectParams,
  ImageProjectParams as SogniImageProjectParams,
  VideoProjectParams as SogniVideoProjectParams,
  SupernetType,
  TokenType,
  ImageOutputFormat,
  VideoOutputFormat,
  AudioFormat,
  VideoFormat,
  VideoWorkflowType,
} from '@sogni-ai/sogni-client';

import type {
  ControlNetParams,
  ControlNetName,
  ControlNetMode,
} from '@sogni-ai/sogni-client/dist/Projects/types/ControlNetParams';

import type { InputMedia } from '@sogni-ai/sogni-client/dist/Projects/types';

// Re-export types from Sogni SDK
export type {
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
  ControlNetParams,
  ControlNetName,
  ControlNetMode,
  InputMedia,
};

/**
 * Authentication type for the Sogni client
 * - 'token': Uses username/password login with token-based auth (default, for Node.js apps)
 * - 'cookies': Uses httpOnly cookie auth (for browser apps on .sogni.ai subdomains)
 */
export type AuthType = 'token' | 'cookies';

/**
 * Base configuration fields shared by all auth types
 */
interface BaseClientConfig {
  /** Unique application identifier (auto-generated if not provided) */
  appId?: string;

  /** Network type to use */
  network?: SupernetType;

  /** Automatically connect on client creation */
  autoConnect?: boolean;

  /** Automatically reconnect on connection loss */
  reconnect?: boolean;

  /** Interval between reconnection attempts in milliseconds */
  reconnectInterval?: number;

  /** Default timeout for operations in milliseconds */
  timeout?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Configuration for token-based authentication (default)
 * Requires username and password
 */
export interface TokenAuthConfig extends BaseClientConfig {
  /** Authentication type - 'token' for username/password login */
  authType?: 'token';

  /** Sogni account username */
  username: string;

  /** Sogni account password */
  password: string;
}

/**
 * Configuration for cookie-based authentication
 * Username and password are not required - uses existing browser session
 */
export interface CookieAuthConfig extends BaseClientConfig {
  /** Authentication type - 'cookies' for browser session auth */
  authType: 'cookies';

  /** Username is optional with cookie auth */
  username?: string;

  /** Password is optional with cookie auth */
  password?: string;
}

/**
 * Configuration for the Sogni Client Wrapper
 * Supports both token-based (Node.js) and cookie-based (browser) authentication
 */
export type SogniClientConfig = TokenAuthConfig | CookieAuthConfig;

/**
 * Base project configuration with additional options
 */
interface BaseProjectConfig {
  /** Model ID to use for generation */
  modelId: string;

  /** Negative prompt (optional) */
  negativePrompt?: string;

  /** Style prompt (optional) */
  stylePrompt?: string;

  /** Wait for project completion before returning */
  waitForCompletion?: boolean;

  /** Timeout for this specific project (overrides client timeout) */
  timeout?: number;

  /** Progress callback function */
  onProgress?: (progress: ProjectProgress) => void;

  /** Job completed callback */
  onJobCompleted?: (job: Job) => void;

  /** Job failed callback */
  onJobFailed?: (job: Job) => void;
}

/**
 * Image project configuration
 */
export interface ImageProjectConfig extends
  Omit<SogniImageProjectParams, 'modelId' | 'negativePrompt' | 'stylePrompt'>,
  BaseProjectConfig {
}

/**
 * Video project configuration
 */
export interface VideoProjectConfig extends
  Omit<SogniVideoProjectParams, 'modelId' | 'negativePrompt' | 'stylePrompt'>,
  BaseProjectConfig {
}

/**
 * Enhanced project configuration with additional options
 */
export type ProjectConfig = ImageProjectConfig | VideoProjectConfig;

/**
 * Project creation result
 */
export interface ProjectResult {
  /** Project instance */
  project: Project;

  /** Array of generated image URLs (if waitForCompletion is true and project is image type) */
  imageUrls?: string[];

  /** Array of generated video URLs (if waitForCompletion is true and project is video type) */
  videoUrls?: string[];

  /** Array of completed jobs */
  jobs?: Job[];

  /** Project completion status */
  completed: boolean;

  /** Error information if project failed */
  error?: ErrorData;
}

/**
 * Progress information for a project
 */
export interface ProjectProgress {
  /** Project ID */
  projectId: string;
  
  /** Completion percentage (0-100) */
  percentage: number;
  
  /** Number of completed jobs */
  completedJobs: number;
  
  /** Total number of jobs */
  totalJobs: number;
  
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
}

/**
 * Error data structure
 */
export interface ErrorData {
  /** Error code */
  code: string;
  
  /** Error message */
  message: string;
  
  /** HTTP status code (if applicable) */
  statusCode?: number;
  
  /** Additional error details */
  details?: any;
  
  /** Original error object */
  originalError?: Error;
}

/**
 * Connection status
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

/**
 * Connection state information
 */
export interface ConnectionState {
  /** Current connection status */
  status: ConnectionStatus;
  
  /** Whether client is connected */
  isConnected: boolean;
  
  /** Whether client is connecting */
  isConnecting: boolean;
  
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  
  /** Last connection error */
  lastError?: ErrorData;
  
  /** Connection timestamp */
  connectedAt?: Date;
}

/**
 * Size preset information
 */
export interface SizePreset {
  /** Preset ID */
  id: string;
  
  /** Human-readable label */
  label: string;
  
  /** Width in pixels */
  width: number;
  
  /** Height in pixels */
  height: number;
  
  /** Aspect ratio string (e.g., "16:9") */
  ratio: string;
  
  /** Aspect ratio as decimal */
  aspect: string;
}

/**
 * Model information with additional metadata
 */
export interface ModelInfo extends AvailableModel {
  /** Whether model is currently available */
  isAvailable: boolean;

  /** Recommended settings for this model */
  recommendedSettings?: {
    steps?: number;
    guidance?: number;
    scheduler?: string;
    frames?: number; // For video models
    fps?: number; // For video models
  };
}

/**
 * Balance information
 */
export interface BalanceInfo {
  /** SOGNI token balance */
  sogni: number;
  
  /** Spark token balance */
  spark: number;
  
  /** Total balance in USD equivalent (if available) */
  usdEquivalent?: number;
  
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Client event types
 */
export const ClientEvent = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  RECONNECTED: 'reconnected',
  ERROR: 'error',
  MODELS_UPDATED: 'modelsUpdated',
  BALANCE_UPDATED: 'balanceUpdated',
  PROJECT_CREATED: 'projectCreated',
  PROJECT_PROGRESS: 'projectProgress',
  PROJECT_COMPLETED: 'projectCompleted',
  PROJECT_FAILED: 'projectFailed',
  JOB_COMPLETED: 'jobCompleted',
  JOB_FAILED: 'jobFailed',
} as const;

export type ClientEvent = typeof ClientEvent[keyof typeof ClientEvent];

/**
 * Job completion information
 */
export interface JobCompletedData {
  /** Project ID */
  projectId: string;

  /** Job instance */
  job: Job;

  /** Image URL (if available for image projects) */
  imageUrl?: string;

  /** Video URL (if available for video projects) */
  videoUrl?: string;

  /** Job index in the batch */
  jobIndex: number;

  /** Total number of jobs in the project */
  totalJobs: number;
}

/**
 * Job failure information
 */
export interface JobFailedData {
  /** Project ID */
  projectId: string;

  /** Job instance */
  job: Job;

  /** Error message */
  error?: string;

  /** Job index in the batch */
  jobIndex: number;

  /** Total number of jobs in the project */
  totalJobs: number;
}

/**
 * Event listener callback types
 */
export interface ClientEventCallbacks {
  [ClientEvent.CONNECTED]: () => void;
  [ClientEvent.DISCONNECTED]: () => void;
  [ClientEvent.RECONNECTING]: (attempt: number) => void;
  [ClientEvent.RECONNECTED]: () => void;
  [ClientEvent.ERROR]: (error: ErrorData) => void;
  [ClientEvent.MODELS_UPDATED]: (models: ModelInfo[]) => void;
  [ClientEvent.BALANCE_UPDATED]: (balance: BalanceInfo) => void;
  [ClientEvent.PROJECT_CREATED]: (project: Project) => void;
  [ClientEvent.PROJECT_PROGRESS]: (progress: ProjectProgress) => void;
  [ClientEvent.PROJECT_COMPLETED]: (result: ProjectResult) => void;
  [ClientEvent.PROJECT_FAILED]: (error: ErrorData) => void;
  [ClientEvent.JOB_COMPLETED]: (data: JobCompletedData) => void;
  [ClientEvent.JOB_FAILED]: (data: JobFailedData) => void;
}

/**
 * Options for getting models
 */
export interface GetModelsOptions {
  /** Filter by network type */
  network?: SupernetType;
  
  /** Minimum worker count */
  minWorkers?: number;
  
  /** Sort by worker count */
  sortByWorkers?: boolean;
}

/**
 * Options for creating a project
 */
export type CreateProjectOptions = ProjectConfig & {
  /** Retry failed projects */
  retry?: boolean;

  /** Number of retry attempts */
  retryAttempts?: number;

  /** Delay between retries in milliseconds */
  retryDelay?: number;
};

/**
 * Configuration for Qwen Image Edit models.
 * These models support up to 3 context images for multi-reference editing.
 *
 * Supported models:
 * - qwen_image_edit_2511_fp8 (standard, 20 steps recommended)
 * - qwen_image_edit_2511_fp8_lightning (fast, 4 steps recommended)
 */
export interface QwenImageEditConfig extends Omit<ImageProjectConfig, 'type'> {
  /** Context images for the edit operation (max 3 for Qwen models) */
  contextImages?: InputMedia[];
}
