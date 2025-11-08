# Sogni Client Wrapper

[![NPM version](https://img.shields.io/npm/v/@sogni-ai/sogni-client-wrapper.svg)](https://www.npmjs.com/package/@sogni-ai/sogni-client-wrapper) [![License](https://img.shields.io/npm/l/@sogni-ai/sogni-client-wrapper.svg)](https://www.npmjs.com/package/@sogni-ai/sogni-client-wrapper)

An enhanced Node.js wrapper for the [`@sogni-ai/sogni-client`](https://sdk-docs.sogni.ai/) library, designed for robustness, ease of use, and seamless integration with platforms like [n8n](https://n8n.io/).

This library simplifies interaction with the Sogni AI Supernet by providing a promise-based API, automatic connection management, enhanced error handling, and a more developer-friendly interface.

## Features

- **Promise-Based API**: Modern `async/await` support for all core operations.
- **Connection Management**: Automatic connection and reconnection handling.
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
      modelId: model.id,
      positivePrompt: 'A photorealistic portrait of a majestic lion in the savanna at sunset',
      negativePrompt: 'blurry, cartoon, low quality',
      stylePrompt: 'cinematic',
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

## API Reference

### `new SogniClientWrapper(config)`

Creates a new client instance.

**Configuration (`SogniClientConfig`)**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `username` | `string` | **Required** | Your Sogni account username. |
| `password` | `string` | **Required** | Your Sogni account password. |
| `appId` | `string` | Auto-generated UUID | Unique ID for your application. |
| `network` | `'fast' \| 'relaxed'` | `'fast'` | The Sogni network to use. |
| `autoConnect` | `boolean` | `true` | Connect automatically on the first operation. |
| `reconnect` | `boolean` | `true` | Attempt to reconnect if the connection is lost. |
| `reconnectInterval` | `number` | `5000` | Time in ms between reconnect attempts. |
| `timeout` | `number` | `300000` | Default timeout in ms for operations. |
| `debug` | `boolean` | `false` | Enable detailed console logging. |

### Core Methods

- `connect(): Promise<void>`: Manually initiates the connection to Sogni.
- `disconnect(): Promise<void>`: Disconnects the client.
- `isConnected(): boolean`: Checks if the client is currently connected.
- `getConnectionState(): ConnectionState`: Returns the current connection status.

### Main Operations

- `createProject(config: ProjectConfig): Promise<ProjectResult>`: Creates a new image generation project.
  - `waitForCompletion` (default: `true`): If true, the promise resolves only when the image(s) are ready.
- `getAvailableModels(options?: GetModelsOptions): Promise<ModelInfo[]>`: Retrieves a list of available models.
- `getModel(modelId: string): Promise<ModelInfo>`: Retrieves details for a specific model.
- `getMostPopularModel(): Promise<ModelInfo>`: A helper to get the model with the most active workers.
- `getBalance(): Promise<BalanceInfo>`: Fetches your current SOGNI and Spark token balances using the `account.refreshBalance()` method.
- `getSizePresets(network: 'fast' \| 'relaxed', modelId: string): Promise<SizePreset[]>`: Gets available output size presets for a model.

### Event Handling

The wrapper is an `EventEmitter` and provides type-safe events.

```typescript
import { ClientEvent } from '@sogni-ai/sogni-client-wrapper';

client.on(ClientEvent.CONNECTED, () => {
  console.log('Client is connected!');
});

client.on(ClientEvent.PROJECT_PROGRESS, (progress) => {
  console.log(`Project ${progress.projectId} is ${progress.percentage}% complete.`);
});

client.on(ClientEvent.ERROR, (error) => {
  console.error('A client error occurred:', error.message);
});

// Per-image events - Display images as soon as they're ready!
client.on(ClientEvent.JOB_COMPLETED, (data) => {
  console.log(`Image ${data.jobIndex + 1}/${data.totalJobs} completed!`);
  console.log(`URL: ${data.imageUrl}`);
  // You can now display this individual image without waiting for the entire batch
});

client.on(ClientEvent.JOB_FAILED, (data) => {
  console.log(`Image ${data.jobIndex + 1}/${data.totalJobs} failed:`, data.error);
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
| **`jobCompleted`** | **`JobCompletedData`** | **Fired when each individual image finishes - get images as they're ready!** |
| **`jobFailed`** | **`JobFailedData`** | **Fired when an individual image fails.** |

#### Per-Image Event Example

Perfect for displaying images immediately as they complete in a batch:

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
  modelId: 'flux-schnell',
  positivePrompt: 'A beautiful landscape',
  numberOfImages: 4, // Generate 4 images
  steps: 4,
  guidance: 3.5,
});

// All 4 images will be displayed as they complete, not all at once!
```

## Error Handling

The library throws custom errors that extend `SogniError`. This allows you to catch specific types of errors.

- `SogniConnectionError`: Issues with connecting to the WebSocket server.
- `SogniAuthenticationError`: Invalid username or password.
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
   ```

3. Run the e2e tests:
   ```bash
   npm run test:e2e
   ```

**Note:** The e2e tests will make real API calls and may consume tokens from your Sogni account. They include image generation tests that will use your Spark tokens.

## TypeScript

This library is written in TypeScript and exports all necessary types for a fully-typed experience.

- `SogniClientConfig`: Configuration for the client constructor.
- `ProjectConfig`: Parameters for creating a project.
- `ProjectResult`: The return type for a completed project.
- `ModelInfo`: Detailed information about an available model.
- `BalanceInfo`: Your token balance.
- `ErrorData`: The structure of error objects.
- `JobCompletedData`: Data emitted when an individual image completes.
- `JobFailedData`: Data emitted when an individual image fails.

## License

[MIT](LICENSE)
