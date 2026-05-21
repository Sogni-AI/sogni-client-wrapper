/**
 * Basic tests for sogni-client-wrapper
 * These tests validate structure, types, and error handling without requiring actual API credentials
 */

import {
  SogniClientWrapper,
  SogniError,
  SogniValidationError,
  SogniAuthenticationError,
  ClientEvent,
  generateAppId,
  isImageProjectConfig,
  isVideoProjectConfig,
  isAudioProjectConfig,
  isCookieAuth,
  validateProjectConfig,
  validateClientConfig,
  getMaxContextImages,
  supportsContextImages,
  type ImageProjectConfig,
  type VideoProjectConfig,
  type AudioProjectConfig,
  type SogniClientConfig,
  type TokenAuthConfig,
  type CookieAuthConfig,
  type ApiKeyAuthConfig,
  type AuthType,
  type QwenImageEditConfig,
  type InputMedia,
  type VideoControlNetName,
  type VideoControlNetParams,
  SogniTools,
  isSogniToolCall,
  parseToolCallArguments,
  parseCreativeWorkflowSseChunk,
  type ToolCall,
  type ToolDefinition,
} from '../src';
import {
  auditCompiledStoryboardImagePrompt,
  buildStoryboardProject,
  compileVideoStoryboardImagePrompt,
} from '../src/public-skill-runtime/index.js';
import {
  SEEDANCE_VENDOR_TIMEOUT_MESSAGE,
  seedanceTerminalGenerationFailurePayloadFromError,
} from '../src/tools/index.js';
import { SogniClient } from '@sogni-ai/sogni-client';
import { runToolsSharedTests } from './tools-shared-tests';

console.log('🧪 Starting sogni-client-wrapper tests...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      testsPassed++;
    } catch (error) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      testsFailed++;
    }
  };
}

