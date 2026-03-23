/**
 * Enhanced Sogni Client Wrapper
 * Provides a simplified, promise-based interface to the Sogni AI SDK
 */

import { EventEmitter } from 'events';
import { SogniClient, Project, Job, ChatStream } from '@sogni-ai/sogni-client';
import type {
  SogniClientConfig,
  AuthType,
  CurrentAccount,
  ProjectConfig,
  ImageProjectConfig,
  VideoProjectConfig,
  AudioProjectConfig,
  ProjectResult,
  ProjectProgress,
  ConnectionStatus,
  ConnectionState,
  ModelInfo,
  BalanceInfo,
  SizePreset,
  GetModelsOptions,
  ClientEventCallbacks,
  JobCompletedData,
  JobFailedData,
  QwenImageEditConfig,
  ProjectEvent,
  JobEvent,
  InputMedia,
  VideoCostEstimateParams,
  AudioCostEstimateParams,
  CostEstimate,
  ChatMessage,
  ChatCompletionParams,
  ChatCompletionChunk,
  ChatCompletionResult,
  ChatJobStateEvent,
  ToolCall,
  ToolExecutionOptions,
  ToolExecutionResult,
  ExecuteChatToolsOptions,
  LLMCostEstimation,
  LLMModelInfo,
  ChatErrorData,
  WalletBalanceInfo,
} from '../types';
import { ClientEvent } from '../types';
import {
  SogniError,
  SogniConnectionError,
  SogniAuthenticationError,
  SogniProjectError,
  SogniTimeoutError,
  SogniModelNotFoundError,
  SogniValidationError,
} from '../utils/errors';
import {
  generateAppId,
  validateClientConfig,
  validateProjectConfig,
  isImageProjectConfig,
  isVideoProjectConfig,
  isAudioProjectConfig,
  waitFor,
  retry,
  getMaxContextImages,
} from '../utils/helpers';

const MIN_VIDEO_DIMENSION = 480;
const MAX_VIDEO_DIMENSION = 1536;
const VIDEO_DIMENSION_MULTIPLE = 16;
const LTX2_FRAME_STEP = 8;

/**
 * Internal configuration type with resolved defaults
 */
interface InternalConfig {
  username: string;
  password: string;
  apiKey?: string;
  appId: string;
  network: 'fast' | 'relaxed';
  testnet?: boolean;
  socketEndpoint?: string;
  restEndpoint?: string;
  disableSocket?: boolean;
  allowInsecureTLS?: boolean;
  autoConnect: boolean;
  reconnect: boolean;
  reconnectInterval: number;
  timeout: number;
  debug: boolean;
  authType: AuthType;
}

/**
 * Enhanced Sogni Client with improved developer experience
 */
export class SogniClientWrapper extends EventEmitter {
  private client: SogniClient | null = null;
  private config: InternalConfig;
  private connectionState: ConnectionState;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isReconnecting: boolean = false;
  private projectEventHandler: ((event: ProjectEvent) => void) | null = null;
  private jobEventHandler: ((event: JobEvent) => void) | null = null;
  private chatTokenEventHandler: ((chunk: ChatCompletionChunk) => void) | null = null;
  private chatCompletedEventHandler: ((result: ChatCompletionResult) => void) | null = null;
  private chatErrorEventHandler: ((error: ChatErrorData) => void) | null = null;
  private chatJobStateEventHandler: ((state: ChatJobStateEvent) => void) | null = null;
  private chatModelsUpdatedEventHandler: ((models: Record<string, LLMModelInfo>) => void) | null = null;
  private projectEtaSeconds = new Map<string, number>();

