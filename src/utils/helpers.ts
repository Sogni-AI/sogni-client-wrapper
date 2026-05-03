/**
 * Utility helper functions
 */

import { randomUUID } from 'crypto';
import type {
  ProjectConfig,
  SogniClientConfig,
  ImageProjectConfig,
  VideoProjectConfig,
  AudioProjectConfig,
} from '../types';
import { SogniValidationError } from './errors';

/**
 * Generate a unique app ID
 */
export function generateAppId(): string {
  return randomUUID();
}

/**
 * Type guard to check if config is for an image project
 */
export function isImageProjectConfig(config: ProjectConfig): config is ImageProjectConfig {
  return config.type === 'image';
}

/**
 * Type guard to check if config is for a video project
 */
export function isVideoProjectConfig(config: ProjectConfig): config is VideoProjectConfig {
  return config.type === 'video';
}

/**
 * Type guard to check if config is for an audio project
 */
export function isAudioProjectConfig(config: ProjectConfig): config is AudioProjectConfig {
  return config.type === 'audio';
}

function isSeedanceVideoModel(modelId: string): boolean {
  return modelId.startsWith('seedance-2-0');
}

function isLtx2VideoModel(modelId: string): boolean {
  return modelId.startsWith('ltx2-') || modelId.startsWith('ltx23-');
}

function isWanAnimateVideoModel(modelId: string): boolean {
  return (
    modelId.includes('_animate-move') ||
    modelId.includes('_animate-replace') ||
    modelId.includes('_animate_move') ||
    modelId.includes('_animate_replace')
  );
}

function getVideoDurationLimits(modelId: string): { min: number; max: number } {
  if (isSeedanceVideoModel(modelId)) {
    return { min: 4, max: 15 };
  }
  if (isLtx2VideoModel(modelId) || isWanAnimateVideoModel(modelId)) {
    return { min: 1, max: 20 };
  }
  return { min: 1, max: 10 };
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validateReferenceUrlArray(value: unknown, propertyName: string): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new SogniValidationError(`${propertyName} must be an array of HTTPS URL strings`);
  }

  const urls = value.map((url) => (typeof url === 'string' ? url.trim() : url));
  if (
    urls.some(
      (url) => typeof url !== 'string' || url.length === 0 || !isHttpsUrl(url)
    )
  ) {
    throw new SogniValidationError(`${propertyName} must contain only HTTPS URL strings`);
  }

  return urls as string[];
}

function validateSeedanceReferenceAssets(config: VideoProjectConfig): void {
  const referenceImageUrls = validateReferenceUrlArray(config.referenceImageUrls, 'referenceImageUrls');
  const referenceVideoUrls = validateReferenceUrlArray(config.referenceVideoUrls, 'referenceVideoUrls');
  const referenceAudioUrls = validateReferenceUrlArray(config.referenceAudioUrls, 'referenceAudioUrls');

  const imageCount =
    (config.referenceImage ? 1 : 0) +
    (config.referenceImageEnd ? 1 : 0) +
    referenceImageUrls.length;
  const videoCount = (config.referenceVideo ? 1 : 0) + referenceVideoUrls.length;
  const audioCount =
    (config.referenceAudio || config.referenceAudioIdentity ? 1 : 0) + referenceAudioUrls.length;
  const totalAssetCount = imageCount + videoCount + audioCount;

  if (imageCount > 9) {
    throw new SogniValidationError('Seedance supports at most 9 image assets');
  }
  if (videoCount > 3) {
    throw new SogniValidationError('Seedance supports at most 3 video assets');
  }
  if (audioCount > 3) {
    throw new SogniValidationError('Seedance supports at most 3 audio assets');
  }
  if (totalAssetCount > 12) {
    throw new SogniValidationError('Seedance supports at most 12 total asset files');
  }
  if (audioCount > 0 && imageCount === 0 && videoCount === 0) {
    throw new SogniValidationError(
      'Seedance audio references require at least one image or video reference'
    );
  }
}

