# Sogni Client Wrapper

[![NPM version](https://img.shields.io/npm/v/@sogni-ai/sogni-client-wrapper.svg)](https://www.npmjs.com/package/@sogni-ai/sogni-client-wrapper) [![License](https://img.shields.io/npm/l/@sogni-ai/sogni-client-wrapper.svg)](https://www.npmjs.com/package/@sogni-ai/sogni-client-wrapper)

An enhanced Node.js wrapper for the [`@sogni-ai/sogni-client`](https://sdk-docs.sogni.ai/) library, designed for robustness, ease of use, and seamless integration with platforms like [n8n](https://n8n.io/).

This library simplifies interaction with the Sogni AI Supernet by providing a promise-based API, automatic connection management, enhanced error handling, and a more developer-friendly interface.

## Features

- **Promise-Based API**: Modern `async/await` support for all core operations.
- **Connection Management**: Automatic connection and reconnection handling.
- **Video Rendering Support**: Generate videos using WAN and LTX-2 models (t2v, i2v, s2v, ia2v, a2v, v2v, animate workflows).
- **Audio Generation Support**: Generate music/audio tracks with audio models and estimate audio costs.
- **Image Editing Support**: Edit images using Qwen models with context images for multi-reference editing.
- **LLM Chat Support**: Use chat completions through Sogni's LLM worker network (streaming and non-streaming).
- **Flexible Authentication**: Token, cookies, or API key authentication.
- **Simplified Configuration**: Sensible defaults and clear configuration options.
- **Enhanced Error Handling**: Custom error classes for better error diagnosis.
- **Type-Safe**: Written entirely in TypeScript with full type definitions.
- **n8n-Ready**: Built with n8n integration in mind, managing connection lifecycles effectively.
- **Utility Helpers**: Includes helpers for validation, retries, and formatting.

## Installation

```bash
npm install @sogni-ai/sogni-client-wrapper
```

Or with Yarn:

```bash
yarn add @sogni-ai/sogni-client-wrapper
```

## Quick Start

### 1. Setup Environment Variables

First, create a `.env` file in your project root to securely store your credentials:

```bash
# Copy the example file
cp node_modules/@sogni-ai/sogni-client-wrapper/.env.example .env
```

### 2. Install Dependencies

```bash
npm install dotenv
```

### 3. Create Your Script

```typescript
import { config } from 'dotenv';
import { SogniClientWrapper } from '@sogni-ai/sogni-client-wrapper';

// Load environment variables from .env file
config();

async function main() {
  // 1. Create and connect the client with credentials from .env
  const client = new SogniClientWrapper({
    username: process.env.SOGNI_USERNAME!,
    password: process.env.SOGNI_PASSWORD!,
  });

  try {
    // The client connects automatically on the first operation
    console.log('Client connected!');

    // 2. Find the most popular model
    const model = await client.getMostPopularModel();
    console.log(`Using model: ${model.id} (${model.workerCount} workers)`);

    // 3. Generate an image
    console.log('Generating image...');
    const result = await client.createProject({
      type: 'image',
      modelId: model.id,
      positivePrompt: 'A photorealistic portrait of a majestic lion in the savanna at sunset',
      negativePrompt: 'blurry, cartoon, low quality',
      stylePrompt: 'cinematic',
      numberOfMedia: 1,
      steps: 30,
      guidance: 8,
    });

    if (result.completed && result.imageUrls) {
      console.log('Image generation successful!');
      console.log('Image URLs:', result.imageUrls);
    } else {
      console.error('Image generation did not complete.');
    }

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // 4. Disconnect the client
    await client.disconnect();
    console.log('Client disconnected.');
  }
}

main();
```

### 4. Run the Script

```bash
# If using TypeScript
npx tsx your-script.ts

# If using compiled JavaScript
node your-script.js
```

## Video Rendering Support

The wrapper supports video generation with Sogni WAN and LTX-2 models. Generate videos from text prompts, images, audio, or other videos.

### Video Generation Example

```typescript
// Text-to-Video (t2v) using speed variant for reliability
const videoResult = await client.createVideoProject({
  modelId: 'wan_v2.2-14b-fp8_t2v_lightx2v', // Speed variant (4 steps)
  positivePrompt: 'A serene waterfall flowing through a lush green forest',
  numberOfMedia: 1,
  frames: 81,        // Generate 81 frames (5 seconds at 16fps)
  fps: 16,          // 16 frames per second
  width: 640,       // 640x640 resolution
  height: 640,
  steps: 4,         // Optimized for speed variant
  outputFormat: 'mp4',
  waitForCompletion: true,
  timeout: 300000,  // 5 minute timeout for video generation
});

console.log('Video URLs:', videoResult.videoUrls);
```

### Video Cost Estimate

```typescript
const estimate = await client.estimateVideoCost({
  modelId: 'wan_v2.2-14b-fp8_i2v_lightx2v',
  width: 512,
  height: 512,
  frames: 81,
  fps: 16,
  steps: 4,
  tokenType: 'spark',
});

console.log('Estimated USD cost:', estimate.usd);
```

### Video Workflows

The wrapper supports multiple video generation workflows:

1. **Text-to-Video (t2v)**: Generate videos from text prompts
2. **Image-to-Video (i2v)**: Animate static images or interpolate between two images
3. **Sound-to-Video (s2v / ia2v / a2v)**: Drive generation with audio references
4. **Video-to-Video (v2v)**: Control motion/style from a reference video
5. **Animate Workflows**: Create character animations or motion transfers

### Advanced Video Examples

```typescript
// Image-to-Video with interpolation
const i2vResult = await client.createVideoProject({
  modelId: 'wan_v2.2-14b-fp8_i2v_lightx2v',
  positivePrompt: 'Smooth camera movement',
  referenceImage: startImageBuffer,     // Starting image
  referenceImageEnd: endImageBuffer,    // Optional: end image for interpolation
  width: 512,
  height: 512,
  frames: 81,
  fps: 16,
  steps: 4,
  autoResizeVideoAssets: true,          // Auto-resize reference images (default: true)
});

// Animate with motion transfer
const animateResult = await client.createVideoProject({
  modelId: 'wan_v2.2-14b-fp8_animate',
  positivePrompt: 'Character animation',
  referenceImage: characterImage,     // Character to animate
  referenceVideo: motionVideo,        // Video with motion to transfer
  frames: 90,
  fps: 30,
});
```

### Convenience Methods

For cleaner code, use the dedicated convenience methods:

```typescript
// For images
const imageResult = await client.createImageProject({
  modelId: 'flux1-schnell-fp8',
  positivePrompt: 'A beautiful sunset',
  numberOfMedia: 1,
});

// For videos
const videoResult = await client.createVideoProject({
  modelId: 'wan_v2.2-14b-fp8_t2v',
  positivePrompt: 'Ocean waves crashing on a beach',
  numberOfMedia: 1,
  frames: 60,
  fps: 30,
});

// For audio
const audioResult = await client.createAudioProject({
  modelId: 'ace-step-v1',
  positivePrompt: 'An uplifting cinematic ambient track',
  numberOfMedia: 1,
  duration: 30,
  steps: 20,
  outputFormat: 'mp3',
});
```

## Audio Generation

```typescript
const audioEstimate = await client.estimateAudioCost({
  modelId: 'ace-step-v1',
  duration: 30,
  steps: 20,
  numberOfMedia: 1,
  tokenType: 'spark',
});

console.log('Estimated audio cost (USD):', audioEstimate.usd);
```

## Chat Completions

```typescript
// Non-streaming
const completion = await client.createChatCompletion({
  model: 'qwen3-30b-a3b-gptq-int4',
  messages: [{ role: 'user', content: 'Write a haiku about sunsets.' }],
});
console.log(completion.content);

// Streaming
const stream = await client.createChatCompletion({
  model: 'qwen3-30b-a3b-gptq-int4',
  messages: [{ role: 'user', content: 'Explain diffusion models simply.' }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

## Image Editing with Context Images

The wrapper supports image editing using Qwen models that accept context images for multi-reference editing. This allows you to transform, combine, or edit images based on reference inputs.

### Supported Models

| Model ID | Type | Recommended Steps | Max Context Images |
|----------|------|-------------------|-------------------|
| `qwen_image_edit_2511_fp8` | Standard | 20 | 3 |
| `qwen_image_edit_2511_fp8_lightning` | Fast | 4 | 3 |

### Image Edit Example

```typescript
import { readFileSync } from 'fs';

// Load your reference image(s)
const referenceImage = readFileSync('./my-image.png');

// Create an image edit project
const result = await client.createImageEditProject({
  modelId: 'qwen_image_edit_2511_fp8',
  positivePrompt: 'Transform the cat into a majestic lion',
  contextImages: [referenceImage],
  numberOfMedia: 1,
  steps: 20,
  guidance: 4.0,
});

console.log('Edited image URLs:', result.imageUrls);
```

### Using Multiple Context Images

Qwen models support up to 3 context images for complex editing operations:

```typescript
const image1 = readFileSync('./subject.png');
const image2 = readFileSync('./style-reference.png');
const image3 = readFileSync('./background.png');

const result = await client.createImageEditProject({
  modelId: 'qwen_image_edit_2511_fp8_lightning', // Fast variant
  positivePrompt: 'Combine the subject with the style and background',
  contextImages: [image1, image2, image3],
  numberOfMedia: 1,
  steps: 4,  // Optimized for lightning variant
  guidance: 1.0,
});
```

### Multiple Angles LoRA (Qwen Image Edit)

```typescript
import { readFileSync } from 'fs';

const referenceImage = readFileSync('./subject.png');

const result = await client.createImageEditProject({
  modelId: 'qwen_image_edit_2511_fp8_lightning',
  positivePrompt: '<sks> front view eye-level shot medium shot',
  contextImages: [referenceImage],
  numberOfMedia: 1,
  steps: 4,
  guidance: 1.0,
  sampler: 'euler',
  scheduler: 'simple',
  outputFormat: 'jpg',
  loras: ['multiple_angles'],
  loraStrengths: [0.9],
});

console.log('Generated images:', result.imageUrls);
```

### Context Image Types

The `contextImages` parameter accepts an array of `InputMedia` types:

- `Buffer` - Node.js Buffer containing image data
- `Blob` - Browser Blob object
- `File` - Browser File object
- `true` - Boolean indicating a pre-uploaded image

### Helper Functions

The wrapper provides helper functions for working with context images:

```typescript
import { getMaxContextImages, supportsContextImages } from '@sogni-ai/sogni-client-wrapper';

// Check if a model supports context images
if (supportsContextImages('qwen_image_edit_2511_fp8')) {
  console.log('Model supports context images!');
}

// Get the maximum number of context images for a model
const maxImages = getMaxContextImages('qwen_image_edit_2511_fp8'); // Returns 3

// Other models have different limits:
getMaxContextImages('flux-1-schnell');  // Returns 6
getMaxContextImages('kontext-model');   // Returns 2
getMaxContextImages('sd-xl-base');      // Returns 0 (not supported)
```

## API Reference

### `new SogniClientWrapper(config)`

Creates a new client instance.

**Configuration (`SogniClientConfig`)**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `authType` | `'token' \| 'cookies' \| 'apiKey'` | `'token'` | Authentication mode. |
| `username` | `string` | Conditionally required | Required for `token` auth; optional for `cookies`/`apiKey`. |
| `password` | `string` | Conditionally required | Required for `token` auth; optional for `cookies`/`apiKey`. |
| `apiKey` | `string` | Conditionally required | Required for `apiKey` auth. |
| `appId` | `string` | Auto-generated UUID | Unique ID for your application. |
| `network` | `'fast' \| 'relaxed'` | `'fast'` | The Sogni network to use. |
| `testnet` | `boolean` | `false` | Connect to the testnet network. |
| `socketEndpoint` | `string` | `undefined` | Override the default WebSocket API endpoint. |
| `restEndpoint` | `string` | `undefined` | Override the default REST API endpoint. |
| `disableSocket` | `boolean` | `false` | Disable WebSocket connection (advanced/testing). |
| `allowInsecureTLS` | `boolean` | `false` | Allow insecure TLS (useful for testnet with self-signed certs). |
| `autoConnect` | `boolean` | `true` | Connect automatically on the first operation. |
| `reconnect` | `boolean` | `true` | Attempt to reconnect if the connection is lost. |
| `reconnectInterval` | `number` | `5000` | Time in ms between reconnect attempts. |
| `timeout` | `number` | `300000` | Default timeout in ms for operations. |
| `debug` | `boolean` | `false` | Enable detailed console logging. |

#### API Key Authentication Example

```typescript
const client = new SogniClientWrapper({
  authType: 'apiKey',
  apiKey: process.env.SOGNI_API_KEY!,
  network: 'fast',
});
```

### Core Methods

- `connect(): Promise<void>`: Manually initiates the connection to Sogni.
- `disconnect(): Promise<void>`: Disconnects the client.
- `isConnected(): boolean`: Checks if the client is currently connected.
- `getConnectionState(): ConnectionState`: Returns the current connection status.

### Main Operations

- `createProject(config: ProjectConfig): Promise<ProjectResult>`: Creates a new image, video, or audio generation project.
  - `waitForCompletion` (default: `true`): If true, the promise resolves only when the media is ready.
  - For images: returns `imageUrls` in result
  - For videos: returns `videoUrls` in result
  - For audio: returns `audioUrls` in result
- `createImageProject(config)`: Convenience method for image generation (automatically sets `type: 'image'`).
- `createVideoProject(config)`: Convenience method for video generation (automatically sets `type: 'video'`).
- `createAudioProject(config)`: Convenience method for audio generation (automatically sets `type: 'audio'`).
- `createImageEditProject(config: QwenImageEditConfig)`: Convenience method for image editing with context images (validates model-specific limits).
- `getAvailableModels(options?: GetModelsOptions): Promise<ModelInfo[]>`: Retrieves a list of available models.
- `getModel(modelId: string): Promise<ModelInfo>`: Retrieves details for a specific model.
- `getMostPopularModel(): Promise<ModelInfo>`: A helper to get the model with the most active workers.
- `getBalance(): Promise<BalanceInfo>`: Fetches your current SOGNI and Spark token balances using the `account.refreshBalance()` method.
- `getSizePresets(network: 'fast' \| 'relaxed', modelId: string): Promise<SizePreset[]>`: Gets available output size presets for a model.
- `estimateVideoCost(params: VideoCostEstimateParams): Promise<CostEstimate>`: Estimates video generation costs (frames/duration, fps, steps, size).
- `estimateAudioCost(params: AudioCostEstimateParams): Promise<CostEstimate>`: Estimates audio generation costs (duration, steps, count).
- `createChatCompletion(params)`: Creates chat completions (streaming or non-streaming).
- `estimateChatCost(params)`: Estimates chat completion cost.
- `getAvailableChatModels()`: Returns available chat/LLM models.
- `waitForChatModels(timeout?)`: Waits until chat/LLM models are available.

### Event Handling

The wrapper is an `EventEmitter` and provides type-safe events.

```typescript
import { ClientEvent } from '@sogni-ai/sogni-client-wrapper';

client.on(ClientEvent.CONNECTED, () => {
  console.log('Client is connected!');
});

client.on(ClientEvent.PROJECT_PROGRESS, (progress) => {
  console.log(`Project ${progress.projectId} is ${progress.percentage}% complete.`);
  if (progress.estimatedTimeRemaining) {
    console.log(`ETA: ${Math.round(progress.estimatedTimeRemaining / 1000)}s`);
  }
});

client.on(ClientEvent.ERROR, (error) => {
  console.error('A client error occurred:', error.message);
});

// Per-media events - Display outputs as soon as they're ready!
client.on(ClientEvent.JOB_COMPLETED, (data) => {
  console.log(`Job ${data.jobIndex + 1}/${data.totalJobs} completed!`);
  console.log(`URL: ${data.imageUrl || data.videoUrl || data.audioUrl}`);
  // You can now handle this individual output without waiting for the entire batch
});

client.on(ClientEvent.JOB_FAILED, (data) => {
  console.log(`Job ${data.jobIndex + 1}/${data.totalJobs} failed:`, data.error);
});
```

#### Available Events

| Event | Payload | Description |
|---|---|---|
| `connected` | `void` | Fired when the client successfully connects. |
| `disconnected` | `void` | Fired when the client disconnects. |
| `reconnecting` | `number` | Fired when a reconnection attempt starts. Payload is the attempt number. |
| `error` | `ErrorData` | Fired when a client or connection error occurs. |
| `projectProgress` | `ProjectProgress` | Fired with real-time progress updates for a project. |
| `projectCompleted` | `ProjectResult` | Fired when a project successfully completes. |
| `projectFailed` | `ErrorData` | Fired when a project fails. |
| **`jobCompleted`** | **`JobCompletedData`** | **Fired when an individual job finishes (image/video/audio).** |
| **`jobFailed`** | **`JobFailedData`** | **Fired when an individual job fails.** |
| `projectEvent` | `ProjectEvent` | Raw project events from the SDK (`queued`, `completed`, `error`). |
| `jobEvent` | `JobEvent` | Raw job events from the SDK (includes `jobETA`, `started`, `progress`, etc). |
| `chatToken` | `ChatCompletionChunk` | Fired for each streaming chat token chunk. |
| `chatCompleted` | `ChatCompletionResult` | Fired when a chat completion finishes. |
| `chatError` | `ChatErrorData` | Fired when a chat completion fails. |
| `chatJobState` | `ChatJobStateEvent` | Fired on chat job state transitions. |
| `chatModelsUpdated` | `Record<string, LLMModelInfo>` | Fired when available chat models are updated. |

#### Per-Job Event Example

Perfect for displaying batch outputs immediately as they complete:

```typescript
const client = new SogniClientWrapper({
  username: process.env.SOGNI_USERNAME!,
  password: process.env.SOGNI_PASSWORD!,
});

// Listen for individual image completions
client.on(ClientEvent.JOB_COMPLETED, (data) => {
  console.log(`✓ Image ${data.jobIndex + 1} of ${data.totalJobs} ready!`);
  console.log(`  URL: ${data.imageUrl}`);
  // Display the image in your UI immediately
  displayImage(data.imageUrl);
});

// Generate a batch of images
const result = await client.createProject({
  type: 'image',
  modelId: 'flux1-schnell-fp8',
  positivePrompt: 'A beautiful landscape',
  numberOfMedia: 4, // Generate 4 images
  steps: 4,
  guidance: 3.5,
});

// All 4 images will be displayed as they complete, not all at once!
```

## Error Handling

The library throws custom errors that extend `SogniError`. This allows you to catch specific types of errors.

- `SogniConnectionError`: Issues with connecting to the WebSocket server.
- `SogniAuthenticationError`: Invalid credentials (username/password, cookie session, or API key).
- `SogniProjectError`: The image generation project failed.
- `SogniTimeoutError`: An operation took longer than the configured timeout.
- `SogniValidationError`: Invalid configuration or parameters.
- `SogniBalanceError`: Insufficient token balance.

```typescript
import { SogniAuthenticationError, SogniProjectError } from '@sogni-ai/sogni-client-wrapper';

try {
  // ... your code
} catch (error) {
  if (error instanceof SogniAuthenticationError) {
    console.error('Please check your credentials.');
  } else if (error instanceof SogniProjectError) {
    console.error('The image generation failed. Please try a different prompt or model.');
  } else {
    console.error('An unknown error occurred:', error);
  }
}
```

## Testing

The library includes both basic unit tests and end-to-end tests.

### Running Tests

```bash
# Run basic unit tests (no credentials required)
npm test

# Run end-to-end tests (requires Sogni API credentials)
npm run test:e2e

# Run all tests
npm run test:all
```

### Setting Up End-to-End Tests

To run the end-to-end tests, you need to provide your Sogni API credentials via environment variables:

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Sogni credentials:
   ```env
   SOGNI_USERNAME=your_sogni_username
   SOGNI_PASSWORD=your_sogni_password
   # Optional: force a specific chat/LLM model for e2e tests
   # SOGNI_LLM_MODEL=qwen3-30b-a3b-gptq-int4
   # Optional: fail suite if LLM tests cannot run (default: skip LLM tests if unavailable)
   # SOGNI_REQUIRE_LLM_E2E=true
   ```

3. Run the e2e tests:
   ```bash
   npm run test:e2e
   ```

**Note:** The e2e tests make real API calls and may consume tokens from your Sogni account. They include image/video generation and live LLM chat calls.

## TypeScript

This library is written in TypeScript and exports all necessary types for a fully-typed experience.

- `SogniClientConfig`: Configuration for the client constructor.
- `ProjectConfig`: Parameters for creating a project (union of `ImageProjectConfig`, `VideoProjectConfig`, and `AudioProjectConfig`).
- `ImageProjectConfig`: Parameters specific to image generation.
- `VideoProjectConfig`: Parameters specific to video generation.
- `AudioProjectConfig`: Parameters specific to audio generation.
- `QwenImageEditConfig`: Parameters for image editing with context images.
- `InputMedia`: Type for media inputs (`File | Buffer | Blob | boolean`).
- `ProjectResult`: The return type for a completed project.
- `VideoCostEstimateParams`: Parameters for estimating video cost.
- `AudioCostEstimateParams`: Parameters for estimating audio cost.
- `CostEstimate`: Cost estimate response shape.
- `ModelInfo`: Detailed information about an available model.
- `BalanceInfo`: Your token balance.
- `ErrorData`: The structure of error objects.
- `VideoWorkflowType`: Video generation workflow types (`t2v`, `i2v`, `s2v`, `ia2v`, `a2v`, `v2v`, `animate-move`, `animate-replace`).
- `JobCompletedData`: Data emitted when an individual job completes.
- `JobFailedData`: Data emitted when an individual job fails.
- `ChatCompletionParams` / `ChatCompletionResult` / `ChatCompletionChunk`: Types for chat completions.
- `LLMModelInfo` / `LLMCostEstimation`: Types for chat model metadata and cost estimates.
- `ProjectEvent`: Raw project events from the SDK.
- `JobEvent`: Raw job events from the SDK (includes ETA updates).

## License

[MIT](LICENSE)