async function runTests() {
  // Test 1: Import validation
  await test('Should import all exports', () => {
    if (!SogniClientWrapper) throw new Error('SogniClientWrapper not imported');
    if (!SogniError) throw new Error('SogniError not imported');
    if (!ClientEvent) throw new Error('ClientEvent not imported');
    if (!generateAppId) throw new Error('generateAppId not imported');
  })();

  // Test 2: AppId generation
  await test('Should generate valid UUID appId', () => {
    const appId = generateAppId();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(appId)) {
      throw new Error(`Generated appId is not a valid UUID: ${appId}`);
    }
  })();

  // Test 3: Client instantiation with valid config
  await test('Should create client instance with valid config', () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false, // Don't auto-connect in tests
    });
    if (!client) throw new Error('Client not created');
    if (!client.isConnected) throw new Error('isConnected method not available');
  })();

  // Test 4: Validation error for missing username
  await test('Should throw validation error for missing username', () => {
    try {
      new SogniClientWrapper({
        username: '',
        password: 'test-pass',
        autoConnect: false,
      });
      throw new Error('Should have thrown validation error');
    } catch (error) {
      if (!(error instanceof SogniValidationError)) {
        throw new Error('Expected SogniValidationError');
      }
    }
  })();

  // Test 5: Validation error for missing password
  await test('Should throw validation error for missing password', () => {
    try {
      new SogniClientWrapper({
        username: 'test-user',
        password: '',
        autoConnect: false,
      });
      throw new Error('Should have thrown validation error');
    } catch (error) {
      if (!(error instanceof SogniValidationError)) {
        throw new Error('Expected SogniValidationError');
      }
    }
  })();

  // Test 6: Default configuration values
  await test('Should apply default configuration values', () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });
    
    const state = client.getConnectionState();
    if (state.status !== 'disconnected') {
      throw new Error('Initial state should be disconnected');
    }
  })();

  // Test 7: Custom configuration values
  await test('Should accept custom configuration values', () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      network: 'relaxed',
      timeout: 60000,
      debug: true,
      autoConnect: false,
    });
    if (!client) throw new Error('Client not created with custom config');
  })();

  // Test 8: Event emitter functionality
  await test('Should support event listeners', () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    let eventFired = false;
    client.on(ClientEvent.CONNECTED, () => {
      eventFired = true;
    });

    // Manually emit to test
    client.emit(ClientEvent.CONNECTED);
    
    if (!eventFired) {
      throw new Error('Event listener not working');
    }
  })();

  // Test 9: Connection state tracking
  await test('Should track connection state', () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    const state = client.getConnectionState();
    if (!state) throw new Error('Connection state not available');
    if (typeof state.isConnected !== 'boolean') {
      throw new Error('isConnected should be boolean');
    }
    if (!state.status) throw new Error('Status not available');
  })();

  // Test 10: Error class hierarchy
  await test('Should have proper error class hierarchy', () => {
    const error = new SogniError('Test error', 'TEST_CODE');
    if (!(error instanceof Error)) {
      throw new Error('SogniError should extend Error');
    }
    if (error.code !== 'TEST_CODE') {
      throw new Error('Error code not set correctly');
    }
    
    const errorData = error.toErrorData();
    if (!errorData.code || !errorData.message) {
      throw new Error('toErrorData not working correctly');
    }
  })();

  // Test 11: ClientEvent constants
  await test('Should have all ClientEvent constants', () => {
    const requiredEvents = [
      'connected', 'disconnected', 'reconnecting', 'reconnected',
      'error', 'modelsUpdated', 'balanceUpdated',
      'projectCreated', 'projectProgress', 'projectCompleted', 'projectFailed',
      'chatToken', 'chatCompleted', 'chatError', 'chatJobState', 'chatModelsUpdated'
    ];

    const eventValues = Object.values(ClientEvent) as string[];
    for (const event of requiredEvents) {
      if (!eventValues.includes(event)) {
        throw new Error(`Missing event: ${event}`);
      }
    }
  })();

  // Test 12: Type exports
  await test('Should export TypeScript types', () => {
    // This test validates that types are properly exported
    // TypeScript will catch any issues at compile time
    const config: import('../src').SogniClientConfig = {
      username: 'test',
      password: 'test',
    };
    if (!config) throw new Error('Type not working');
  })();

  // Test 13: Disconnect without connection
  await test('Should handle disconnect when not connected', async () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    // Should not throw
    await client.disconnect();
  })();

  // Test 14: isConnected returns false initially
  await test('Should return false for isConnected initially', () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    if (client.isConnected()) {
      throw new Error('Should not be connected initially');
    }
  })();

  // Test 15: Multiple client instances
  await test('Should support multiple client instances', () => {
    const client1 = new SogniClientWrapper({
      username: 'user1',
      password: 'pass1',
      autoConnect: false,
    });

    const client2 = new SogniClientWrapper({
      username: 'user2',
      password: 'pass2',
      autoConnect: false,
    });

    if (client1 === client2) {
      throw new Error('Clients should be separate instances');
    }
  })();

  // Test 16: Video project type guard
  await test('Should identify video project config', () => {
    const videoConfig: VideoProjectConfig = {
      type: 'video',
      modelId: 'wan_v2.2-14b-fp8_t2v',
      positivePrompt: 'A beautiful sunset over mountains',
      numberOfMedia: 1,
      frames: 30,
      fps: 15,
    };

    if (!isVideoProjectConfig(videoConfig)) {
      throw new Error('Video config not identified correctly');
    }
    if (isImageProjectConfig(videoConfig)) {
      throw new Error('Video config misidentified as image config');
    }
  })();

  // Test 17: Image project type guard
  await test('Should identify image project config', () => {
    const imageConfig: ImageProjectConfig = {
      type: 'image',
      modelId: 'flux-1-schnell',
      positivePrompt: 'A beautiful sunset over mountains',
      numberOfMedia: 1,
      width: 1024,
      height: 1024,
    };

    if (!isImageProjectConfig(imageConfig)) {
      throw new Error('Image config not identified correctly');
    }
    if (isVideoProjectConfig(imageConfig)) {
      throw new Error('Image config misidentified as video config');
    }
  })();

  // Test 17b: Audio project type guard
  await test('Should identify audio project config', () => {
    const audioConfig: AudioProjectConfig = {
      type: 'audio',
      modelId: 'ace-step-v1',
      positivePrompt: 'Upbeat electronic track',
      numberOfMedia: 1,
      duration: 30,
      outputFormat: 'mp3',
    };

    if (!isAudioProjectConfig(audioConfig)) {
      throw new Error('Audio config not identified correctly');
    }
    if (isImageProjectConfig(audioConfig) || isVideoProjectConfig(audioConfig)) {
      throw new Error('Audio config misidentified as image/video config');
    }
  })();

  // Test 18: Video project validation
  await test('Should validate video project parameters', () => {
    const videoConfig: VideoProjectConfig = {
      type: 'video',
      modelId: 'wan_v2.2-14b-fp8_t2v',
      positivePrompt: 'A beautiful sunset',
      numberOfMedia: 1,
      frames: 30,
      fps: 15,
      outputFormat: 'mp4',
    };

    // Should not throw
    validateProjectConfig(videoConfig);
  })();

  // Test 18b: Empty positive prompt allowed
  await test('Should allow empty positive prompt', () => {
    const videoConfig: VideoProjectConfig = {
      type: 'video',
      modelId: 'wan_v2.2-14b-fp8_t2v',
      positivePrompt: '',
      numberOfMedia: 1,
      frames: 30,
      fps: 15,
      outputFormat: 'mp4',
    };

    // Should not throw
    validateProjectConfig(videoConfig);
  })();

  // Test 19: Invalid video FPS validation
  await test('Should reject invalid video FPS', () => {
    const videoConfig: VideoProjectConfig = {
      type: 'video',
      modelId: 'wan_v2.2-14b-fp8_t2v',
      positivePrompt: 'A beautiful sunset',
      numberOfMedia: 1,
      fps: 100, // Invalid: too high
    };

    try {
      validateProjectConfig(videoConfig);
      throw new Error('Should have rejected invalid FPS');
    } catch (error) {
      if (!(error instanceof SogniValidationError)) {
        throw new Error('Wrong error type for invalid FPS');
      }
    }
  })();

  // Test 20: Invalid video frames validation
  await test('Should reject invalid video frames', () => {
    const videoConfig: VideoProjectConfig = {
      type: 'video',
      modelId: 'wan_v2.2-14b-fp8_t2v',
      positivePrompt: 'A beautiful sunset',
      numberOfMedia: 1,
      frames: 0, // Invalid: too low
    };

    try {
      validateProjectConfig(videoConfig);
      throw new Error('Should have rejected invalid frames');
    } catch (error) {
      if (!(error instanceof SogniValidationError)) {
        throw new Error('Wrong error type for invalid frames');
      }
    }
  })();

  // Test 21: Video output format validation
  await test('Should validate video output format', () => {
    const videoConfig = {
      type: 'video' as const,
      modelId: 'wan_v2.2-14b-fp8_t2v',
      positivePrompt: 'A beautiful sunset',
      numberOfMedia: 1,
      outputFormat: 'avi', // Invalid format
    };

    try {
      validateProjectConfig(videoConfig as VideoProjectConfig);
      throw new Error('Should have rejected invalid video format');
    } catch (error) {
      if (!(error instanceof SogniValidationError)) {
        throw new Error('Wrong error type for invalid format');
      }
    }
  })();

  // Test 21b: Audio project validation
  await test('Should validate audio project parameters', () => {
    const audioConfig: AudioProjectConfig = {
      type: 'audio',
      modelId: 'ace-step-v1',
      positivePrompt: 'Ambient cinematic score',
      numberOfMedia: 1,
      duration: 30,
      bpm: 120,
      outputFormat: 'wav',
    };

    validateProjectConfig(audioConfig);
  })();

  // Test 21c: Audio output format validation
  await test('Should reject invalid audio output format', () => {
    const audioConfig = {
      type: 'audio' as const,
      modelId: 'ace-step-v1',
      positivePrompt: 'Ambient cinematic score',
      numberOfMedia: 1,
      outputFormat: 'aac',
    };

    try {
      validateProjectConfig(audioConfig as any);
      throw new Error('Should have rejected invalid audio format');
    } catch (error) {
      if (!(error instanceof SogniValidationError)) {
        throw new Error('Wrong error type for invalid audio format');
      }
    }
  })();

  // Test 22: createImageProject method exists
  await test('Should have createImageProject method', () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    if (typeof client.createImageProject !== 'function') {
      throw new Error('createImageProject method not found');
    }
  })();

  // Test 23: createVideoProject method exists
  await test('Should have createVideoProject method', () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    if (typeof client.createVideoProject !== 'function') {
      throw new Error('createVideoProject method not found');
    }
  })();

  // Test 23b: createAudioProject method exists
  await test('Should have createAudioProject method', () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    if (typeof client.createAudioProject !== 'function') {
      throw new Error('createAudioProject method not found');
    }
  })();

  // Test 23c: Chat methods exist
  await test('Should have chat helper methods', () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    if (typeof client.createChatCompletion !== 'function') {
      throw new Error('createChatCompletion method not found');
    }
    if (typeof client.estimateChatCost !== 'function') {
      throw new Error('estimateChatCost method not found');
    }
    if (typeof client.getAvailableChatModels !== 'function') {
      throw new Error('getAvailableChatModels method not found');
    }
  })();

  // Test 24: Project type is required
  await test('Should require project type', () => {
    const config = {
      modelId: 'flux-1-schnell',
      positivePrompt: 'A beautiful sunset',
      numberOfMedia: 1,
      // Missing 'type' field
    } as any;

    try {
      validateProjectConfig(config);
      throw new Error('Should have required project type');
    } catch (error) {
      if (!(error instanceof SogniValidationError)) {
        throw new Error('Wrong error type for missing type');
      }
    }
  })();

  // Test 25: Cookie auth config without credentials
  await test('Should allow cookie auth without username/password', () => {
    const config: CookieAuthConfig = {
      authType: 'cookies',
      autoConnect: false,
    };

    // Should not throw - username/password are optional for cookie auth
    validateClientConfig(config);
  })();

  // Test 26: Cookie auth client creation
  await test('Should create client with cookie auth config', () => {
    const client = new SogniClientWrapper({
      authType: 'cookies',
      autoConnect: false,
    });
    if (!client) throw new Error('Client not created with cookie auth');
    if (!client.isConnected) throw new Error('isConnected method not available');
  })();

  // Test 26b: API key auth client creation
  await test('Should create client with apiKey auth config', () => {
    const client = new SogniClientWrapper({
      authType: 'apiKey',
      apiKey: 'test-api-key',
      autoConnect: false,
    });
    if (!client) throw new Error('Client not created with apiKey auth');
    if (!client.isConnected) throw new Error('isConnected method not available');
  })();

  // Test 27: isCookieAuth helper returns true for cookie auth
  await test('Should identify cookie auth config', () => {
    const cookieConfig: CookieAuthConfig = {
      authType: 'cookies',
    };

    if (!isCookieAuth(cookieConfig)) {
      throw new Error('isCookieAuth should return true for cookies auth');
    }
  })();

  // Test 28: isCookieAuth helper returns false for token auth
  await test('Should identify token auth config', () => {
    const tokenConfig: TokenAuthConfig = {
      authType: 'token',
      username: 'test',
      password: 'test',
    };

    if (isCookieAuth(tokenConfig)) {
      throw new Error('isCookieAuth should return false for token auth');
    }
  })();

  // Test 29: isCookieAuth helper returns false when authType is undefined
  await test('Should default to token auth when authType is undefined', () => {
    const config: SogniClientConfig = {
      username: 'test',
      password: 'test',
      // authType not set - defaults to token
    };

    if (isCookieAuth(config)) {
      throw new Error('isCookieAuth should return false when authType is undefined');
    }
  })();

  // Test 30: Token auth requires username
  await test('Should require username for token auth', () => {
    const config = {
      authType: 'token' as const,
      password: 'test-pass',
    };

    try {
      validateClientConfig(config as any);
      throw new Error('Should have required username for token auth');
    } catch (error) {
      if (!(error instanceof SogniValidationError)) {
        throw new Error('Wrong error type');
      }
    }
  })();

  // Test 31: Token auth requires password
  await test('Should require password for token auth', () => {
    const config = {
      authType: 'token' as const,
      username: 'test-user',
    };

    try {
      validateClientConfig(config as any);
      throw new Error('Should have required password for token auth');
    } catch (error) {
      if (!(error instanceof SogniValidationError)) {
        throw new Error('Wrong error type');
      }
    }
  })();

  // Test 32: Cookie auth with optional credentials
  await test('Should allow cookie auth with optional credentials', () => {
    const config: CookieAuthConfig = {
      authType: 'cookies',
      username: 'optional-user',
      password: 'optional-pass',
    };

    // Should not throw - credentials are optional for cookie auth
    validateClientConfig(config);
  })();

  // Test 33: Invalid authType validation
  await test('Should reject invalid authType', () => {
    const config = {
      authType: 'invalid' as any,
      username: 'test',
      password: 'test',
    };

    try {
      validateClientConfig(config as any);
      throw new Error('Should have rejected invalid authType');
    } catch (error) {
      if (!(error instanceof SogniValidationError)) {
        throw new Error('Wrong error type');
      }
    }
  })();

  // Test 33b: API key auth config validation
  await test('Should allow apiKey auth config', () => {
    const config: ApiKeyAuthConfig = {
      authType: 'apiKey',
      apiKey: 'test-api-key',
      autoConnect: false,
    };
    validateClientConfig(config);
  })();

  // Test 33c: API key auth requires apiKey
  await test('Should require apiKey for apiKey auth', () => {
    const config = {
      authType: 'apiKey' as const,
      autoConnect: false,
    };

    try {
      validateClientConfig(config as any);
      throw new Error('Should have required apiKey');
    } catch (error) {
      if (!(error instanceof SogniValidationError)) {
        throw new Error('Wrong error type');
      }
    }
  })();

  // Test 34: AuthType type export
  await test('Should export AuthType type', () => {
    // TypeScript validates at compile time
    const tokenAuth: AuthType = 'token';
    const cookieAuth: AuthType = 'cookies';
    const apiKeyAuth: AuthType = 'apiKey';
    if (!tokenAuth || !cookieAuth || !apiKeyAuth) throw new Error('AuthType not working');
  })();

  // Test 35: Context images validation - valid array with true values
  await test('Should accept valid contextImages array with boolean true', () => {
    const config: ImageProjectConfig = {
      type: 'image',
      modelId: 'qwen_image_edit_2511_fp8',
      positivePrompt: 'Transform the image',
      numberOfMedia: 1,
      contextImages: [true, true, true],
    };
    validateProjectConfig(config);
  })();

  // Test 36: Context images validation - exceeds maximum
  await test('Should reject contextImages exceeding maximum of 6', () => {
    const config = {
      type: 'image' as const,
      modelId: 'qwen_image_edit_2511_fp8',
      positivePrompt: 'Transform the image',
      numberOfMedia: 1,
      contextImages: [true, true, true, true, true, true, true], // 7 images
    };

    try {
      validateProjectConfig(config as ImageProjectConfig);
      throw new Error('Should have thrown');
    } catch (error) {
      if (!(error instanceof SogniValidationError)) {
        throw new Error('Expected SogniValidationError');
      }
    }
  })();

  // Test 37: Context images validation - not an array
  await test('Should reject non-array contextImages', () => {
    const config = {
      type: 'image' as const,
      modelId: 'qwen_image_edit_2511_fp8',
      positivePrompt: 'Transform the image',
      numberOfMedia: 1,
      contextImages: 'not-an-array',
    };

    try {
      validateProjectConfig(config as any);
      throw new Error('Should have thrown');
    } catch (error) {
      if (!(error instanceof SogniValidationError)) {
        throw new Error('Expected SogniValidationError');
      }
    }
  })();

  // Test 38: getMaxContextImages helper
  await test('getMaxContextImages returns correct values for Qwen models', () => {
    if (getMaxContextImages('qwen_image_edit_2511_fp8') !== 3) {
      throw new Error('Qwen should support 3 context images');
    }
    if (getMaxContextImages('qwen_image_edit_2511_fp8_lightning') !== 3) {
      throw new Error('Qwen lightning should support 3 context images');
    }
  })();

  // Test 39: getMaxContextImages for other models
  await test('getMaxContextImages returns correct values for other models', () => {
    if (getMaxContextImages('flux-1-schnell') !== 6) {
      throw new Error('Flux should support 6 context images');
    }
    if (getMaxContextImages('kontext-model') !== 2) {
      throw new Error('Kontext should support 2 context images');
    }
    if (getMaxContextImages('sd-xl-base') !== 0) {
      throw new Error('SD-XL should return 0 for context images');
    }
  })();

  // Test 40: supportsContextImages helper
  await test('supportsContextImages returns correct values', () => {
    if (!supportsContextImages('qwen_image_edit_2511_fp8')) {
      throw new Error('Qwen should support context images');
    }
    if (!supportsContextImages('flux-1-schnell')) {
      throw new Error('Flux should support context images');
    }
    if (supportsContextImages('sd-xl-base')) {
      throw new Error('SD-XL should not support context images');
    }
  })();

  // Test 41: createImageEditProject method exists
  await test('Should have createImageEditProject method', () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    if (typeof client.createImageEditProject !== 'function') {
      throw new Error('createImageEditProject method not found');
    }
  })();

  // Test 42: QwenImageEditConfig type is exported
  await test('Should export QwenImageEditConfig and InputMedia types', () => {
    // TypeScript validates at compile time
    const config: QwenImageEditConfig = {
      modelId: 'qwen_image_edit_2511_fp8',
      positivePrompt: 'Transform the image',
      numberOfMedia: 1,
      contextImages: [true],
    };
    if (!config) throw new Error('QwenImageEditConfig type not working');
  })();

  // Test 43: Context images validation - valid Buffer
  await test('Should accept valid contextImages with Buffer', () => {
    const config: ImageProjectConfig = {
      type: 'image',
      modelId: 'qwen_image_edit_2511_fp8',
      positivePrompt: 'Transform the image',
      numberOfMedia: 1,
      contextImages: [Buffer.from('test')],
    };
    validateProjectConfig(config);
  })();

  // Test 44: Context images validation - empty array is valid
  await test('Should accept empty contextImages array', () => {
    const config: ImageProjectConfig = {
      type: 'image',
      modelId: 'qwen_image_edit_2511_fp8',
      positivePrompt: 'Transform the image',
      numberOfMedia: 1,
      contextImages: [],
    };
    validateProjectConfig(config);
  })();

  // Test 45: Video ControlNet types are exported
  await test('Should export VideoControlNetName and VideoControlNetParams types', () => {
    const controlName: VideoControlNetName = 'pose';
    const controlParams: VideoControlNetParams = {
      name: controlName,
      strength: 0.7,
    };
    if (!controlParams) throw new Error('VideoControlNetParams type not working');
  })();

  // Test 46: Video project config accepts new video workflow fields
  await test('Should accept v2v/sam2/trim/keyframe video fields', () => {
    const v2vConfig: VideoProjectConfig = {
      type: 'video',
      modelId: 'ltx2-19b-fp8_v2v_distilled',
      positivePrompt: 'Cinematic motion with consistent style',
      numberOfMedia: 1,
      referenceVideo: true,
      controlNet: { name: 'pose', strength: 0.8 },
      trimEndFrame: true,
      firstFrameStrength: 0.6,
      lastFrameStrength: 0.6,
      fps: 24,
      duration: 5,
    };

    const animateReplaceConfig: VideoProjectConfig = {
      type: 'video',
      modelId: 'wan_v2.2-14b-fp8_animate_replace',
      positivePrompt: 'Replace subject while preserving movement',
      numberOfMedia: 1,
      referenceImage: true,
      referenceVideo: true,
      sam2Coordinates: [{ x: 0.5, y: 0.5 }],
      fps: 16,
      duration: 5,
    };

    validateProjectConfig(v2vConfig);
    validateProjectConfig(animateReplaceConfig);
  })();

  // Test 47: createProject should not inject empty prompts
  await test('Should not inject empty negative/style prompts when omitted', async () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    let capturedParams: any = null;
    const projectStub = {
      id: 'project-test',
      on: () => {},
      waitForCompletion: async () => [],
    };

    (client as any).client = {
      projects: {
        create: async (params: any) => {
          capturedParams = params;
          return projectStub;
        },
      },
    };
    (client as any).connectionState = {
      ...(client as any).connectionState,
      isConnected: true,
    };

    await client.createProject({
      type: 'image',
      modelId: 'flux-1-schnell',
      positivePrompt: 'A simple test image',
      numberOfMedia: 1,
      waitForCompletion: false,
    });

    if (!capturedParams) {
      throw new Error('Did not capture SDK create params');
    }
    if ('negativePrompt' in capturedParams) {
      throw new Error('negativePrompt should not be injected when omitted');
    }
    if ('stylePrompt' in capturedParams) {
      throw new Error('stylePrompt should not be injected when omitted');
    }
  })();

  // Test 48: estimateVideoCost frame calculation for WAN
  await test('Should calculate WAN frames from duration using fixed 16fps generation', async () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    let capturedEstimateParams: any = null;
    (client as any).client = {
      projects: {
        estimateVideoCost: async (params: any) => {
          capturedEstimateParams = params;
          return { token: '1', usd: '1', spark: '1', sogni: '1' };
        },
      },
    };
    (client as any).connectionState = {
      ...(client as any).connectionState,
      isConnected: true,
    };

    await client.estimateVideoCost({
      modelId: 'wan_v2.2-14b-fp8_t2v',
      width: 768,
      height: 768,
      duration: 5,
      fps: 32,
      steps: 20,
      numberOfMedia: 1,
    });

    if (!capturedEstimateParams) {
      throw new Error('Did not capture estimate params');
    }
    if (capturedEstimateParams.frames !== 81) {
      throw new Error(`Expected WAN frames=81, got ${capturedEstimateParams.frames}`);
    }
  })();

  // Test 49: estimateVideoCost frame calculation for LTX-2
  await test('Should calculate LTX-2 frames from duration and fps with frame-step snapping', async () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    let capturedEstimateParams: any = null;
    (client as any).client = {
      projects: {
        estimateVideoCost: async (params: any) => {
          capturedEstimateParams = params;
          return { token: '1', usd: '1', spark: '1', sogni: '1' };
        },
      },
    };
    (client as any).connectionState = {
      ...(client as any).connectionState,
      isConnected: true,
    };

    await client.estimateVideoCost({
      modelId: 'ltx2-19b-fp8_t2v',
      width: 768,
      height: 768,
      duration: 5,
      fps: 23,
      steps: 20,
      numberOfMedia: 1,
    });

    if (!capturedEstimateParams) {
      throw new Error('Did not capture estimate params');
    }
    if (capturedEstimateParams.frames !== 113) {
      throw new Error(`Expected LTX-2 frames=113, got ${capturedEstimateParams.frames}`);
    }
  })();

  // Test 50: estimateVideoCost allows LTX-2 duration up to 20s
  await test('Should allow 20-second LTX-2 duration for estimateVideoCost', async () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    let capturedEstimateParams: any = null;
    (client as any).client = {
      projects: {
        estimateVideoCost: async (params: any) => {
          capturedEstimateParams = params;
          return { token: '1', usd: '1', spark: '1', sogni: '1' };
        },
      },
    };
    (client as any).connectionState = {
      ...(client as any).connectionState,
      isConnected: true,
    };

    await client.estimateVideoCost({
      modelId: 'ltx2-19b-fp8_t2v',
      width: 768,
      height: 768,
      duration: 20,
      fps: 24,
      steps: 20,
      numberOfMedia: 1,
    });

    if (!capturedEstimateParams) {
      throw new Error('Did not capture estimate params');
    }
    if (capturedEstimateParams.duration !== 20) {
      throw new Error(`Expected duration=20, got ${capturedEstimateParams.duration}`);
    }
  })();

  // Test 51: estimateVideoCost treats LTX 2.3 like the LTX family
  await test('Should apply LTX-family estimateVideoCost rules to LTX 2.3 models', async () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    let capturedEstimateParams: any = null;
    (client as any).client = {
      projects: {
        estimateVideoCost: async (params: any) => {
          capturedEstimateParams = params;
          return { token: '1', usd: '1', spark: '1', sogni: '1' };
        },
      },
    };
    (client as any).connectionState = {
      ...(client as any).connectionState,
      isConnected: true,
    };

    await client.estimateVideoCost({
      modelId: 'ltx23-22b-fp8_t2v_distilled',
      width: 768,
      height: 768,
      duration: 20,
      fps: 24,
      steps: 20,
      numberOfMedia: 1,
    });

    if (!capturedEstimateParams) {
      throw new Error('Did not capture estimate params');
    }
    if (capturedEstimateParams.duration !== 20) {
      throw new Error(`Expected duration=20, got ${capturedEstimateParams.duration}`);
    }
    if (capturedEstimateParams.frames !== 481) {
      throw new Error(`Expected LTX 2.3 frames=481, got ${capturedEstimateParams.frames}`);
    }
  })();

  // Test 52: estimateAudioCost call mapping
  await test('Should map estimateAudioCost params to SDK', async () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    let capturedEstimateParams: any = null;
    (client as any).client = {
      projects: {
        estimateAudioCost: async (params: any) => {
          capturedEstimateParams = params;
          return { token: '1', usd: '1', spark: '1', sogni: '1' };
        },
      },
    };
    (client as any).connectionState = {
      ...(client as any).connectionState,
      isConnected: true,
    };

    await client.estimateAudioCost({
      modelId: 'ace-step-v1',
      duration: 30,
      steps: 20,
      numberOfMedia: 2,
      tokenType: 'spark',
    });

    if (!capturedEstimateParams) {
      throw new Error('Did not capture audio estimate params');
    }
    if (capturedEstimateParams.model !== 'ace-step-v1') {
      throw new Error(`Unexpected model param: ${capturedEstimateParams.model}`);
    }
  })();

  // Test 53: createAudioProject returns audio URLs
  await test('Should return audioUrls for completed audio projects', async () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    const projectStub = {
      id: 'audio-project-test',
      on: () => {},
      waitForCompletion: async () => ['https://example.com/audio-result.mp3'],
    };

    (client as any).client = {
      projects: {
        create: async () => projectStub,
      },
    };
    (client as any).connectionState = {
      ...(client as any).connectionState,
      isConnected: true,
    };

    const result = await client.createAudioProject({
      modelId: 'ace-step-v1',
      positivePrompt: 'A calm ambient song',
      numberOfMedia: 1,
      duration: 30,
      steps: 20,
    });

    if (!result.completed) {
      throw new Error('Audio project should be completed');
    }
    if (!result.audioUrls || result.audioUrls[0] !== 'https://example.com/audio-result.mp3') {
      throw new Error('audioUrls were not mapped correctly');
    }
  })();

  // Test 53: jobCompleted event for audio includes audioUrl
  await test('Should emit audioUrl on JOB_COMPLETED for audio projects', async () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    const handlers: Record<string, (payload: any) => void> = {};
    const projectStub = {
      id: 'audio-project-events',
      on: (event: string, handler: (payload: any) => void) => {
        handlers[event] = handler;
      },
      waitForCompletion: async () => [],
    };

    (client as any).client = {
      projects: {
        create: async () => projectStub,
      },
    };
    (client as any).connectionState = {
      ...(client as any).connectionState,
      isConnected: true,
    };

    let completedData: any = null;
    client.on(ClientEvent.JOB_COMPLETED, (data) => {
      completedData = data;
    });

    await client.createAudioProject({
      modelId: 'ace-step-v1',
      positivePrompt: 'A calm ambient song',
      numberOfMedia: 1,
      duration: 30,
      steps: 20,
      waitForCompletion: false,
    });

    if (!handlers.jobCompleted) {
      throw new Error('Missing jobCompleted handler');
    }

    handlers.jobCompleted({
      resultUrl: 'https://example.com/audio-item.mp3',
    });

    if (!completedData || completedData.audioUrl !== 'https://example.com/audio-item.mp3') {
      throw new Error('audioUrl missing from JOB_COMPLETED event payload');
    }
  })();

  // Test 54: chat method mapping to SDK
  await test('Should map chat helper methods to SDK chat API', async () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    let capturedCompletionParams: any = null;
    let capturedEstimateParams: any = null;
    let capturedWaitTimeout: number | undefined;

    const llmModels = {
      'qwen3-30b-a3b-gptq-int4': { workers: 2 },
    };

    const completionResult = {
      jobID: 'chat-job-1',
      content: 'Hello from chat',
      role: 'assistant',
      finishReason: 'stop',
      usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      timeTaken: 123,
    };

    (client as any).client = {
      chat: {
        models: llmModels,
        waitForModels: async (timeout: number) => {
          capturedWaitTimeout = timeout;
          return llmModels;
        },
        estimateCost: async (params: any) => {
          capturedEstimateParams = params;
          return {
            costInUSD: 0.001,
            costInSogni: 0.01,
            costInSpark: 1,
            costInToken: 1,
            inputTokens: 5,
            outputTokens: 16,
          };
        },
        completions: {
          create: async (params: any) => {
            capturedCompletionParams = params;
            return completionResult;
          },
        },
      },
    };
    (client as any).connectionState = {
      ...(client as any).connectionState,
      isConnected: true,
    };

    const models = await client.getAvailableChatModels();
    if (!models['qwen3-30b-a3b-gptq-int4']) {
      throw new Error('getAvailableChatModels did not return expected model');
    }

    await client.waitForChatModels(2500);
    if (capturedWaitTimeout !== 2500) {
      throw new Error(`waitForChatModels timeout not passed through (got ${capturedWaitTimeout})`);
    }

    await client.estimateChatCost({
      model: 'qwen3-30b-a3b-gptq-int4',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 16,
    });

    if (!capturedEstimateParams || capturedEstimateParams.model !== 'qwen3-30b-a3b-gptq-int4') {
      throw new Error('estimateChatCost params were not mapped correctly');
    }

    const tools: ToolDefinition[] = [
      {
        type: 'function',
        function: {
          name: 'add_numbers',
          description: 'Add two numbers',
          parameters: {
            type: 'object',
            properties: {
              a: { type: 'number' },
              b: { type: 'number' },
            },
            required: ['a', 'b'],
          },
        },
      },
    ];

    const chatResult = await client.createChatCompletion({
      model: 'qwen3-30b-a3b-gptq-int4',
      messages: [{ role: 'user', content: 'Hello' }],
      tools,
      tool_choice: 'auto',
    });

    if (!capturedCompletionParams || capturedCompletionParams.model !== 'qwen3-30b-a3b-gptq-int4') {
      throw new Error('createChatCompletion params were not mapped correctly');
    }
    if (!capturedCompletionParams.tools || capturedCompletionParams.tools[0]?.function?.name !== 'add_numbers') {
      throw new Error('createChatCompletion did not pass tools through to SDK');
    }
    if (capturedCompletionParams.tool_choice !== 'auto') {
      throw new Error('createChatCompletion did not pass tool_choice through to SDK');
    }
    if ((chatResult as any).content !== 'Hello from chat') {
      throw new Error('createChatCompletion did not return expected chat result');
    }
  })();

  // Test 55: chat event forwarding
  await test('Should forward chat events from SDK to wrapper events', async () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    const projectHandlers: Record<string, (...args: any[]) => void> = {};
    const chatHandlers: Record<string, (...args: any[]) => void> = {};

    (client as any).client = {
      projects: {
        on: (event: string, handler: (...args: any[]) => void) => {
          projectHandlers[event] = handler;
        },
        off: () => {},
      },
      chat: {
        on: (event: string, handler: (...args: any[]) => void) => {
          chatHandlers[event] = handler;
        },
        off: () => {},
      },
    };

    (client as any).setupEventListeners();

    let tokenSeen = false;
    let completedSeen = false;
    let errorSeen = false;
    let stateSeen = false;
    let modelsSeen = false;

    client.on(ClientEvent.CHAT_TOKEN, () => { tokenSeen = true; });
    client.on(ClientEvent.CHAT_COMPLETED, () => { completedSeen = true; });
    client.on(ClientEvent.CHAT_ERROR, () => { errorSeen = true; });
    client.on(ClientEvent.CHAT_JOB_STATE, () => { stateSeen = true; });
    client.on(ClientEvent.CHAT_MODELS_UPDATED, () => { modelsSeen = true; });

    chatHandlers.token?.({ jobID: 'j1', content: 'hel' });
    chatHandlers.completed?.({
      jobID: 'j1',
      content: 'hello',
      role: 'assistant',
      finishReason: 'stop',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      timeTaken: 10,
    });
    chatHandlers.error?.({ jobID: 'j1', error: 'failed', message: 'failed' });
    chatHandlers.jobState?.({ jobID: 'j1', type: 'queued' });
    chatHandlers.modelsUpdated?.({ 'qwen3-30b-a3b-gptq-int4': { workers: 1 } });

    if (!tokenSeen || !completedSeen || !errorSeen || !stateSeen || !modelsSeen) {
      throw new Error('Not all chat events were forwarded');
    }
  })();

  // Test 56: apiKey auth connect path
  await test('Should connect with apiKey auth without account.login', async () => {
    const originalCreateInstance = (SogniClient as any).createInstance;

    let createConfig: any = null;
    let loginCalled = false;
    let checkAuthCalled = false;

    try {
      (SogniClient as any).createInstance = async (config: any) => {
        createConfig = config;
        return {
          checkAuth: async () => {
            checkAuthCalled = true;
            return true;
          },
          account: {
            login: async () => {
              loginCalled = true;
            },
          },
          projects: {
            waitForModels: async () => {},
            on: () => {},
            off: () => {},
          },
          chat: {
            on: () => {},
            off: () => {},
          },
          apiClient: {
            socket: {
              disconnect: () => {},
            },
          },
        };
      };

      const client = new SogniClientWrapper({
        authType: 'apiKey',
        apiKey: 'test-api-key',
        autoConnect: false,
      });

      await client.connect();

      if (!createConfig) {
        throw new Error('createInstance was not called');
      }
      if (createConfig.authType !== 'apiKey' || createConfig.apiKey !== 'test-api-key') {
        throw new Error('apiKey auth config was not passed to SDK createInstance');
      }
      if (loginCalled) {
        throw new Error('account.login should not be called for apiKey auth');
      }
      if (checkAuthCalled) {
        throw new Error('checkAuth should not be called for apiKey auth');
      }

      await client.disconnect();
    } finally {
      (SogniClient as any).createInstance = originalCreateInstance;
    }
  })();

  // Test 57: Sogni tool helper exports
  await test('Should export Sogni tool helpers and definitions', () => {
    if (!SogniTools.generateImage || !SogniTools.generateVideo || !SogniTools.generateMusic) {
      throw new Error('Missing one or more built-in Sogni tool definitions');
    }

    const all = SogniTools.all;
    if (!Array.isArray(all) || all.length !== 24) {
      throw new Error(`SogniTools.all expected 24 tools, got ${all.length}`);
    }
  })();

  // Test 58: isSogniToolCall helper behavior
  await test('Should identify Sogni tool call names', () => {
    const sogniCall: ToolCall = {
      id: 'tc-1',
      type: 'function',
      function: { name: 'generate_image', arguments: '{}' },
    };
    const customCall: ToolCall = {
      id: 'tc-2',
      type: 'function',
      function: { name: 'get_weather', arguments: '{}' },
    };

    if (!isSogniToolCall(sogniCall)) {
      throw new Error('Expected generate_image to be identified as Sogni tool');
    }
    if (isSogniToolCall(customCall)) {
      throw new Error('Expected get_weather to not be identified as Sogni tool');
    }
  })();

  // Test 59: parseToolCallArguments helper behavior
  await test('Should parse tool call arguments safely', () => {
    const validCall: ToolCall = {
      id: 'tc-3',
      type: 'function',
      function: { name: 'add_numbers', arguments: '{"a":2,"b":3}' },
    };
    const invalidCall: ToolCall = {
      id: 'tc-4',
      type: 'function',
      function: { name: 'add_numbers', arguments: '{invalid json' },
    };

    const parsedValid = parseToolCallArguments(validCall);
    if (parsedValid.a !== 2 || parsedValid.b !== 3) {
      throw new Error('Failed to parse valid tool call JSON arguments');
    }

    const parsedInvalid = parseToolCallArguments(invalidCall);
    if (Object.keys(parsedInvalid).length !== 0) {
      throw new Error('Invalid JSON should return an empty object');
    }
  })();

  await test('Should compile numbered SCENES storyboard lists', () => {
    const brief = [
      'TASK: Generate a single tall portrait storyboard image with 3 cinematic frames.',
      'STYLE: bright commercial anime stills.',
      "TEXT: The only text in the image is the product's own label and the small corner number badges. No captions, subtitles, overlays, watermarks, or added logos.",
      '',
      'SCENES:',
      '1. ESTABLISHING - Golden-hour Singapore skyline with Marina Bay Sands and glowing clouds. No people. High-angle drone shot.',
      '2. DISCOVERY - Extreme macro of a lemon tea bottle half-buried in crushed ice, condensation and amber liquid glow. Top-down macro.',
      '3. HERO PRODUCT - Final clean hero shot of the bottle on a white surface with lemon slices and garden bokeh. Static slow push-in.',
      '',
      'CONSISTENCY: Identical product and palette in all panels.',
    ].join('\n');

    const project = buildStoryboardProject({
      prompt: brief,
      userIntentText: brief,
      frameCount: 3,
      promptAuthorship: 'user',
    });
    if (project.scenes.length !== 3) {
      throw new Error(`Expected 3 parsed scenes, got ${project.scenes.length}`);
    }
    if (project.scenes[0].title !== 'ESTABLISHING') {
      throw new Error(`Unexpected first scene title: ${project.scenes[0].title}`);
    }
    if (/\b1\.\s+ESTABLISHING\b/.test(project.scenes[0].visual)) {
      throw new Error(`Numbered-list marker leaked into first scene visual: ${project.scenes[0].visual}`);
    }

    const prompt = compileVideoStoryboardImagePrompt({
      prompt: brief,
      userIntentText: brief,
      frameCount: 3,
      promptAuthorship: 'user',
    });
    const audit = auditCompiledStoryboardImagePrompt({ prompt, expectedFrameCount: 3 });
    if (!audit.ok) {
      throw new Error(`Storyboard audit failed: ${audit.fatalIssues.map(issue => issue.code).join(', ')}`);
    }
    if (!prompt.includes('SCENE_01 - ESTABLISHING')) {
      throw new Error('Compiled prompt did not include SCENE_01 from numbered list');
    }
    if (/\bHigh-angle drone shot\.\s+1\.\s+ESTABLISHING\b/.test(prompt)) {
      throw new Error('Compiled prompt duplicated the first numbered scene line');
    }
    if (prompt.includes('Required exact visible text: "The only text in the image')) {
      throw new Error('Compiled prompt turned a text restriction into required visible text');
    }

    const assistantPrompt = [
      'Create one tall portrait storyboard sheet with ten numbered panels.',
      'Keep the user-provided product, tennis character, anime style, and no-extra-text rules.',
    ].join(' ');
    const assistantProject = buildStoryboardProject({
      prompt: assistantPrompt,
      userIntentText: brief,
      frameCount: 3,
      promptAuthorship: 'assistant',
    });
    if (assistantProject.scenes.length !== 3) {
      throw new Error(`Assistant-authored prompt dropped user scenes; got ${assistantProject.scenes.length}`);
    }
  })();

  await test('Should preserve user end-scene copy from assistant storyboard drafts', () => {
    const userIntent = [
      'Generate a fun 420p 10s video storyboard using this mascot image.',
      'The commercial should end on our Sogni logo and slogans.',
      'Let us construct this using 12 beats.',
      'End scene:',
      'Seedance 2.0 on Sogni.ai',
      'Create anything.',
      'Powered by the people.',
    ].join('\n');
    const assistantDraft = [
      '### Timecoded Storyboard Plan (12 Beats)',
      '| Beat | Time | Purpose | Visual / Action | Audio / Dialogue |',
      '| :--- | :--- | :--- | :--- | :--- |',
      '| **1** | 00:00 - 00:01 | Setup | Sloth at a boring desk. | SFX: office hum. |',
      '| **2** | 00:01 - 00:02 | Setup | Papers pile up. | SFX: paper rustle. |',
      '| **3** | 00:02 - 00:03 | Turn | Sloth looks to camera. | VO: "Ever since I was young" |',
      '| **4** | 00:03 - 00:04 | Action | Horn glows. | VO: "I have always wanted to" |',
      '| **5** | 00:04 - 00:05 | Action | Desk melts. | SFX: whoosh. |',
      '| **6** | 00:05 - 00:06 | Escalation | Art orbs appear. | VO: "convert unstructured data" |',
      '| **7** | 00:06 - 00:07 | Escalation | Psychedelic ribbons wrap the sloth. | SFX: synth swell. |',
      '| **8** | 00:07 - 00:08 | Climax | Fractals explode. | VO: "into actionable insight" |',
      '| **9** | 00:08 - 00:09 | Reveal | Sloth freezes happy in art. | SFX: record scratch. |',
      '| **10** | 00:09 - 00:10 | Reveal | Text slams on screen: "Syke!" | VO: "Syke! I wanted to make wild art." |',
      '| **11** | 00:10 - 00:12 | Payoff | Sloth winks near logo area. | VO: "Anything I can imagine." |',
      '| **12** | 00:12 - 00:15 | End Card | Sogni Logo appears with the tagline below it. | VO: "And it is finally here." |',
    ].join('\n');

    const project = buildStoryboardProject({
      prompt: assistantDraft,
      userIntentText: userIntent,
      approvedScriptContext: assistantDraft,
      frameCount: 12,
      promptAuthorship: 'assistant',
    });
    if (project.durationSec !== 10) {
      throw new Error(`Expected user duration 10s, got ${project.durationSec}`);
    }
    for (const text of ['Seedance 2.0 on Sogni.ai', 'Create anything.', 'Powered by the people.']) {
      if (!project.endCard.requiredText.includes(text)) {
        throw new Error(`Missing required end-card text: ${text}`);
      }
    }
    if (project.endCard.requiredText.includes('And it is finally here.')) {
      throw new Error('Spoken final VO was incorrectly promoted to required visible text');
    }
    const prompt = compileVideoStoryboardImagePrompt({
      prompt: assistantDraft,
      userIntentText: userIntent,
      approvedScriptContext: assistantDraft,
      frameCount: 12,
      promptAuthorship: 'assistant',
    });
    if (!prompt.includes('Target duration: 10 seconds.')) {
      throw new Error('Compiled prompt did not preserve the explicit 10s duration');
    }
    if (!prompt.includes('Required exact visible text: "Powered by the people."')) {
      throw new Error('Compiled prompt did not preserve final slogan text');
    }
  })();

  await test('Should classify Seedance provider timeouts explicitly', () => {
    const payload = seedanceTerminalGenerationFailurePayloadFromError(
      new Error('Seedance rejected the request: Vendor job failed: Vendor task cgt-20260518193419-5s2bv timed out after 600000ms'),
    );
    if (!payload) throw new Error('Expected Seedance generation failure payload');
    if (payload.message !== SEEDANCE_VENDOR_TIMEOUT_MESSAGE) {
      throw new Error(`Unexpected timeout message: ${payload.message}`);
    }
    if (payload.vendorErrorCode !== 'PROVIDER_TIMEOUT') {
      throw new Error(`Unexpected vendor error code: ${payload.vendorErrorCode}`);
    }
  })();

  // Test 60: validate LTX audio-driven video workflow fields
  await test('Should accept ia2v and a2v video workflow audio fields', () => {
    const ia2vConfig: VideoProjectConfig = {
      type: 'video',
      modelId: 'ltx2-13b-fp8_ia2v_distilled',
      positivePrompt: 'Lip synced cinematic close-up',
      numberOfMedia: 1,
      referenceImage: true,
      referenceAudio: true,
      audioStart: 1.5,
      audioDuration: 4,
      fps: 24,
      duration: 5,
    };

    const a2vConfig: VideoProjectConfig = {
      type: 'video',
      modelId: 'ltx23-22b-fp8_a2v_distilled',
      positivePrompt: 'Abstract reactive visuals matching the beat',
      numberOfMedia: 1,
      referenceAudio: true,
      audioStart: 0,
      audioDuration: 6,
      fps: 24,
      duration: 5,
    };

    validateProjectConfig(ia2vConfig);
    validateProjectConfig(a2vConfig);
  })();

  // Test 61: audio-driven LTX workflows should forward reference audio fields
  await test('Should forward ia2v and a2v referenceAudio params to SDK create', async () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    const capturedParams: any[] = [];
    const projectStub = {
      id: 'project-audio-driven-video',
      on: () => {},
      waitForCompletion: async () => [],
    };

    (client as any).client = {
      projects: {
        create: async (params: any) => {
          capturedParams.push(params);
          return projectStub;
        },
      },
    };
    (client as any).connectionState = {
      ...(client as any).connectionState,
      isConnected: true,
    };

    await client.createVideoProject({
      modelId: 'ltx2-13b-fp8_ia2v_distilled',
      positivePrompt: 'A person singing in sync with the audio',
      numberOfMedia: 1,
      referenceImage: true,
      referenceAudio: true,
      audioStart: 2,
      audioDuration: 5,
      fps: 24,
      duration: 5,
      waitForCompletion: false,
    });

    await client.createVideoProject({
      modelId: 'ltx23-22b-fp8_a2v_distilled',
      positivePrompt: 'Colorful motion graphics reacting to narration',
      numberOfMedia: 1,
      referenceAudio: true,
      audioStart: 0.5,
      audioDuration: 3,
      fps: 24,
      duration: 5,
      waitForCompletion: false,
    });

    if (capturedParams.length !== 2) {
      throw new Error(`Expected 2 SDK create calls, got ${capturedParams.length}`);
    }

    const [ia2vParams, a2vParams] = capturedParams;
    if (ia2vParams.referenceImage !== true || ia2vParams.referenceAudio !== true) {
      throw new Error('ia2v reference media was not forwarded to the SDK');
    }
    if (ia2vParams.audioStart !== 2 || ia2vParams.audioDuration !== 5) {
      throw new Error('ia2v audio timing fields were not forwarded to the SDK');
    }
    if (a2vParams.referenceAudio !== true) {
      throw new Error('a2v referenceAudio was not forwarded to the SDK');
    }
    if (a2vParams.audioStart !== 0.5 || a2vParams.audioDuration !== 3) {
      throw new Error('a2v audio timing fields were not forwarded to the SDK');
    }
    if (a2vParams.referenceImage !== undefined) {
      throw new Error('a2v should not inject a referenceImage');
    }
  })();

  // Test 71: Seedance estimateVideoCost defaults
  await test('Should apply Seedance estimateVideoCost defaults and fixed 24fps rules', async () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    let capturedEstimateParams: any = null;

    (client as any).client = {
      projects: {
        estimateVideoCost: async (params: any) => {
          capturedEstimateParams = params;
          return { token: '1', usd: '0.1', spark: '1', sogni: '1' };
        },
      },
    };
    (client as any).connectionState = {
      ...(client as any).connectionState,
      isConnected: true,
    };

    await client.estimateVideoCost({
      modelId: 'seedance-2-0_t2v',
      width: 1280,
      height: 720,
      duration: 5,
    });

    if (!capturedEstimateParams) {
      throw new Error('estimateVideoCost was not called for Seedance');
    }
    if (capturedEstimateParams.fps !== 24) {
      throw new Error(`Expected Seedance fps=24, got ${capturedEstimateParams.fps}`);
    }
    if (capturedEstimateParams.frames !== 121) {
      throw new Error(`Expected Seedance frames=121, got ${capturedEstimateParams.frames}`);
    }
    if (capturedEstimateParams.steps !== undefined) {
      throw new Error('Seedance steps should remain optional when omitted');
    }
  })();

  // Test 72: Creative workflow helpers and SSE parser
  await test('Should map creative workflow helper methods to SDK APIs', async () => {
    const client = new SogniClientWrapper({
      username: 'test-user',
      password: 'test-pass',
      autoConnect: false,
    });

    const calls: Array<{ method: string; args: any[] }> = [];
    const workflow = { workflowId: 'wf-1', status: 'queued' };
    const workflowEvents = [{ id: 'evt-1', event: 'workflow.updated' }];
    const streamedEvents = [
      {
        id: 'evt-2',
        event: 'workflow.updated',
        data: { status: 'running' },
        raw: 'id: evt-2\nevent: workflow.updated\ndata: {\"status\":\"running\"}',
      },
    ];

    (client as any).client = {
      workflows: {
        start: async (...args: any[]) => {
          calls.push({ method: 'start', args });
          return workflow;
        },
        list: async (...args: any[]) => {
          calls.push({ method: 'list', args });
          return [workflow];
        },
        get: async (...args: any[]) => {
          calls.push({ method: 'get', args });
          return workflow;
        },
        events: async (...args: any[]) => {
          calls.push({ method: 'events', args });
          return workflowEvents;
        },
        cancel: async (...args: any[]) => {
          calls.push({ method: 'cancel', args });
          return { ...workflow, status: 'cancelled' };
        },
        streamEvents: (...args: any[]) => {
          calls.push({ method: 'streamEvents', args });
          return (async function* () {
            yield streamedEvents[0];
          })();
        },
      },
    };
    (client as any).connectionState = {
      ...(client as any).connectionState,
      isConnected: true,
    };

    await client.startCreativeWorkflow({
      input: {
        title: 'Image to video',
        steps: [
          {
            toolName: 'generate_video',
            arguments: { prompt: 'Turn this into a short product video' },
          },
        ],
      },
      tokenType: 'spark',
    });
    await client.listCreativeWorkflows({ limit: 5 });
    await client.getCreativeWorkflow('wf-1');
    await client.getCreativeWorkflowEvents('wf-1');
    await client.cancelCreativeWorkflow('wf-1');

    const stream = await client.streamCreativeWorkflowEvents('wf-1', { after: 'evt-1' });
    const streamed = await stream.next();
    if (!streamed.value || streamed.value.id !== 'evt-2') {
      throw new Error('streamCreativeWorkflowEvents did not yield the expected SSE event');
    }

    const parsedEvents = parseCreativeWorkflowSseChunk(
      'id: evt-3\nevent: workflow.updated\ndata: {\"status\":\"completed\"}\n\n'
    );
    if (parsedEvents.length !== 1 || (parsedEvents[0].data as any)?.status !== 'completed') {
      throw new Error('parseCreativeWorkflowSseChunk did not parse SSE payload correctly');
    }

    const methodsSeen = calls.map((call) => call.method);
    const requiredMethods = [
      'start',
      'list',
      'get',
      'events',
      'cancel',
      'streamEvents',
    ];
    for (const method of requiredMethods) {
      if (!methodsSeen.includes(method)) {
        throw new Error(`Creative workflow helper did not call SDK method: ${method}`);
      }
    }
  })();

  // extractToolCallProgressUpdate — typed narrowing for the
  // `tool_call_progress.payload` shape the durable cloud chat emits.
  await test('extractToolCallProgressUpdate narrows overall progress + status', async () => {
    const { extractToolCallProgressUpdate } = await import('../src/chatRun/index.js');
    const update = extractToolCallProgressUpdate({
      toolCallId: 'call_1',
      progress: 0.5,
      status: 'processing',
    });
    if (update.toolCallId !== 'call_1') throw new Error('toolCallId not extracted');
    if (update.progress !== 0.5) throw new Error('progress not extracted');
    if (update.status !== 'processing') throw new Error('status not extracted');
    if (update.jobIndex !== undefined) throw new Error('jobIndex should be absent');
  })();

  await test('extractToolCallProgressUpdate narrows per-job fields (progress/ETA/result)', async () => {
    const { extractToolCallProgressUpdate } = await import('../src/chatRun/index.js');
    const update = extractToolCallProgressUpdate({
      toolCallId: 'call_2',
      jobIndex: 3,
      jobProgress: 0.75,
      jobEtaSeconds: 12,
      resultUrl: 'https://cdn.sogni.ai/foo.mp4',
      isVideoResult: true,
    });
    if (update.jobIndex !== 3) throw new Error('jobIndex not extracted');
    if (update.jobProgress !== 0.75) throw new Error('jobProgress not extracted');
    if (update.jobEtaSeconds !== 12) throw new Error('jobEtaSeconds not extracted');
    if (update.resultUrl !== 'https://cdn.sogni.ai/foo.mp4') throw new Error('resultUrl not extracted');
    if (update.isVideoResult !== true) throw new Error('isVideoResult not extracted');
    if (update.progress !== undefined) throw new Error('progress should be absent on per-job tick');
  })();

  await test('extractToolCallProgressUpdate drops invalid fields without throwing', async () => {
    const { extractToolCallProgressUpdate } = await import('../src/chatRun/index.js');
    const update = extractToolCallProgressUpdate({
      toolCallId: 42,                // wrong type
      progress: Number.NaN,          // not finite
      jobEtaSeconds: 'soon',         // wrong type
      jobError: '',                  // empty string filtered out
      mediaUrls: [{ url: 'https://x' }],
    });
    if (update.toolCallId !== undefined) throw new Error('toolCallId should be dropped');
    if (update.progress !== undefined) throw new Error('NaN progress should be dropped');
    if (update.jobEtaSeconds !== undefined) throw new Error('non-numeric ETA should be dropped');
    if (update.jobError !== undefined) throw new Error('empty error string should be dropped');
    if (!Array.isArray(update.mediaUrls)) throw new Error('mediaUrls array should pass through');
  })();

  await test('extractToolCallProgressUpdate returns empty object for undefined payload', async () => {
    const { extractToolCallProgressUpdate } = await import('../src/chatRun/index.js');
    const update = extractToolCallProgressUpdate(undefined);
    if (Object.keys(update).length !== 0) throw new Error('expected empty object');
  })();

  // -------------------------------------------------------------------------
  // Commit 1: canonical agent/billing/events contract alignment regression
  // -------------------------------------------------------------------------

  await test('IntentInput accepts schema-aligned currentMessage/activeState/artifactState shape', async () => {
    const { isIntentInput } = await import('../src/agent/index.js');
    const packet = {
      currentMessage: 'Make a 5s clip from this image',
      activeState: {
        activeArtifactId: 'art_abcdef1234567890abcdef1234567890',
        activeArtifactType: 'image' as const,
        lastToolResult: {
          toolName: 'generate_image',
          toolCallId: 'call_1',
          status: 'ok',
        },
      },
      artifactState: {
        selectedArtifactIds: ['art_abcdef1234567890abcdef1234567890'],
        artifactIds: ['art_abcdef1234567890abcdef1234567890'],
        lastGeneratedArtifactId: 'art_abcdef1234567890abcdef1234567890',
      },
      recentTurns: [
        { role: 'user' as const, content: 'hi', sequence: 0 },
        { role: 'assistant' as const, content: 'hello', sequence: 1 },
      ],
      conversationSummary: '',
      availableCapabilitiesSummary: ['generate_image', 'generate_video'],
    };
    if (!isIntentInput(packet)) {
      throw new Error('Schema-aligned IntentInput packet rejected by isIntentInput');
    }
  })();

  await test('IntentInput rejects the legacy v0 shape via the canonical type guard', async () => {
    const { isIntentInput } = await import('../src/agent/index.js');
    const legacyPacket = {
      userText: 'still legacy',
      recentTurns: [],
      active: { pendingActions: [], recentToolResults: [] },
      artifacts: { artifactIds: [] },
    };
    if (isIntentInput(legacyPacket)) {
      throw new Error('Legacy IntentInput shape should not validate against the canonical guard');
    }
  })();

  await test('LegacyIntentInputV0 type still type-checks (one-release deprecation)', async () => {
    const mod = await import('../src/agent/index.js');
    // Compile-time check: alias is exported. Runtime no-op.
    const legacy: import('../src/agent/index.js').LegacyIntentInputV0 = {
      userText: 'legacy',
      recentTurns: [],
      active: { pendingActions: [], recentToolResults: [] },
      artifacts: { artifactIds: [] },
    };
    if (!mod || !legacy) throw new Error('LegacyIntentInputV0 import missing');
  })();

  await test('SpendGate accepts the canonical schema-aligned shape', async () => {
    const { isSpendGate, isSpendGateEstimate } = await import('../src/billing/index.js');
    const gate = {
      gateId: 'gate_abc123',
      scope: 'tool_call' as const,
      runId: 'run_xyz',
      state: 'waiting_for_user' as const,
      reason: 'Approve 12 sparks for generate_video',
      estimate: {
        capacityUnits: 12,
        breakdown: [{ model: 'seedance-2-0', units: 12, tokenType: 'spark' as const }],
        tokenType: 'spark' as const,
        maxAcceptableUnits: 20,
      },
      pendingToolCalls: [{ toolCallId: 'call_1', toolName: 'generate_video' }],
      createdAt: '2026-05-20T00:00:00.000Z',
      updatedAt: '2026-05-20T00:00:01.000Z',
    };
    if (!isSpendGateEstimate(gate.estimate)) {
      throw new Error('Canonical SpendGate estimate rejected');
    }
    if (!isSpendGate(gate)) {
      throw new Error('Canonical SpendGate rejected');
    }
  })();

  await test('SpendGate still accepts legacy minimal {state, request?} shape', async () => {
    const { isSpendGate } = await import('../src/billing/index.js');
    const legacy = {
      state: 'preview_required' as const,
      request: {
        scope: 'tool_call' as const,
        toolCallId: 'call_legacy',
        estimateCapacityUnits: 5,
        estimateCostBreakdown: [{ model: 'flux-1-schnell', units: 5, tokenType: 'spark' as const }],
      },
    };
    if (!isSpendGate(legacy)) {
      throw new Error('Legacy SpendGate {state, request} payload rejected');
    }
  })();

  await test('SpendGate rejects unknown decision values', async () => {
    const { isSpendGateDecision } = await import('../src/billing/index.js');
    if (!isSpendGateDecision('confirm')) throw new Error('confirm should be a valid decision');
    if (!isSpendGateDecision('cancel')) throw new Error('cancel should be a valid decision');
    if (isSpendGateDecision('approved')) throw new Error('approved is not a canonical decision');
  })();

  await test('RunEvent superset includes spend_gate_opened and workflow stage events', async () => {
    const { isRunEventType } = await import('../src/events/index.js');
    for (const t of [
      'spend_gate_opened',
      'stage_started',
      'stage_completed',
      'stage_failed',
      'stage_waiting_for_user',
    ]) {
      if (!isRunEventType(t)) throw new Error(`Superset missing event type: ${t}`);
    }
  })();

  await test('RunEvent carries optional runKind discriminator (chat | workflow | tool_batch)', async () => {
    const { isRunEvent, isRunKind } = await import('../src/events/index.js');
    for (const k of ['chat', 'workflow', 'tool_batch']) {
      if (!isRunKind(k)) throw new Error(`Run kind ${k} not recognized`);
    }
    const chatEvent = {
      runId: 'run_1',
      runKind: 'chat' as const,
      sequence: 0,
      type: 'spend_gate_opened' as const,
      payload: { gateId: 'gate_1' },
      createdAt: '2026-05-20T00:00:00.000Z',
    };
    if (!isRunEvent(chatEvent)) throw new Error('Canonical RunEvent with runKind rejected');
    const legacyEvent = {
      runId: 'run_2',
      sequence: 1,
      type: 'tool_call_progress' as const,
      payload: {},
      createdAt: '2026-05-20T00:00:01.000Z',
    };
    if (!isRunEvent(legacyEvent)) throw new Error('Legacy RunEvent without runKind rejected');
  })();

  await test('stage_waiting_for_user is treated as a resumable event type', async () => {
    const { isResumableEventType } = await import('../src/events/index.js');
    if (!isResumableEventType('stage_waiting_for_user')) {
      throw new Error('stage_waiting_for_user must be resumable');
    }
    if (!isResumableEventType('run_waiting_for_user')) {
      throw new Error('run_waiting_for_user must be resumable');
    }
  })();

  // -------------------------------------------------------------------------
  // Commit 2: TurnPlan + ToolMetadata canonical-type regressions
  // -------------------------------------------------------------------------

  await test('TurnPlan accepts a minimal valid plan with empty tools', async () => {
    const { isTurnPlan } = await import('../src/agent/index.js');
    const plan = {
      proposedTools: [],
      resolvedReferences: [],
      confidence: 0,
    };
    if (!isTurnPlan(plan)) throw new Error('Minimal TurnPlan rejected by isTurnPlan');
  })();

  await test('TurnPlan accepts a rich plan with workflow + spend estimate + clarification', async () => {
    const { isTurnPlan, isPlannerSpendEstimate, isPlannerProposedWorkflow } = await import(
      '../src/agent/index.js'
    );
    const plan = {
      proposedTools: ['generate_video'],
      proposedWorkflow: {
        templateId: 'wf_storyboard_to_video',
        inputs: { duration: 5 },
        reason: 'multi-stage with stitch',
      },
      resolvedReferences: [
        { artifactId: 'art_xyz123', artifactType: 'image' as const },
      ],
      needsClarification: { question: 'Vertical or square?' },
      spendEstimate: {
        tokenCost: 12,
        usdCost: 0.08,
        estimateAvailable: true,
        preferredModel: 'seedance-2-0',
      },
      confidence: 0.7,
    };
    if (!isPlannerProposedWorkflow(plan.proposedWorkflow)) {
      throw new Error('Workflow guard rejected its own canonical shape');
    }
    if (!isPlannerSpendEstimate(plan.spendEstimate)) {
      throw new Error('SpendEstimate guard rejected its own canonical shape');
    }
    if (!isTurnPlan(plan)) throw new Error('Rich TurnPlan rejected by isTurnPlan');
  })();

  await test('TurnPlan rejects confidence out of [0, 1]', async () => {
    const { isTurnPlan } = await import('../src/agent/index.js');
    if (
      isTurnPlan({
        proposedTools: [],
        resolvedReferences: [],
        confidence: 1.5,
      })
    ) {
      throw new Error('confidence > 1 should be rejected');
    }
    if (
      isTurnPlan({
        proposedTools: [],
        resolvedReferences: [],
        confidence: -0.1,
      })
    ) {
      throw new Error('confidence < 0 should be rejected');
    }
  })();

  await test('PlannerSpendEstimate tolerates null cost fields when estimateAvailable=false', async () => {
    const { isPlannerSpendEstimate } = await import('../src/agent/index.js');
    if (
      !isPlannerSpendEstimate({
        tokenCost: null,
        usdCost: null,
        estimateAvailable: false,
      })
    ) {
      throw new Error('Null cost fields should be accepted when estimateAvailable=false');
    }
  })();

  await test('ToolMetadata accepts a fully populated record matching the JSON schema', async () => {
    const { isToolMetadata } = await import('../src/agent/index.js');
    const meta = {
      name: 'generate_image',
      family: 'creative' as const,
      executionMode: 'hosted' as const,
      inputSchemaRef: 'schemas/tools/generate_image.schema.json',
      outputSchemaRef: 'schemas/tools/generate_image.result.schema.json',
      costClass: 'medium' as const,
      latencyClass: 'interactive' as const,
      mutatesData: false,
      producesArtifacts: true,
      requiresConfirmation: 'paid' as const,
      retrySafety: 'dedupe_key_required' as const,
    };
    if (!isToolMetadata(meta)) throw new Error('Canonical ToolMetadata rejected');
  })();

  await test('ToolMetadata accepts hiddenFromModel flag on hidden L1 tools', async () => {
    const { isToolMetadata } = await import('../src/agent/index.js');
    const meta = {
      name: 'resolve_personas',
      family: 'analysis' as const,
      executionMode: 'internal' as const,
      inputSchemaRef: 'schemas/tools/resolve_personas.schema.json',
      outputSchemaRef: 'schemas/tools/resolve_personas.result.schema.json',
      costClass: 'free' as const,
      latencyClass: 'inline' as const,
      mutatesData: false,
      producesArtifacts: false,
      requiresConfirmation: 'never' as const,
      retrySafety: 'idempotent' as const,
      hiddenFromModel: true,
    };
    if (!isToolMetadata(meta)) throw new Error('Hidden-from-model ToolMetadata rejected');
  })();

  await test('ToolMetadata rejects unknown enum values', async () => {
    const { isToolMetadata } = await import('../src/agent/index.js');
    if (
      isToolMetadata({
        name: 'bad_tool',
        family: 'nonsense',
        executionMode: 'hosted',
        inputSchemaRef: 'schemas/x.schema.json',
        outputSchemaRef: 'schemas/x.schema.json',
        costClass: 'medium',
        latencyClass: 'inline',
        mutatesData: false,
        producesArtifacts: false,
        requiresConfirmation: 'never',
        retrySafety: 'idempotent',
      })
    ) {
      throw new Error('Unknown family value should be rejected');
    }
  })();

  // Tools/shared helper unit tests
  const sharedResults = runToolsSharedTests();
  testsPassed += sharedResults.passed;
  testsFailed += sharedResults.failed;

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Tests passed: ${testsPassed}`);
  console.log(`❌ Tests failed: ${testsFailed}`);
  console.log(`📊 Total tests: ${testsPassed + testsFailed}`);
  console.log('='.repeat(50));

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