  constructor(config: SogniClientConfig) {
    super();

    // Avoid Node's special-case 'error' event crashing the process when users
    // haven't attached an error listener yet (especially with autoConnect).
    this.on(ClientEvent.ERROR, (_error) => {});

    // Validate configuration
    validateClientConfig(config);

    // Set defaults - username/password default to empty for cookie auth
    this.config = {
      username: config.username || '',
      password: config.password || '',
      apiKey: config.apiKey,
      appId: config.appId || generateAppId(),
      network: config.network || 'fast',
      testnet: config.testnet,
      socketEndpoint: config.socketEndpoint,
      restEndpoint: config.restEndpoint,
      disableSocket: config.disableSocket,
      allowInsecureTLS: config.allowInsecureTLS,
      autoConnect: config.autoConnect !== false,
      reconnect: config.reconnect !== false,
      reconnectInterval: config.reconnectInterval || 5000,
      timeout: config.timeout || 300000, // 5 minutes default
      debug: config.debug || false,
      authType: config.authType || (config.apiKey ? 'apiKey' : 'token'),
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

      if (this.config.allowInsecureTLS) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        this.log('TLS verification disabled (allowInsecureTLS=true)');
      }

      // Create client instance with auth type
      this.client = await SogniClient.createInstance({
        appId: this.config.appId,
        network: this.config.network,
        authType: this.config.authType,
        apiKey: this.config.apiKey,
        testnet: this.config.testnet,
        socketEndpoint: this.config.socketEndpoint,
        restEndpoint: this.config.restEndpoint,
        disableSocket: this.config.disableSocket,
      });

      // Authentication depends on authType
      if (this.config.authType === 'cookies') {
        this.log('Checking authentication via cookies...');

        // For cookie auth, check if already authenticated
        const isAuthenticated = await this.client.checkAuth();

        if (!isAuthenticated) {
          // If not authenticated via cookies and credentials provided, try login
          if (this.config.username && this.config.password) {
            this.log('Cookie auth failed, attempting login with credentials...');
            await this.client.account.login(this.config.username, this.config.password);
          } else {
            throw new SogniAuthenticationError(
              'Cookie authentication failed and no credentials provided',
              undefined
            );
          }
        }
      } else if (this.config.authType === 'apiKey') {
        this.log('Using API key authentication...');
      } else {
        this.log('Logging in with credentials...');

        // Token auth - login with username/password
        await this.client.account.login(this.config.username, this.config.password);
      }

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
      try {
        if (this.projectEventHandler) {
          this.client.projects.off('project', this.projectEventHandler);
        }
        if (this.jobEventHandler) {
          this.client.projects.off('job', this.jobEventHandler);
        }
        if (this.chatTokenEventHandler) {
          this.client.chat.off('token', this.chatTokenEventHandler);
        }
        if (this.chatCompletedEventHandler) {
          this.client.chat.off('completed', this.chatCompletedEventHandler);
        }
        if (this.chatErrorEventHandler) {
          this.client.chat.off('error', this.chatErrorEventHandler);
        }
        if (this.chatJobStateEventHandler) {
          this.client.chat.off('jobState', this.chatJobStateEventHandler);
        }
        if (this.chatModelsUpdatedEventHandler) {
          this.client.chat.off('modelsUpdated', this.chatModelsUpdatedEventHandler);
        }

        // Properly disconnect WebSocket to avoid connection leaks
        if (this.client.apiClient && this.client.apiClient.socket) {
          this.client.apiClient.socket.disconnect();
          this.log('WebSocket disconnected');
        }
      } catch (error) {
        this.log('Error disconnecting WebSocket:', error);
      }
      this.client = null;
    }
    this.projectEtaSeconds.clear();

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
   * Get available chat/LLM models
   */
  async getAvailableChatModels(): Promise<Record<string, LLMModelInfo>> {
    await this.ensureConnected();
    return this.client!.chat.models;
  }

  /**
   * Wait for chat/LLM models from the network
   */
  async waitForChatModels(timeout: number = 10000): Promise<Record<string, LLMModelInfo>> {
    await this.ensureConnected();
    return this.client!.chat.waitForModels(timeout);
  }