/**
 * Get the maximum number of context images supported by a model
 */
export function getMaxContextImages(modelId: string): number {
  if (modelId.includes('qwen_image_edit')) {
    return 3;
  }
  if (modelId.includes('kontext')) {
    return 2;
  }
  if (modelId.includes('flux')) {
    return 6;
  }
  return 0; // Model doesn't support context images
}

/**
 * Check if a model supports context images
 */
export function supportsContextImages(modelId: string): boolean {
  return getMaxContextImages(modelId) > 0;
}

/**
 * Check if using cookie-based authentication
 */
export function isCookieAuth(config: SogniClientConfig): boolean {
  return config.authType === 'cookies';
}

/**
 * Validate client configuration
 */
export function validateClientConfig(config: SogniClientConfig): void {
  // Validate authType if provided
  if (config.authType !== undefined && !['token', 'cookies', 'apiKey'].includes(config.authType)) {
    throw new SogniValidationError('authType must be one of: "token", "cookies", "apiKey"');
  }

  const authType = config.authType ?? (config.apiKey ? 'apiKey' : 'token');

  if (authType === 'apiKey') {
    if (!config.apiKey || typeof config.apiKey !== 'string') {
      throw new SogniValidationError('apiKey is required and must be a string for apiKey auth');
    }

    if (config.username !== undefined && typeof config.username !== 'string') {
      throw new SogniValidationError('Username must be a string if provided');
    }
    if (config.password !== undefined && typeof config.password !== 'string') {
      throw new SogniValidationError('Password must be a string if provided');
    }
  } else if (authType !== 'cookies') {
    // For token auth (default), username and password are required
    if (!config.username || typeof config.username !== 'string') {
      throw new SogniValidationError('Username is required and must be a string');
    }

    if (!config.password || typeof config.password !== 'string') {
      throw new SogniValidationError('Password is required and must be a string');
    }
  }

  // For cookie auth, username/password are optional but must be strings if provided
  if (authType === 'cookies') {
    if (config.username !== undefined && typeof config.username !== 'string') {
      throw new SogniValidationError('Username must be a string if provided');
    }
    if (config.password !== undefined && typeof config.password !== 'string') {
      throw new SogniValidationError('Password must be a string if provided');
    }
  }

  if (config.network && !['fast', 'relaxed'].includes(config.network)) {
    throw new SogniValidationError('Network must be either "fast" or "relaxed"');
  }

  if (config.testnet !== undefined && typeof config.testnet !== 'boolean') {
    throw new SogniValidationError('testnet must be a boolean');
  }

  if (config.socketEndpoint !== undefined && typeof config.socketEndpoint !== 'string') {
    throw new SogniValidationError('socketEndpoint must be a string');
  }

  if (config.restEndpoint !== undefined && typeof config.restEndpoint !== 'string') {
    throw new SogniValidationError('restEndpoint must be a string');
  }

  if (config.disableSocket !== undefined && typeof config.disableSocket !== 'boolean') {
    throw new SogniValidationError('disableSocket must be a boolean');
  }

  if (config.allowInsecureTLS !== undefined && typeof config.allowInsecureTLS !== 'boolean') {
    throw new SogniValidationError('allowInsecureTLS must be a boolean');
  }

  if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
    throw new SogniValidationError('Timeout must be a positive number');
  }

  if (config.reconnectInterval !== undefined && (typeof config.reconnectInterval !== 'number' || config.reconnectInterval <= 0)) {
    throw new SogniValidationError('Reconnect interval must be a positive number');
  }
}

/**
 * Validate project configuration
 */
