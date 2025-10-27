/**
 * Type definitions for Sogni Client Wrapper
 */

import type {
  Project,
  Job,
  AvailableModel,
  ProjectParams as SogniProjectParams,
  SupernetType,
  TokenType,
  OutputFormat,
  Scheduler,
  TimeStepSpacing,
} from '@sogni-ai/sogni-client';

import type {
  ControlNetParams,
  ControlNetName,
  ControlNetMode,
} from '@sogni-ai/sogni-client/dist/Projects/types/ControlNetParams';

// Re-export types from Sogni SDK
export type {
  Project,
  Job,
  AvailableModel,
  SupernetType,
  TokenType,
  OutputFormat,
  Scheduler,
  TimeStepSpacing,
  ControlNetParams,
  ControlNetName,
  ControlNetMode,
};

/**
 * Configuration for the Sogni Client Wrapper
 */
export interface SogniClientConfig {
  /** Sogni account username */
  username: string;
  
  /** Sogni account password */
  password: string;
  
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
 * Enhanced project configuration with additional options
 */
export interface ProjectConfig extends Omit<SogniProjectParams, 'modelId' | 'negativePrompt' | 'stylePrompt'> {
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
 * Project creation result
 */
export interface ProjectResult {
  /** Project instance */
  project: Project;
  
  /** Array of generated image URLs (if waitForCompletion is true) */
  imageUrls?: string[];
  
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
    scheduler?: Scheduler;
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
} as const;

export type ClientEvent = typeof ClientEvent[keyof typeof ClientEvent];

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
export interface CreateProjectOptions extends ProjectConfig {
  /** Retry failed projects */
  retry?: boolean;
  
  /** Number of retry attempts */
  retryAttempts?: number;
  
  /** Delay between retries in milliseconds */
  retryDelay?: number;
}