  /**
   * Estimate chat completion cost
   */
  async estimateChatCost(params: {
    model: string;
    messages: ChatMessage[];
    max_tokens?: number;
    tokenType?: 'sogni' | 'spark';
  }): Promise<LLMCostEstimation> {
    await this.ensureConnected();
    return this.client!.chat.estimateCost(params);
  }

  /**
   * Create a chat completion request
   */
  async createChatCompletion(
    params: ChatCompletionParams & { stream: true }
  ): Promise<ChatStream>;
  async createChatCompletion(
    params: ChatCompletionParams & { stream?: false }
  ): Promise<ChatCompletionResult>;
  async createChatCompletion(
    params: ChatCompletionParams
  ): Promise<ChatStream | ChatCompletionResult> {
    await this.ensureConnected();
    return this.client!.chat.completions.create(params as any) as Promise<ChatStream | ChatCompletionResult>;
  }

  /**
   * Get the current tracked account snapshot, if connected
   */
  getCurrentAccount(): CurrentAccount | null {
    return this.client?.account.currentAccount || null;
  }

  /**
   * Get projects currently tracked by the underlying SDK instance
   */
  getTrackedProjects(): Project[] {
    return this.client?.projects.trackedProjects || [];
  }

  /**
   * Execute a single Sogni chat tool call
   */
  async executeChatTool(
    toolCall: ToolCall,
    options: ToolExecutionOptions = {}
  ): Promise<ToolExecutionResult> {
    await this.ensureConnected();
    return this.client!.chat.tools.execute(toolCall, options);
  }