export function validateProjectConfig(config: ProjectConfig): void {
  if (!config.modelId || typeof config.modelId !== 'string') {
    throw new SogniValidationError('Model ID is required and must be a string');
  }

  if (config.positivePrompt === undefined || config.positivePrompt === null || typeof config.positivePrompt !== 'string') {
    throw new SogniValidationError('Positive prompt is required and must be a string');
  }

  if (!config.type || !['image', 'video', 'audio'].includes(config.type)) {
    throw new SogniValidationError('Project type must be one of: "image", "video", "audio"');
  }

  if (config.numberOfMedia !== undefined) {
    if (typeof config.numberOfMedia !== 'number' || config.numberOfMedia < 1) {
      throw new SogniValidationError(`Number of ${config.type}s must be at least 1`);
    }
  }

  if (config.steps !== undefined) {
    if (typeof config.steps !== 'number' || config.steps < 1 || config.steps > 100) {
      throw new SogniValidationError('Steps must be between 1 and 100');
    }
  }

  if (config.guidance !== undefined) {
    if (typeof config.guidance !== 'number' || config.guidance < 0 || config.guidance > 30) {
      throw new SogniValidationError('Guidance must be between 0 and 30');
    }
  }

  if (isImageProjectConfig(config) || isVideoProjectConfig(config)) {
    if (config.width !== undefined) {
      if (typeof config.width !== 'number' || config.width < 256 || config.width > 2048) {
        throw new SogniValidationError('Width must be between 256 and 2048');
      }
    }

    if (config.height !== undefined) {
      if (typeof config.height !== 'number' || config.height < 256 || config.height > 2048) {
        throw new SogniValidationError('Height must be between 256 and 2048');
      }
    }
  }

  if (config.tokenType && !['sogni', 'spark'].includes(config.tokenType)) {
    throw new SogniValidationError('Token type must be either "sogni" or "spark"');
  }

  // Type-specific validations
  if (isImageProjectConfig(config)) {
    if (config.outputFormat && !['png', 'jpg'].includes(config.outputFormat)) {
      throw new SogniValidationError('Image output format must be either "png" or "jpg"');
    }

    if (config.startingImageStrength !== undefined) {
      if (typeof config.startingImageStrength !== 'number' || config.startingImageStrength < 0 || config.startingImageStrength > 1) {
        throw new SogniValidationError('Starting image strength must be between 0 and 1');
      }
    }

    // Context images validation
    if (config.contextImages !== undefined) {
      if (!Array.isArray(config.contextImages)) {
        throw new SogniValidationError('contextImages must be an array');
      }

      const maxImages = 6; // Maximum across all models
      if (config.contextImages.length > maxImages) {
        throw new SogniValidationError(
          `contextImages can have at most ${maxImages} images`
        );
      }

      // Validate each item is valid InputMedia type
      for (let i = 0; i < config.contextImages.length; i++) {
        const img = config.contextImages[i];
        const isValid = img === true ||
                        Buffer.isBuffer(img) ||
                        (typeof Blob !== 'undefined' && img instanceof Blob);
        if (!isValid && img !== undefined) {
          throw new SogniValidationError(
            `contextImages[${i}] must be a Buffer, Blob, or true (for pre-uploaded)`
          );
        }
      }
    }
  }

  if (isVideoProjectConfig(config)) {
    if (config.outputFormat && config.outputFormat !== 'mp4') {
      throw new SogniValidationError('Video output format must be "mp4"');
    }

    const isSeedance = isSeedanceVideoModel(config.modelId);
    if (!isSeedance) {
      if (config.referenceImageUrls || config.referenceVideoUrls || config.referenceAudioUrls) {
        throw new SogniValidationError(
          'referenceImageUrls, referenceVideoUrls, and referenceAudioUrls are supported only by Seedance models'
        );
      }
    } else {
      validateSeedanceReferenceAssets(config);
    }

    if (config.generateAudio !== undefined && typeof config.generateAudio !== 'boolean') {
      throw new SogniValidationError('generateAudio must be a boolean');
    }

    if (config.duration !== undefined) {
      const limits = getVideoDurationLimits(config.modelId);
      if (
        typeof config.duration !== 'number' ||
        config.duration < limits.min ||
        config.duration > limits.max
      ) {
        throw new SogniValidationError(
          `Video duration must be between ${limits.min} and ${limits.max} seconds`
        );
      }
    }

    if (config.frames !== undefined) {
      if (typeof config.frames !== 'number' || config.frames < 1 || config.frames > 2001) {
        throw new SogniValidationError('Frames must be between 1 and 2001');
      }
    }

    if (config.fps !== undefined) {
      if (typeof config.fps !== 'number' || config.fps < 1 || config.fps > 60) {
        throw new SogniValidationError('FPS must be between 1 and 60');
      }
      if (isSeedance && config.fps !== 24) {
        throw new SogniValidationError('Seedance models use fixed 24fps video generation');
      }
    }

    if (config.shift !== undefined) {
      if (typeof config.shift !== 'number' || config.shift < 0 || config.shift > 10) {
        throw new SogniValidationError('Shift must be between 0 and 10');
      }
    }

    if (config.detailerStrength !== undefined) {
      if (typeof config.detailerStrength !== 'number' || config.detailerStrength < 0 || config.detailerStrength > 1) {
        throw new SogniValidationError('detailerStrength must be between 0 and 1');
      }
    }
  }

  if (isAudioProjectConfig(config)) {
    if (config.outputFormat && !['mp3', 'flac', 'wav'].includes(config.outputFormat)) {
      throw new SogniValidationError('Audio output format must be one of: "mp3", "flac", "wav"');
    }

    if (config.duration !== undefined) {
      if (typeof config.duration !== 'number' || config.duration < 10 || config.duration > 600) {
        throw new SogniValidationError('Audio duration must be between 10 and 600 seconds');
      }
    }

    if (config.bpm !== undefined) {
      if (typeof config.bpm !== 'number' || config.bpm < 30 || config.bpm > 300) {
        throw new SogniValidationError('Audio BPM must be between 30 and 300');
      }
    }

    if (config.promptStrength !== undefined) {
      if (typeof config.promptStrength !== 'number' || config.promptStrength < 0 || config.promptStrength > 10) {
        throw new SogniValidationError('promptStrength must be between 0 and 10');
      }
    }

    if (config.creativity !== undefined) {
      if (typeof config.creativity !== 'number' || config.creativity < 0 || config.creativity > 2) {
        throw new SogniValidationError('creativity must be between 0 and 2');
      }
    }
  }
}

