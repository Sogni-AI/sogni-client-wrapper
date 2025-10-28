/**
 * Enhanced Sogni Client Wrapper
 * Provides a simplified, promise-based interface to the Sogni AI SDK
 */

import { EventEmitter } from 'events';
import { SogniClient, Project, Job, AvailableModel } from '@sogni-ai/sogni-client';
import type {
  SogniClientConfig,
  ProjectConfig,
  ProjectResult,
  ProjectProgress,
  ConnectionStatus,
  ConnectionState,
  ModelInfo,
  BalanceInfo,
  SizePreset,
  GetModelsOptions,
  ClientEventCallbacks,
} from '../types';
import { ClientEvent } from '../types';
import {
  SogniError,
  SogniConnectionError,
  SogniAuthenticationError,
  SogniProjectError,
  SogniTimeoutError,
  SogniModelNotFoundError,
} from '../utils/errors';
import {
  generateAppId,
  validateClientConfig,
  validateProjectConfig,
  waitFor,
  retry,
} from '../utils/helpers';

/**
 * Enhanced Sogni Client with improved developer experience
 */
export class SogniClientWrapper extends EventEmitter {
  private client: SogniClient | null = null;
  private config: Required<SogniClientConfig>;
  private connectionState: ConnectionState;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isReconnecting: boolean = false;

  constructor(config: SogniClientConfig) {
    super();

    // Validate configuration
    validateClientConfig(config);

    // Set defaults
    this.config = {
      username: config.username,
      password: config.password,
      appId: config.appId || generateAppId(),
      network: config.network || 'fast',
      autoConnect: config.autoConnect !== false,
      reconnect: config.reconnect !== false,
      reconnectInterval: config.reconnectInterval || 5000,
      timeout: config.timeout || 300000, // 5 minutes default
      debug: config.debug || false,
    };

    // Initialize connection state
    this.connectionState = {
      status: 'disconnected' as ConnectionStatus,
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
    };

    // Auto-connect if enabled
    if (this.config.autoConnect) {
      this.connect().catch((error) => {
        this.log('Auto-connect failed:', error);
        this.emit(ClientEvent.ERROR, SogniError.fromError(error, 'AUTO_CONNECT_FAILED').toErrorData());
      });
    }
  }

  /**
   * Connect to Sogni Supernet
   */
  async connect(): Promise<void> {
    if (this.connectionState.isConnected) {
      this.log('Already connected');
      return;
    }

    if (this.connectionState.isConnecting) {
      this.log('Connection already in progress');
      await waitFor(() => this.connectionState.isConnected, {
        timeout: 30000,
        timeoutMessage: 'Connection timeout',
      });
      return;
    }

    this.updateConnectionState({ status: 'connecting' as ConnectionStatus, isConnecting: true });

    try {
      this.log('Creating Sogni client...');
      
      // Create client instance
      this.client = await SogniClient.createInstance({
        appId: this.config.appId,
        network: this.config.network,
      });

      this.log('Logging in...');
      
      // Login and establish WebSocket connection
      await this.client.account.login(this.config.username, this.config.password);

      this.log('Waiting for models...');
      
      // Wait for models to be available
      await this.client.projects.waitForModels();

      this.log('Connected successfully');

      this.updateConnectionState({
        status: 'connected' as ConnectionStatus,
        isConnected: true,
        isConnecting: false,
        reconnectAttempts: 0,
        connectedAt: new Date(),
      });

      this.emit(ClientEvent.CONNECTED);

      // Set up event listeners
      this.setupEventListeners();

    } catch (error) {
      this.log('Connection failed:', error);
      
      const sogniError = error instanceof Error && error.message.includes('auth')
        ? new SogniAuthenticationError('Authentication failed', undefined, error as Error)
        : new SogniConnectionError('Failed to connect to Sogni Supernet', undefined, error as Error);

      this.updateConnectionState({
        status: 'failed' as ConnectionStatus,
        isConnected: false,
        isConnecting: false,
        lastError: sogniError.toErrorData(),
      });

      this.emit(ClientEvent.ERROR, sogniError.toErrorData());

      // Attempt reconnection if enabled
      if (this.config.reconnect && !this.isReconnecting) {
        this.scheduleReconnect();
      }

      throw sogniError;
    }
  }

