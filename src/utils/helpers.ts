/**
 * Utility helper functions
 */

import { randomUUID } from 'crypto';
import type { ProjectConfig, SogniClientConfig, ImageProjectConfig, VideoProjectConfig } from '../types';
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
 * Validate client configuration
 */
export function validateClientConfig(config: SogniClientConfig): void {
  if (!config.username || typeof config.username !== 'string') {
    throw new SogniValidationError('Username is required and must be a string');
  }

  if (!config.password || typeof config.password !== 'string') {
    throw new SogniValidationError('Password is required and must be a string');
  }

  if (config.network && !['fast', 'relaxed'].includes(config.network)) {
    throw new SogniValidationError('Network must be either "fast" or "relaxed"');
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

  if (!config.positivePrompt || typeof config.positivePrompt !== 'string') {
    throw new SogniValidationError('Positive prompt is required and must be a string');
  }

  if (!config.type || !['image', 'video'].includes(config.type)) {
    throw new SogniValidationError('Project type must be either "image" or "video"');
  }

  if (config.numberOfMedia !== undefined) {
    const maxMedia = config.type === 'video' ? 4 : 10; // Videos typically have lower limit
    if (typeof config.numberOfMedia !== 'number' || config.numberOfMedia < 1 || config.numberOfMedia > maxMedia) {
      throw new SogniValidationError(`Number of ${config.type}s must be between 1 and ${maxMedia}`);
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
  }

  if (isVideoProjectConfig(config)) {
    if (config.outputFormat && config.outputFormat !== 'mp4') {
      throw new SogniValidationError('Video output format must be "mp4"');
    }

    if (config.frames !== undefined) {
      if (typeof config.frames !== 'number' || config.frames < 1 || config.frames > 240) {
        throw new SogniValidationError('Frames must be between 1 and 240');
      }
    }

    if (config.fps !== undefined) {
      if (typeof config.fps !== 'number' || config.fps < 1 || config.fps > 60) {
        throw new SogniValidationError('FPS must be between 1 and 60');
      }
    }

    if (config.shift !== undefined) {
      if (typeof config.shift !== 'number' || config.shift < 0 || config.shift > 10) {
        throw new SogniValidationError('Shift must be between 0 and 10');
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