/**
 * Create a promise that rejects after a timeout
 */
export function createTimeoutPromise<T>(timeoutMs: number, errorMessage: string = 'Operation timed out'): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    timeoutMessage?: string;
  } = {}
): Promise<void> {
  const { timeout = 30000, interval = 100, timeoutMessage = 'Wait condition timed out' } = options;

  const startTime = Date.now();

  while (true) {
    const result = await Promise.resolve(condition());
    if (result) {
      return;
    }

    if (Date.now() - startTime >= timeout) {
      throw new Error(timeoutMessage);
    }

    await sleep(interval);
  }
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw lastError;
      }

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      await sleep(delay);
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if value is a plain object
 */
export function isPlainObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && value.constructor === Object;
}

/**
 * Merge objects deeply
 */
export function deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;

  const source = sources.shift();
  if (!source) return target;

  if (isPlainObject(target) && isPlainObject(source)) {
    for (const key in source) {
      if (isPlainObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key] as any);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Sanitize string for logging (hide sensitive data)
 */
export function sanitizeForLog(str: string, keysToHide: string[] = ['password', 'apiKey', 'token']): string {
  let sanitized = str;
  
  keysToHide.forEach(key => {
    const regex = new RegExp(`(${key}["\']?\\s*[:=]\\s*["\']?)([^"',}\\s]+)`, 'gi');
    sanitized = sanitized.replace(regex, '$1***');
  });
  
  return sanitized;
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, waitMs);
  };
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limitMs);
    }
  };
}