  /**
   * Disconnect from Sogni Supernet
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isReconnecting = false;

    if (this.client) {
      // Note: Sogni SDK doesn't have explicit disconnect method
      // Connection is managed by the SDK
      this.client = null;
    }

    this.updateConnectionState({
      status: 'disconnected' as ConnectionStatus,
      isConnected: false,
      isConnecting: false,
    });

    this.emit(ClientEvent.DISCONNECTED);
    this.log('Disconnected');
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connectionState.isConnected && this.client !== null;
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Get available models
   */
  async getAvailableModels(options: GetModelsOptions = {}): Promise<ModelInfo[]> {
    await this.ensureConnected();

    let models = this.client!.projects.availableModels;

    // Filter by network if specified
    if (options.network) {
      // Note: Sogni SDK doesn't expose network per model, so we return all
      // This is a limitation of the underlying SDK
    }

    // Filter by minimum workers
    if (options.minWorkers !== undefined) {
      models = models.filter((m) => m.workerCount >= options.minWorkers!);
    }

    // Sort by worker count
    if (options.sortByWorkers) {
      models = [...models].sort((a, b) => b.workerCount - a.workerCount);
    }

    // Convert to ModelInfo format
    return models.map((model) => ({
      ...model,
      isAvailable: model.workerCount > 0,
      recommendedSettings: this.getRecommendedSettings(model.id),
    }));
  }

  /**
   * Get model by ID
   */
  async getModel(modelId: string): Promise<ModelInfo> {
    const models = await this.getAvailableModels();
    const model = models.find((m) => m.id === modelId);

    if (!model) {
      throw new SogniModelNotFoundError(modelId);
    }

    return model;
  }