  /**
   * Execute multiple chat tool calls, including mixed Sogni and custom tools
   */
  async executeChatTools(
    toolCalls: ToolCall[],
    options: ExecuteChatToolsOptions = {}
  ): Promise<ToolExecutionResult[]> {
    await this.ensureConnected();
    return this.client!.chat.tools.executeAll(toolCalls, options);
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
   * Get blockchain wallet balance for the current or specified wallet address
   */
  async getWalletBalance(
    walletAddress?: string,
    provider: WalletBalanceInfo['provider'] = 'base'
  ): Promise<WalletBalanceInfo> {
    await this.ensureConnected();

    const resolvedWalletAddress = walletAddress || this.client!.account.currentAccount.walletAddress;
    if (!resolvedWalletAddress) {
      throw new SogniValidationError(
        'Wallet address is required when the current account does not expose one yet'
      );
    }

    const balance = await this.client!.account.walletBalance(resolvedWalletAddress, provider);
    return {
      ...balance,
      walletAddress: resolvedWalletAddress,
      provider,
      fetchedAt: new Date(),
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
   * Estimate video project cost
   */
  async estimateVideoCost(params: VideoCostEstimateParams): Promise<CostEstimate> {
    await this.ensureConnected();

    if (!params.modelId || typeof params.modelId !== 'string') {
      throw new SogniValidationError('Model ID is required and must be a string');
    }
    if (typeof params.width !== 'number' || typeof params.height !== 'number') {
      throw new SogniValidationError('Width and height are required and must be numbers');
    }
    if (typeof params.fps !== 'number' || params.fps <= 0) {
      throw new SogniValidationError('FPS is required and must be a positive number');
    }
    if (typeof params.steps !== 'number' || params.steps <= 0) {
      throw new SogniValidationError('Steps is required and must be a positive number');
    }

    const tokenType = params.tokenType || 'spark';
    const numberOfMedia = params.numberOfMedia || 1;

    let duration = params.duration;
    if (duration === undefined || duration === null) {
      if (params.frames !== undefined && params.frames > 0) {
        const durationFps = this.isWanModel(params.modelId) ? 16 : params.fps;
        duration = Math.max(1, Math.round((params.frames - 1) / durationFps));
      } else {
        duration = 1;
      }
    }

    const maxDuration = this.isLtx2Model(params.modelId) ? 20 : 10;
    if (duration < 1 || duration > maxDuration) {
      throw new SogniValidationError(`Duration must be between 1 and ${maxDuration} seconds`);
    }

    const frames =
      params.frames !== undefined
        ? params.frames
        : this.calculateVideoFrames(params.modelId, duration, params.fps);

    return this.client!.projects.estimateVideoCost({
      tokenType,
      model: params.modelId,
      width: params.width,
      height: params.height,
      duration,
      frames,
      fps: params.fps,
      steps: params.steps,
      numberOfMedia,
    });
  }

  /**
   * Estimate audio project cost
   */
  async estimateAudioCost(params: AudioCostEstimateParams): Promise<CostEstimate> {
    await this.ensureConnected();

    if (!params.modelId || typeof params.modelId !== 'string') {
      throw new SogniValidationError('Model ID is required and must be a string');
    }
    if (typeof params.duration !== 'number' || params.duration < 10 || params.duration > 600) {
      throw new SogniValidationError('Duration is required and must be between 10 and 600 seconds');
    }
    if (typeof params.steps !== 'number' || params.steps <= 0) {
      throw new SogniValidationError('Steps is required and must be a positive number');
    }

    const tokenType = params.tokenType || 'spark';
    const numberOfMedia = params.numberOfMedia || 1;

    return this.client!.projects.estimateAudioCost({
      tokenType,
      model: params.modelId,
      duration: params.duration,
      steps: params.steps,
      numberOfMedia,
    });
  }

  /**
   * Create a project and optionally wait for completion
   */
  async createProject(config: ProjectConfig): Promise<ProjectResult> {
    await this.ensureConnected();

    // Prepare config (video asset normalization, etc.)
    const preparedConfig = await this.prepareProjectConfig(config);

    // Validate project configuration
    validateProjectConfig(preparedConfig);

    const {
      waitForCompletion = true,
      timeout = this.config.timeout,
      onProgress,
      onJobCompleted,
      onJobFailed,
      autoResizeVideoAssets: _autoResizeVideoAssets,
      ...projectParams
    } = preparedConfig;

    try {
      this.log('Creating project with config:', this.sanitizeConfig(preparedConfig));

      // Prepare project params with defaults for required SDK fields
      const sdkParams = {
        ...projectParams,
        tokenType: projectParams.tokenType || 'spark',
        network: projectParams.network || 'fast',
      };

      // Create the project
      const project = await this.client!.projects.create(sdkParams);

      this.emit(ClientEvent.PROJECT_CREATED, project);

      // Set up event listeners for this project
      const totalJobs = projectParams.numberOfMedia || 1;
      let completedJobCount = 0;
      let failedJobCount = 0;

      project.on('progress', (progress: number) => {
        let safeProgress = Number.isFinite(progress) ? progress : 0;
        if (!Number.isFinite(progress)) {
          this.log('Received non-finite progress value, coercing to 0:', progress);
        }
        if (safeProgress < 0) safeProgress = 0;
        if (safeProgress > 100) safeProgress = 100;

        const progressData: ProjectProgress = {
          projectId: project.id,
          percentage: safeProgress,
          completedJobs: completedJobCount,
          totalJobs,
        };
        const etaSeconds = this.projectEtaSeconds.get(project.id);
        if (etaSeconds !== undefined) {
          progressData.estimatedTimeRemaining = etaSeconds * 1000;
        }

        if (onProgress) {
          onProgress(progressData);
        }

        this.emit(ClientEvent.PROJECT_PROGRESS, progressData);
      });

      // Always set up job event listeners to emit wrapper events
      project.on('jobCompleted', (job: Job) => {
        completedJobCount++;

        const jobData: JobCompletedData = {
          projectId: project.id,
          job,
          jobIndex: completedJobCount - 1,
          totalJobs,
        };

        // Add appropriate URL based on project type
        if (isImageProjectConfig(preparedConfig)) {
          jobData.imageUrl = job.resultUrl || undefined;
        } else if (isVideoProjectConfig(preparedConfig)) {
          jobData.videoUrl = job.resultUrl || undefined;
        } else if (isAudioProjectConfig(preparedConfig)) {
          jobData.audioUrl = job.resultUrl || undefined;
        }

        // Emit wrapper event
        this.emit(ClientEvent.JOB_COMPLETED, jobData);

        // Call user callback if provided
        if (onJobCompleted) {
          onJobCompleted(job);
        }
      });

      project.on('jobFailed', (job: Job) => {
        failedJobCount++;

        const jobData: JobFailedData = {
          projectId: project.id,
          job,
          error: job.error?.message || 'Job failed',
          jobIndex: failedJobCount - 1,
          totalJobs,
        };

        // Emit wrapper event
        this.emit(ClientEvent.JOB_FAILED, jobData);

        // Call user callback if provided
        if (onJobFailed) {
          onJobFailed(job);
        }
      });

      // If not waiting for completion, return immediately
      if (!waitForCompletion) {
        return {
          project,
          completed: false,
        };
      }

      // Wait for completion with timeout
      this.log('Waiting for project completion...');

      const mediaUrls = await this.withTimeout(project.waitForCompletion(), timeout);

      this.log('Project completed successfully');

      // Prepare result based on project type
      const result: ProjectResult = {
        project,
        completed: true,
      };

      // Add appropriate URLs based on project type
      if (isImageProjectConfig(preparedConfig)) {
        result.imageUrls = mediaUrls;
      } else if (isVideoProjectConfig(preparedConfig)) {
        result.videoUrls = mediaUrls;
      } else if (isAudioProjectConfig(preparedConfig)) {
        result.audioUrls = mediaUrls;
      }

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
   * Convenience method to create an image project
   */
  async createImageProject(config: Omit<ImageProjectConfig, 'type'>): Promise<ProjectResult> {
    return this.createProject({
      ...config,
      type: 'image',
    } as ImageProjectConfig);
  }

  /**
   * Convenience method to create a video project
   */
  async createVideoProject(config: Omit<VideoProjectConfig, 'type'>): Promise<ProjectResult> {
    return this.createProject({
      ...config,
      type: 'video',
    } as VideoProjectConfig);
  }

  /**
   * Convenience method to create an audio project
   */
  async createAudioProject(config: Omit<AudioProjectConfig, 'type'>): Promise<ProjectResult> {
    return this.createProject({
      ...config,
      type: 'audio',
    } as AudioProjectConfig);
  }

  /**
   * Convenience method to create an image edit project (e.g., Qwen Image Edit)
   *
   * @example
   * ```typescript
   * const result = await client.createImageEditProject({
   *   modelId: 'qwen_image_edit_2511_fp8',
   *   positivePrompt: 'Transform the cat into a lion',
   *   contextImages: [imageBuffer],
   *   numberOfMedia: 1,
   * });
   * ```
   */
  async createImageEditProject(config: QwenImageEditConfig): Promise<ProjectResult> {
    // Model-specific context image limit validation
    const maxImages = getMaxContextImages(config.modelId);
    if (config.contextImages && config.contextImages.length > maxImages) {
      throw new SogniValidationError(
        `Model ${config.modelId} supports a maximum of ${maxImages} context images, got ${config.contextImages.length}`
      );
    }

    return this.createProject({
      ...config,
      type: 'image',
    } as ImageProjectConfig);
  }

  /**
   * Prepare project config (e.g., normalize video assets)
   */
  private async prepareProjectConfig(config: ProjectConfig): Promise<ProjectConfig> {
    if (!isVideoProjectConfig(config)) {
      return config;
    }

    if (config.autoResizeVideoAssets === false) {
      return config;
    }

    const normalized: VideoProjectConfig = { ...config };

    const hasReferenceImage = this.isProcessableMedia(config.referenceImage);
    const hasReferenceImageEnd = this.isProcessableMedia(config.referenceImageEnd);

    let baseKey: 'referenceImage' | 'referenceImageEnd' | null = null;
    if (hasReferenceImage) {
      baseKey = 'referenceImage';
    } else if (hasReferenceImageEnd) {
      baseKey = 'referenceImageEnd';
    }

    let baseBuffer: Buffer | null = null;
    if (baseKey) {
      baseBuffer = await this.mediaToBuffer(config[baseKey] as InputMedia);
    }

    let width = config.width;
    let height = config.height;

    if ((!width || !height) && baseBuffer) {
      const meta = await this.getImageMetadata(baseBuffer);
      if (meta) {
        width = width || meta.width;
        height = height || meta.height;
      }
    }

    if (width && height) {
      const originalWidth = width;
      const originalHeight = height;
      const normalizedDims = this.normalizeVideoDimensions(width, height);
      if (normalizedDims.adjusted) {
        console.log(
          `[SogniClientWrapper] Adjusted video dimensions from ${originalWidth}x${originalHeight} to ${normalizedDims.width}x${normalizedDims.height} to meet video requirements.`
        );
      }
      width = normalizedDims.width;
      height = normalizedDims.height;
    }

    if (baseBuffer && width && height) {
      const baseFit: 'inside' | 'cover' =
        baseKey === 'referenceImageEnd' && !!config.referenceImage ? 'cover' : 'inside';
      const resizedBase = await this.resizeImageBuffer(baseBuffer, width, height, baseFit);
      if (resizedBase.wasResized) {
        console.log(
          `[SogniClientWrapper] Resized ${baseKey} from ${resizedBase.originalWidth}x${resizedBase.originalHeight} to ${resizedBase.width}x${resizedBase.height} to meet video requirements.`
        );
      }
      width = resizedBase.width;
      height = resizedBase.height;
      if (baseKey === 'referenceImage') {
        normalized.referenceImage = resizedBase.buffer;
      } else if (baseKey === 'referenceImageEnd') {
        normalized.referenceImageEnd = resizedBase.buffer;
      }
    }

    if (width && height) {
      normalized.width = width;
      normalized.height = height;
    }

    // If both start and end images are provided, ensure end matches start dimensions
    if (config.referenceImage && config.referenceImageEnd && hasReferenceImageEnd && width && height && baseKey === 'referenceImage') {
      const endBuffer = await this.mediaToBuffer(config.referenceImageEnd as InputMedia);
      if (endBuffer) {
        const resizedEnd = await this.resizeImageBuffer(endBuffer, width, height, 'cover');
        if (resizedEnd.wasResized || resizedEnd.width !== width || resizedEnd.height !== height) {
          console.log(
            `[SogniClientWrapper] Resized referenceImageEnd from ${resizedEnd.originalWidth}x${resizedEnd.originalHeight} to ${resizedEnd.width}x${resizedEnd.height} to match referenceImage.`
          );
        }
        normalized.referenceImageEnd = resizedEnd.buffer;
      }
    }

    return normalized;
  }

  private normalizeVideoDimensions(width: number, height: number): {
    width: number;
    height: number;
    adjusted: boolean;
  } {
    let targetWidth = width;
    let targetHeight = height;
    let adjusted = false;

    if (targetWidth > MAX_VIDEO_DIMENSION || targetHeight > MAX_VIDEO_DIMENSION) {
      const scaleFactor = Math.min(
        MAX_VIDEO_DIMENSION / targetWidth,
        MAX_VIDEO_DIMENSION / targetHeight
      );
      targetWidth = Math.floor(targetWidth * scaleFactor);
      targetHeight = Math.floor(targetHeight * scaleFactor);
      adjusted = true;
    }

    if (targetWidth < MIN_VIDEO_DIMENSION || targetHeight < MIN_VIDEO_DIMENSION) {
      const scaleFactor = Math.max(
        MIN_VIDEO_DIMENSION / targetWidth,
        MIN_VIDEO_DIMENSION / targetHeight
      );
      targetWidth = Math.floor(targetWidth * scaleFactor);
      targetHeight = Math.floor(targetHeight * scaleFactor);
      adjusted = true;

      if (targetWidth > MAX_VIDEO_DIMENSION || targetHeight > MAX_VIDEO_DIMENSION) {
        const downscaleFactor = Math.min(
          MAX_VIDEO_DIMENSION / targetWidth,
          MAX_VIDEO_DIMENSION / targetHeight
        );
        targetWidth = Math.floor(targetWidth * downscaleFactor);
        targetHeight = Math.floor(targetHeight * downscaleFactor);
      }
    }

    const roundedWidth = Math.floor(targetWidth / VIDEO_DIMENSION_MULTIPLE) * VIDEO_DIMENSION_MULTIPLE;
    const roundedHeight = Math.floor(targetHeight / VIDEO_DIMENSION_MULTIPLE) * VIDEO_DIMENSION_MULTIPLE;

    if (roundedWidth !== targetWidth || roundedHeight !== targetHeight) {
      adjusted = true;
    }

    targetWidth = roundedWidth;
    targetHeight = roundedHeight;

    if (targetWidth < MIN_VIDEO_DIMENSION) {
      targetWidth = Math.ceil(MIN_VIDEO_DIMENSION / VIDEO_DIMENSION_MULTIPLE) * VIDEO_DIMENSION_MULTIPLE;
      adjusted = true;
    }
    if (targetHeight < MIN_VIDEO_DIMENSION) {
      targetHeight = Math.ceil(MIN_VIDEO_DIMENSION / VIDEO_DIMENSION_MULTIPLE) * VIDEO_DIMENSION_MULTIPLE;
      adjusted = true;
    }

    return { width: targetWidth, height: targetHeight, adjusted };
  }

  private isProcessableMedia(media: InputMedia | undefined): media is Buffer | Blob {
    if (!media) return false;
    if (Buffer.isBuffer(media)) return true;
    return typeof Blob !== 'undefined' && media instanceof Blob;
  }

  private async mediaToBuffer(media: InputMedia): Promise<Buffer | null> {
    if (Buffer.isBuffer(media)) {
      return media;
    }
    if (typeof Blob !== 'undefined' && media instanceof Blob) {
      const arrayBuffer = await media.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    return null;
  }

  private async getImageMetadata(buffer: Buffer): Promise<{ width: number; height: number } | null> {
    const sharp = await this.loadSharp();
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) {
      return null;
    }
    return { width: meta.width, height: meta.height };
  }

  private async resizeImageBuffer(
    buffer: Buffer,
    width: number,
    height: number,
    fit: 'inside' | 'cover'
  ): Promise<{ buffer: Buffer; width: number; height: number; wasResized: boolean; originalWidth: number; originalHeight: number }> {
    const sharp = await this.loadSharp();
    const meta = await sharp(buffer).metadata();
    const originalWidth = meta.width || width;
    const originalHeight = meta.height || height;

    if (meta.width === width && meta.height === height) {
      return { buffer, width: originalWidth, height: originalHeight, wasResized: false, originalWidth, originalHeight };
    }

    const resizedBuffer = await sharp(buffer)
      .resize(width, height, {
        fit,
        position: 'center',
        withoutEnlargement: false,
      })
      .toBuffer();

    const resizedMeta = await sharp(resizedBuffer).metadata();
    return {
      buffer: resizedBuffer,
      width: resizedMeta.width || width,
      height: resizedMeta.height || height,
      wasResized: true,
      originalWidth,
      originalHeight,
    };
  }

  private async loadSharp(): Promise<typeof import('sharp')> {
    const sharpModule = await import('sharp');
    return ((sharpModule as unknown as { default?: typeof import('sharp') }).default || sharpModule) as typeof import('sharp');
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

    if (!this.projectEventHandler) {
      this.projectEventHandler = (event: ProjectEvent) => {
        if (event.type === 'completed' || event.type === 'error') {
          this.projectEtaSeconds.delete(event.projectId);
        }
        this.emit(ClientEvent.PROJECT_EVENT, event);
      };
    }

    if (!this.jobEventHandler) {
      this.jobEventHandler = (event: JobEvent) => {
        if (event.type === 'jobETA') {
          this.projectEtaSeconds.set(event.projectId, event.etaSeconds);
        }
        this.emit(ClientEvent.JOB_EVENT, event);
      };
    }

    if (!this.chatTokenEventHandler) {
      this.chatTokenEventHandler = (chunk: ChatCompletionChunk) => {
        this.emit(ClientEvent.CHAT_TOKEN, chunk);
      };
    }

    if (!this.chatCompletedEventHandler) {
      this.chatCompletedEventHandler = (result: ChatCompletionResult) => {
        this.emit(ClientEvent.CHAT_COMPLETED, result);
      };
    }

    if (!this.chatErrorEventHandler) {
      this.chatErrorEventHandler = (error: ChatErrorData) => {
        this.emit(ClientEvent.CHAT_ERROR, error);
      };
    }

    if (!this.chatJobStateEventHandler) {
      this.chatJobStateEventHandler = (state: ChatJobStateEvent) => {
        this.emit(ClientEvent.CHAT_JOB_STATE, state);
      };
    }

    if (!this.chatModelsUpdatedEventHandler) {
      this.chatModelsUpdatedEventHandler = (models: Record<string, LLMModelInfo>) => {
        this.emit(ClientEvent.CHAT_MODELS_UPDATED, models);
      };
    }

    this.client.projects.on('project', this.projectEventHandler);
    this.client.projects.on('job', this.jobEventHandler);
    this.client.chat.on('token', this.chatTokenEventHandler);
    this.client.chat.on('completed', this.chatCompletedEventHandler);
    this.client.chat.on('error', this.chatErrorEventHandler);
    this.client.chat.on('jobState', this.chatJobStateEventHandler);
    this.client.chat.on('modelsUpdated', this.chatModelsUpdatedEventHandler);
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
   * Await a promise with a timeout (clears the timer on settle)
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new SogniTimeoutError(`Operation timed out after ${timeoutMs}ms`, timeoutMs));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Get recommended settings for a model
   */
  private getRecommendedSettings(modelId: string): ModelInfo['recommendedSettings'] {
    // Qwen Image Edit models
    if (modelId.includes('qwen_image_edit')) {
      if (modelId.includes('lightning')) {
        return { steps: 4, guidance: 1.0 };
      }
      return { steps: 20, guidance: 4.0 };
    }

    // Provide sensible defaults based on model type
    if (modelId.includes('flux')) {
      return { steps: 4, guidance: 3.5 };
    }
    if (modelId.includes('lightning') || modelId.includes('turbo') || modelId.includes('lcm')) {
      return { steps: 4, guidance: 1.0 };
    }
    if (modelId.includes('ace-step')) {
      return { steps: 20 };
    }
    return { steps: 20, guidance: 7.5 };
  }

  private isWanModel(modelId: string): boolean {
    return modelId.startsWith('wan_');
  }

  private isLtx2Model(modelId: string): boolean {
    return modelId.startsWith('ltx2-') || modelId.startsWith('ltx23-');
  }

  private calculateVideoFrames(modelId: string, duration: number, fps: number): number {
    if (this.isWanModel(modelId)) {
      return Math.round(duration * 16) + 1;
    }

    let frames = Math.round(duration * fps) + 1;
    if (this.isLtx2Model(modelId)) {
      const n = Math.round((frames - 1) / LTX2_FRAME_STEP);
      frames = n * LTX2_FRAME_STEP + 1;
    }
    return frames;
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
