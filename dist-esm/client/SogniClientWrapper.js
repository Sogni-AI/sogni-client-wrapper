import { EventEmitter } from 'events';
import { SogniClient } from '@sogni-ai/sogni-client';
import { ClientEvent } from '../types';
import { SogniError, SogniConnectionError, SogniAuthenticationError, SogniProjectError, SogniTimeoutError, SogniModelNotFoundError, SogniValidationError, } from '../utils/errors';
import { generateAppId, validateClientConfig, validateProjectConfig, isImageProjectConfig, isVideoProjectConfig, isAudioProjectConfig, waitFor, retry, getMaxContextImages, } from '../utils/helpers';
const MIN_VIDEO_DIMENSION = 480;
const MAX_VIDEO_DIMENSION = 1536;
const VIDEO_DIMENSION_MULTIPLE = 16;
const LTX2_FRAME_STEP = 8;
export class SogniClientWrapper extends EventEmitter {
    constructor(config) {
        super();
        this.client = null;
        this.reconnectTimer = null;
        this.isReconnecting = false;
        this.projectEventHandler = null;
        this.jobEventHandler = null;
        this.chatTokenEventHandler = null;
        this.chatCompletedEventHandler = null;
        this.chatErrorEventHandler = null;
        this.chatJobStateEventHandler = null;
        this.chatModelsUpdatedEventHandler = null;
        this.projectEtaSeconds = new Map();
        this.on(ClientEvent.ERROR, (_error) => { });
        validateClientConfig(config);
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
            multiInstance: config.multiInstance,
            allowInsecureTLS: config.allowInsecureTLS,
            autoConnect: config.autoConnect !== false,
            reconnect: config.reconnect !== false,
            reconnectInterval: config.reconnectInterval || 5000,
            timeout: config.timeout || 300000,
            debug: config.debug || false,
            authType: config.authType || (config.apiKey ? 'apiKey' : 'token'),
        };
        this.connectionState = {
            status: 'disconnected',
            isConnected: false,
            isConnecting: false,
            reconnectAttempts: 0,
        };
        if (this.config.autoConnect) {
            this.connect().catch((error) => {
                this.log('Auto-connect failed:', error);
                this.emit(ClientEvent.ERROR, SogniError.fromError(error, 'AUTO_CONNECT_FAILED').toErrorData());
            });
        }
    }
    async connect() {
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
        this.updateConnectionState({ status: 'connecting', isConnecting: true });
        try {
            this.log('Creating Sogni client...');
            if (this.config.allowInsecureTLS) {
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
                this.log('TLS verification disabled (allowInsecureTLS=true)');
            }
            this.client = await SogniClient.createInstance({
                appId: this.config.appId,
                network: this.config.network,
                authType: this.config.authType,
                apiKey: this.config.apiKey,
                testnet: this.config.testnet,
                socketEndpoint: this.config.socketEndpoint,
                restEndpoint: this.config.restEndpoint,
                disableSocket: this.config.disableSocket,
                multiInstance: this.config.multiInstance,
            });
            if (this.config.authType === 'cookies') {
                this.log('Checking authentication via cookies...');
                const isAuthenticated = await this.client.checkAuth();
                if (!isAuthenticated) {
                    if (this.config.username && this.config.password) {
                        this.log('Cookie auth failed, attempting login with credentials...');
                        await this.client.account.login(this.config.username, this.config.password);
                    }
                    else {
                        throw new SogniAuthenticationError('Cookie authentication failed and no credentials provided', undefined);
                    }
                }
            }
            else if (this.config.authType === 'apiKey') {
                this.log('Using API key authentication...');
            }
            else {
                this.log('Logging in with credentials...');
                await this.client.account.login(this.config.username, this.config.password);
            }
            this.log('Waiting for models...');
            await this.client.projects.waitForModels();
            this.log('Connected successfully');
            this.updateConnectionState({
                status: 'connected',
                isConnected: true,
                isConnecting: false,
                reconnectAttempts: 0,
                connectedAt: new Date(),
            });
            this.emit(ClientEvent.CONNECTED);
            this.setupEventListeners();
        }
        catch (error) {
            this.log('Connection failed:', error);
            const sogniError = error instanceof Error && error.message.includes('auth')
                ? new SogniAuthenticationError('Authentication failed', undefined, error)
                : new SogniConnectionError('Failed to connect to Sogni Supernet', undefined, error);
            this.updateConnectionState({
                status: 'failed',
                isConnected: false,
                isConnecting: false,
                lastError: sogniError.toErrorData(),
            });
            this.emit(ClientEvent.ERROR, sogniError.toErrorData());
            if (this.config.reconnect && !this.isReconnecting) {
                this.scheduleReconnect();
            }
            throw sogniError;
        }
    }
    async disconnect() {
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
                if (typeof this.client.dispose === 'function') {
                    this.client.dispose();
                    this.log('SDK client disposed');
                }
                else if (this.client.apiClient && this.client.apiClient.socket) {
                    this.client.apiClient.socket.disconnect();
                    this.log('WebSocket disconnected');
                }
            }
            catch (error) {
                this.log('Error disconnecting WebSocket:', error);
            }
            this.client = null;
        }
        this.projectEtaSeconds.clear();
        this.updateConnectionState({
            status: 'disconnected',
            isConnected: false,
            isConnecting: false,
        });
        this.emit(ClientEvent.DISCONNECTED);
        this.log('Disconnected');
    }
    async dispose() {
        await this.disconnect();
        this.removeAllListeners();
    }
    isConnected() {
        return this.connectionState.isConnected && this.client !== null;
    }
    getConnectionState() {
        return { ...this.connectionState };
    }
    async getAvailableModels(options = {}) {
        await this.ensureConnected();
        let models = this.client.projects.availableModels;
        if (options.network) {
        }
        if (options.minWorkers !== undefined) {
            models = models.filter((m) => m.workerCount >= options.minWorkers);
        }
        if (options.sortByWorkers) {
            models = [...models].sort((a, b) => b.workerCount - a.workerCount);
        }
        return models.map((model) => ({
            ...model,
            isAvailable: model.workerCount > 0,
            recommendedSettings: this.getRecommendedSettings(model.id),
        }));
    }
    async getModel(modelId) {
        const models = await this.getAvailableModels();
        const model = models.find((m) => m.id === modelId);
        if (!model) {
            throw new SogniModelNotFoundError(modelId);
        }
        return model;
    }
    async getMostPopularModel() {
        const models = await this.getAvailableModels({ sortByWorkers: true });
        if (models.length === 0) {
            throw new SogniError('No models available', 'NO_MODELS_AVAILABLE');
        }
        return models[0];
    }
    async getAvailableChatModels() {
        await this.ensureConnected();
        return this.client.chat.models;
    }
    async waitForChatModels(timeout = 10000) {
        await this.ensureConnected();
        return this.client.chat.waitForModels(timeout);
    }
    async estimateChatCost(params) {
        await this.ensureConnected();
        return this.client.chat.estimateCost(params);
    }
    async createChatCompletion(params) {
        await this.ensureConnected();
        return this.client.chat.completions.create(params);
    }
    async startCreativeWorkflow(params, options) {
        await this.ensureConnected();
        return this.client.workflows.start(params, options);
    }
    async listCreativeWorkflows(options) {
        await this.ensureConnected();
        return this.client.workflows.list(options);
    }
    async getCreativeWorkflow(workflowId) {
        await this.ensureConnected();
        return this.client.workflows.get(workflowId);
    }
    async getCreativeWorkflowEvents(workflowId) {
        await this.ensureConnected();
        return this.client.workflows.events(workflowId);
    }
    async cancelCreativeWorkflow(workflowId) {
        await this.ensureConnected();
        return this.client.workflows.cancel(workflowId);
    }
    async streamCreativeWorkflowEvents(workflowId, options) {
        await this.ensureConnected();
        return this.client.workflows.streamEvents(workflowId, options);
    }
    async getBalance() {
        await this.ensureConnected();
        const balances = await this.client.account.refreshBalance();
        return {
            sogni: parseFloat(balances.sogni.net) || 0,
            spark: parseFloat(balances.spark.net) || 0,
            lastUpdated: new Date(),
        };
    }
    async getSizePresets(network, modelId) {
        await this.ensureConnected();
        try {
            const presets = await this.client.projects.getSizePresets(network, modelId);
            return presets;
        }
        catch (error) {
            throw SogniError.fromError(error, 'GET_SIZE_PRESETS_FAILED');
        }
    }
    async estimateVideoCost(params) {
        await this.ensureConnected();
        if (!params.modelId || typeof params.modelId !== 'string') {
            throw new SogniValidationError('Model ID is required and must be a string');
        }
        if (typeof params.width !== 'number' || typeof params.height !== 'number') {
            throw new SogniValidationError('Width and height are required and must be numbers');
        }
        if (params.fps !== undefined && (typeof params.fps !== 'number' || params.fps <= 0)) {
            throw new SogniValidationError('FPS must be a positive number');
        }
        if (params.steps !== undefined && (typeof params.steps !== 'number' || params.steps <= 0)) {
            throw new SogniValidationError('Steps must be a positive number');
        }
        const tokenType = params.tokenType || 'spark';
        const numberOfMedia = params.numberOfMedia || 1;
        const fps = this.getVideoFps(params.modelId, params.fps);
        let duration = params.duration;
        if (duration === undefined || duration === null) {
            if (params.frames !== undefined && params.frames > 0) {
                const durationFps = this.getVideoGenerationFps(params.modelId, fps);
                duration = Math.max(1, Math.round((params.frames - 1) / durationFps));
            }
            else {
                duration = this.getVideoDurationBounds(params.modelId).min;
            }
        }
        const { min: minDuration, max: maxDuration } = this.getVideoDurationBounds(params.modelId);
        if (duration < minDuration || duration > maxDuration) {
            throw new SogniValidationError(`Duration must be between ${minDuration} and ${maxDuration} seconds`);
        }
        const frames = params.frames !== undefined
            ? params.frames
            : this.calculateVideoFrames(params.modelId, duration, fps);
        return this.client.projects.estimateVideoCost({
            tokenType,
            model: params.modelId,
            width: params.width,
            height: params.height,
            duration,
            frames,
            fps,
            steps: params.steps,
            numberOfMedia,
        });
    }
    async estimateAudioCost(params) {
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
        return this.client.projects.estimateAudioCost({
            tokenType,
            model: params.modelId,
            duration: params.duration,
            steps: params.steps,
            numberOfMedia,
        });
    }
    async createProject(config) {
        await this.ensureConnected();
        const preparedConfig = await this.prepareProjectConfig(config);
        validateProjectConfig(preparedConfig);
        const { waitForCompletion = true, timeout = this.config.timeout, onProgress, onJobCompleted, onJobFailed, autoResizeVideoAssets: _autoResizeVideoAssets, ...projectParams } = preparedConfig;
        try {
            this.log('Creating project with config:', this.sanitizeConfig(preparedConfig));
            const sdkParams = {
                ...projectParams,
                tokenType: projectParams.tokenType || 'spark',
                network: projectParams.network || 'fast',
            };
            const project = await this.client.projects.create(sdkParams);
            this.emit(ClientEvent.PROJECT_CREATED, project);
            const totalJobs = projectParams.numberOfMedia || 1;
            let completedJobCount = 0;
            let failedJobCount = 0;
            project.on('progress', (progress) => {
                let safeProgress = Number.isFinite(progress) ? progress : 0;
                if (!Number.isFinite(progress)) {
                    this.log('Received non-finite progress value, coercing to 0:', progress);
                }
                if (safeProgress < 0)
                    safeProgress = 0;
                if (safeProgress > 100)
                    safeProgress = 100;
                const progressData = {
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
            project.on('jobCompleted', (job) => {
                completedJobCount++;
                const jobData = {
                    projectId: project.id,
                    job,
                    jobIndex: completedJobCount - 1,
                    totalJobs,
                };
                if (isImageProjectConfig(preparedConfig)) {
                    jobData.imageUrl = job.resultUrl || undefined;
                }
                else if (isVideoProjectConfig(preparedConfig)) {
                    jobData.videoUrl = job.resultUrl || undefined;
                }
                else if (isAudioProjectConfig(preparedConfig)) {
                    jobData.audioUrl = job.resultUrl || undefined;
                }
                this.emit(ClientEvent.JOB_COMPLETED, jobData);
                if (onJobCompleted) {
                    onJobCompleted(job);
                }
            });
            project.on('jobFailed', (job) => {
                failedJobCount++;
                const jobData = {
                    projectId: project.id,
                    job,
                    error: job.error?.message || 'Job failed',
                    jobIndex: failedJobCount - 1,
                    totalJobs,
                };
                this.emit(ClientEvent.JOB_FAILED, jobData);
                if (onJobFailed) {
                    onJobFailed(job);
                }
            });
            if (!waitForCompletion) {
                return {
                    project,
                    completed: false,
                };
            }
            this.log('Waiting for project completion...');
            const mediaUrls = await this.withTimeout(project.waitForCompletion(), timeout);
            this.log('Project completed successfully');
            const result = {
                project,
                completed: true,
            };
            if (isImageProjectConfig(preparedConfig)) {
                result.imageUrls = mediaUrls;
            }
            else if (isVideoProjectConfig(preparedConfig)) {
                result.videoUrls = mediaUrls;
            }
            else if (isAudioProjectConfig(preparedConfig)) {
                result.audioUrls = mediaUrls;
            }
            this.emit(ClientEvent.PROJECT_COMPLETED, result);
            return result;
        }
        catch (error) {
            this.log('Project failed:', error);
            const projectError = error instanceof SogniTimeoutError
                ? error
                : new SogniProjectError('Project creation failed', undefined, error);
            this.emit(ClientEvent.PROJECT_FAILED, projectError.toErrorData());
            throw projectError;
        }
    }
    async createProjectWithRetry(config, options = {}) {
        const { maxAttempts = 3, retryDelay = 2000 } = options;
        return retry(() => this.createProject(config), {
            maxAttempts,
            initialDelay: retryDelay,
            onRetry: (attempt, error) => {
                this.log(`Retry attempt ${attempt} after error:`, error.message);
            },
        });
    }
    async createImageProject(config) {
        return this.createProject({
            ...config,
            type: 'image',
        });
    }
    async createVideoProject(config) {
        return this.createProject({
            ...config,
            type: 'video',
        });
    }
    async createAudioProject(config) {
        return this.createProject({
            ...config,
            type: 'audio',
        });
    }
    async createImageEditProject(config) {
        const maxImages = getMaxContextImages(config.modelId);
        if (config.contextImages && config.contextImages.length > maxImages) {
            throw new SogniValidationError(`Model ${config.modelId} supports a maximum of ${maxImages} context images, got ${config.contextImages.length}`);
        }
        return this.createProject({
            ...config,
            type: 'image',
        });
    }
    async prepareProjectConfig(config) {
        if (!isVideoProjectConfig(config)) {
            return config;
        }
        if (config.autoResizeVideoAssets === false) {
            return config;
        }
        const normalized = { ...config };
        const hasReferenceImage = this.isProcessableMedia(config.referenceImage);
        const hasReferenceImageEnd = this.isProcessableMedia(config.referenceImageEnd);
        let baseKey = null;
        if (hasReferenceImage) {
            baseKey = 'referenceImage';
        }
        else if (hasReferenceImageEnd) {
            baseKey = 'referenceImageEnd';
        }
        let baseBuffer = null;
        if (baseKey) {
            baseBuffer = await this.mediaToBuffer(config[baseKey]);
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
                console.log(`[SogniClientWrapper] Adjusted video dimensions from ${originalWidth}x${originalHeight} to ${normalizedDims.width}x${normalizedDims.height} to meet video requirements.`);
            }
            width = normalizedDims.width;
            height = normalizedDims.height;
        }
        if (baseBuffer && width && height) {
            const baseFit = baseKey === 'referenceImageEnd' && !!config.referenceImage ? 'cover' : 'inside';
            const resizedBase = await this.resizeImageBuffer(baseBuffer, width, height, baseFit);
            if (resizedBase.wasResized) {
                console.log(`[SogniClientWrapper] Resized ${baseKey} from ${resizedBase.originalWidth}x${resizedBase.originalHeight} to ${resizedBase.width}x${resizedBase.height} to meet video requirements.`);
            }
            width = resizedBase.width;
            height = resizedBase.height;
            if (baseKey === 'referenceImage') {
                normalized.referenceImage = resizedBase.buffer;
            }
            else if (baseKey === 'referenceImageEnd') {
                normalized.referenceImageEnd = resizedBase.buffer;
            }
        }
        if (width && height) {
            normalized.width = width;
            normalized.height = height;
        }
        if (config.referenceImage && config.referenceImageEnd && hasReferenceImageEnd && width && height && baseKey === 'referenceImage') {
            const endBuffer = await this.mediaToBuffer(config.referenceImageEnd);
            if (endBuffer) {
                const resizedEnd = await this.resizeImageBuffer(endBuffer, width, height, 'cover');
                if (resizedEnd.wasResized || resizedEnd.width !== width || resizedEnd.height !== height) {
                    console.log(`[SogniClientWrapper] Resized referenceImageEnd from ${resizedEnd.originalWidth}x${resizedEnd.originalHeight} to ${resizedEnd.width}x${resizedEnd.height} to match referenceImage.`);
                }
                normalized.referenceImageEnd = resizedEnd.buffer;
            }
        }
        return normalized;
    }
    normalizeVideoDimensions(width, height) {
        let targetWidth = width;
        let targetHeight = height;
        let adjusted = false;
        if (targetWidth > MAX_VIDEO_DIMENSION || targetHeight > MAX_VIDEO_DIMENSION) {
            const scaleFactor = Math.min(MAX_VIDEO_DIMENSION / targetWidth, MAX_VIDEO_DIMENSION / targetHeight);
            targetWidth = Math.floor(targetWidth * scaleFactor);
            targetHeight = Math.floor(targetHeight * scaleFactor);
            adjusted = true;
        }
        if (targetWidth < MIN_VIDEO_DIMENSION || targetHeight < MIN_VIDEO_DIMENSION) {
            const scaleFactor = Math.max(MIN_VIDEO_DIMENSION / targetWidth, MIN_VIDEO_DIMENSION / targetHeight);
            targetWidth = Math.floor(targetWidth * scaleFactor);
            targetHeight = Math.floor(targetHeight * scaleFactor);
            adjusted = true;
            if (targetWidth > MAX_VIDEO_DIMENSION || targetHeight > MAX_VIDEO_DIMENSION) {
                const downscaleFactor = Math.min(MAX_VIDEO_DIMENSION / targetWidth, MAX_VIDEO_DIMENSION / targetHeight);
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
    isProcessableMedia(media) {
        if (!media)
            return false;
        if (Buffer.isBuffer(media))
            return true;
        return typeof Blob !== 'undefined' && media instanceof Blob;
    }
    async mediaToBuffer(media) {
        if (Buffer.isBuffer(media)) {
            return media;
        }
        if (typeof Blob !== 'undefined' && media instanceof Blob) {
            const arrayBuffer = await media.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
        return null;
    }
    async getImageMetadata(buffer) {
        const sharp = await this.loadSharp();
        const meta = await sharp(buffer).metadata();
        if (!meta.width || !meta.height) {
            return null;
        }
        return { width: meta.width, height: meta.height };
    }
    async resizeImageBuffer(buffer, width, height, fit) {
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
    async loadSharp() {
        const sharpModule = await import('sharp');
        return (sharpModule.default || sharpModule);
    }
    async ensureConnected() {
        if (!this.isConnected()) {
            await this.connect();
        }
    }
    setupEventListeners() {
        if (!this.client)
            return;
        if (!this.projectEventHandler) {
            this.projectEventHandler = (event) => {
                if (event.type === 'completed' || event.type === 'error') {
                    this.projectEtaSeconds.delete(event.projectId);
                }
                this.emit(ClientEvent.PROJECT_EVENT, event);
            };
        }
        if (!this.jobEventHandler) {
            this.jobEventHandler = (event) => {
                if (event.type === 'jobETA') {
                    this.projectEtaSeconds.set(event.projectId, event.etaSeconds);
                }
                this.emit(ClientEvent.JOB_EVENT, event);
            };
        }
        if (!this.chatTokenEventHandler) {
            this.chatTokenEventHandler = (chunk) => {
                this.emit(ClientEvent.CHAT_TOKEN, chunk);
            };
        }
        if (!this.chatCompletedEventHandler) {
            this.chatCompletedEventHandler = (result) => {
                this.emit(ClientEvent.CHAT_COMPLETED, result);
            };
        }
        if (!this.chatErrorEventHandler) {
            this.chatErrorEventHandler = (error) => {
                this.emit(ClientEvent.CHAT_ERROR, error);
            };
        }
        if (!this.chatJobStateEventHandler) {
            this.chatJobStateEventHandler = (state) => {
                this.emit(ClientEvent.CHAT_JOB_STATE, state);
            };
        }
        if (!this.chatModelsUpdatedEventHandler) {
            this.chatModelsUpdatedEventHandler = (models) => {
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
    scheduleReconnect() {
        if (this.reconnectTimer) {
            return;
        }
        this.isReconnecting = true;
        this.updateConnectionState({
            status: 'reconnecting',
            reconnectAttempts: this.connectionState.reconnectAttempts + 1,
        });
        this.emit(ClientEvent.RECONNECTING, this.connectionState.reconnectAttempts);
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            try {
                await this.connect();
                this.isReconnecting = false;
                this.emit(ClientEvent.RECONNECTED);
            }
            catch (error) {
                this.log('Reconnection failed:', error);
                if (this.config.reconnect) {
                    this.scheduleReconnect();
                }
                else {
                    this.isReconnecting = false;
                }
            }
        }, this.config.reconnectInterval);
    }
    updateConnectionState(updates) {
        this.connectionState = {
            ...this.connectionState,
            ...updates,
        };
    }
    async withTimeout(promise, timeoutMs) {
        let timeoutId = null;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new SogniTimeoutError(`Operation timed out after ${timeoutMs}ms`, timeoutMs));
            }, timeoutMs);
        });
        try {
            return await Promise.race([promise, timeoutPromise]);
        }
        finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }
    getRecommendedSettings(modelId) {
        if (this.isSeedanceModel(modelId)) {
            return { fps: 24 };
        }
        if (this.isWanModel(modelId)) {
            return { steps: modelId.includes('lightx2v') ? 4 : 20, fps: 16, frames: 81 };
        }
        if (this.isLtx2Model(modelId)) {
            return { steps: modelId.includes('distilled') ? 4 : 20, fps: 24, frames: 121 };
        }
        if (modelId.includes('qwen_image_edit')) {
            if (modelId.includes('lightning')) {
                return { steps: 4, guidance: 1.0 };
            }
            return { steps: 20, guidance: 4.0 };
        }
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
    isWanModel(modelId) {
        return modelId.startsWith('wan_');
    }
    isLtx2Model(modelId) {
        return modelId.startsWith('ltx2-') || modelId.startsWith('ltx23-');
    }
    isSeedanceModel(modelId) {
        return modelId.startsWith('seedance-2-0');
    }
    getVideoDurationBounds(modelId) {
        if (this.isSeedanceModel(modelId)) {
            return { min: 4, max: 15 };
        }
        if (this.isLtx2Model(modelId)) {
            return { min: 1, max: 20 };
        }
        return { min: 1, max: 10 };
    }
    getVideoGenerationFps(modelId, fps) {
        if (this.isWanModel(modelId)) {
            return 16;
        }
        if (this.isSeedanceModel(modelId)) {
            return 24;
        }
        return fps;
    }
    getVideoFps(modelId, fps) {
        if (this.isSeedanceModel(modelId)) {
            if (fps !== undefined && fps !== 24) {
                throw new SogniValidationError('Seedance video models require fps to be 24');
            }
            return 24;
        }
        if (fps === undefined) {
            return this.isWanModel(modelId) ? 16 : 24;
        }
        return fps;
    }
    calculateVideoFrames(modelId, duration, fps) {
        if (this.isWanModel(modelId)) {
            return Math.round(duration * 16) + 1;
        }
        if (this.isSeedanceModel(modelId)) {
            return Math.round(duration * 24) + 1;
        }
        let frames = Math.round(duration * fps) + 1;
        if (this.isLtx2Model(modelId)) {
            const n = Math.round((frames - 1) / LTX2_FRAME_STEP);
            frames = n * LTX2_FRAME_STEP + 1;
        }
        return frames;
    }
    sanitizeConfig(config) {
        const sanitized = { ...config };
        if (sanitized.password)
            sanitized.password = '***';
        return sanitized;
    }
    log(...args) {
        if (this.config.debug) {
            console.log('[SogniClientWrapper]', ...args);
        }
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
}
//# sourceMappingURL=SogniClientWrapper.js.map