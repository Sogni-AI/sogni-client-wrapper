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
} from '../src';
import { SogniClient } from '@sogni-ai/sogni-client';

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

  // Test 51: estimateAudioCost call mapping
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

  // Test 52: createAudioProject returns audio URLs
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

    const chatResult = await client.createChatCompletion({
      model: 'qwen3-30b-a3b-gptq-int4',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    if (!capturedCompletionParams || capturedCompletionParams.model !== 'qwen3-30b-a3b-gptq-int4') {
      throw new Error('createChatCompletion params were not mapped correctly');
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