  /**
   * Get the most popular model (highest worker count)
   */
  async getMostPopularModel(): Promise<ModelInfo> {
    const models = await this.getAvailableModels({ sortByWorkers: true });
    
    if (models.length === 0) {
      throw new SogniError('No models available', 'NO_MODELS_AVAILABLE');
    }

    return models[0];
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<BalanceInfo> {
    await this.ensureConnected();

    // Use the correct refreshBalance() method from the account API
    const balances = await this.client!.account.refreshBalance();

    // The refreshBalance() method returns a Balances object with sogni and spark properties
    // Each contains multiple balance fields - we'll use the 'net' balance which represents
    // the actual available balance (settled + credit - debit)
    return {
      sogni: parseFloat(balances.sogni.net) || 0,
      spark: parseFloat(balances.spark.net) || 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get size presets for a model
   */
  async getSizePresets(network: 'fast' | 'relaxed', modelId: string): Promise<SizePreset[]> {
    await this.ensureConnected();

    try {
      const presets = await this.client!.projects.getSizePresets(network, modelId);
      return presets as SizePreset[];
    } catch (error) {
      throw SogniError.fromError(error, 'GET_SIZE_PRESETS_FAILED');
    }
  }

  /**
   * Create a project and optionally wait for completion
   */
  async createProject(config: ProjectConfig): Promise<ProjectResult> {
    await this.ensureConnected();

    // Validate project configuration
    validateProjectConfig(config);

    const {
      waitForCompletion = true,
      timeout = this.config.timeout,
      onProgress,
      onJobCompleted,
      onJobFailed,
      ...projectParams
    } = config;

    try {
      this.log('Creating project with config:', this.sanitizeConfig(config));

      // Prepare project params with defaults for required SDK fields
      const sdkParams = {
        ...projectParams,
        negativePrompt: projectParams.negativePrompt || '',
        stylePrompt: projectParams.stylePrompt || '',
      };

      // Create the project
      const project = await this.client!.projects.create(sdkParams);

      this.emit(ClientEvent.PROJECT_CREATED, project);

      // Set up event listeners for this project
      if (onProgress) {
        project.on('progress', (progress: number) => {
          const progressData: ProjectProgress = {
            projectId: project.id,
            percentage: progress,
            completedJobs: 0, // SDK doesn't provide this
            totalJobs: projectParams.numberOfImages || 1,
          };
          onProgress(progressData);
          this.emit(ClientEvent.PROJECT_PROGRESS, progressData);
        });
      }

      if (onJobCompleted) {
        project.on('jobCompleted', (job: Job) => {
          onJobCompleted(job);
        });
      }

      if (onJobFailed) {
        project.on('jobFailed', (job: Job) => {
          onJobFailed(job);
        });
      }

      // If not waiting for completion, return immediately
      if (!waitForCompletion) {
        return {
          project,
          completed: false,
        };
      }

      // Wait for completion with timeout
      this.log('Waiting for project completion...');
      
      const imageUrls = await Promise.race([
        project.waitForCompletion(),
        this.createTimeoutPromise<string[]>(timeout),
      ]);

      this.log('Project completed successfully');

      const result: ProjectResult = {
        project,
        imageUrls,
        completed: true,
      };

      this.emit(ClientEvent.PROJECT_COMPLETED, result);

      return result;

    } catch (error) {
      this.log('Project failed:', error);
      
      const projectError = error instanceof SogniTimeoutError
        ? error
        : new SogniProjectError('Project creation failed', undefined, error as Error);

      this.emit(ClientEvent.PROJECT_FAILED, projectError.toErrorData());

      throw projectError;
    }
  }

  /**
   * Create a project with retry logic
   */
  async createProjectWithRetry(
    config: ProjectConfig,
    options: { maxAttempts?: number; retryDelay?: number } = {}
  ): Promise<ProjectResult> {
    const { maxAttempts = 3, retryDelay = 2000 } = options;

    return retry(
      () => this.createProject(config),
      {
        maxAttempts,
        initialDelay: retryDelay,
        onRetry: (attempt, error) => {
          this.log(`Retry attempt ${attempt} after error:`, error.message);
        },
      }
    );
  }

  /**
   * Ensure client is connected, connect if not
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected()) {
      await this.connect();
    }
  }

  /**
   * Set up event listeners on the underlying client
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    // Monitor connection health
    // Note: Sogni SDK doesn't expose connection events directly
    // We would need to monitor WebSocket state if exposed
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.isReconnecting = true;
    this.updateConnectionState({
      status: 'reconnecting' as ConnectionStatus,
      reconnectAttempts: this.connectionState.reconnectAttempts + 1,
    });

    this.emit(ClientEvent.RECONNECTING, this.connectionState.reconnectAttempts);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      
      try {
        await this.connect();
        this.isReconnecting = false;
        this.emit(ClientEvent.RECONNECTED);
      } catch (error) {
        this.log('Reconnection failed:', error);
        
        if (this.config.reconnect) {
          this.scheduleReconnect();
        } else {
          this.isReconnecting = false;
        }
      }
    }, this.config.reconnectInterval);
  }

  /**
   * Update connection state
   */
  private updateConnectionState(updates: Partial<ConnectionState>): void {
    this.connectionState = {
      ...this.connectionState,
      ...updates,
    };
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new SogniTimeoutError(`Operation timed out after ${timeoutMs}ms`, timeoutMs));
      }, timeoutMs);
    });
  }

  /**
   * Get recommended settings for a model
   */
  private getRecommendedSettings(modelId: string): ModelInfo['recommendedSettings'] {
    // Provide sensible defaults based on model type
    if (modelId.includes('flux')) {
      return { steps: 4, guidance: 3.5 };
    }
    if (modelId.includes('lightning') || modelId.includes('turbo') || modelId.includes('lcm')) {
      return { steps: 4, guidance: 1.0 };
    }
    return { steps: 20, guidance: 7.5 };
  }

  /**
   * Sanitize configuration for logging
   */
  private sanitizeConfig(config: any): any {
    const sanitized = { ...config };
    if (sanitized.password) sanitized.password = '***';
    return sanitized;
  }

  /**
   * Log debug messages
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[SogniClientWrapper]', ...args);
    }
  }

  /**
   * Type-safe event listener
   */
  on<E extends ClientEvent>(event: E, listener: ClientEventCallbacks[E]): this {
    return super.on(event, listener);
  }

  /**
   * Type-safe event emitter
   */
  emit<E extends ClientEvent>(event: E, ...args: Parameters<ClientEventCallbacks[E]>): boolean {
    return super.emit(event, ...args);
  }
}

