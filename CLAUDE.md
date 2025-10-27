# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sogni Client Wrapper** is a TypeScript library that wraps the `@sogni-ai/sogni-client` SDK to provide enhanced developer experience with automatic connection management, promise-based APIs, and robust error handling. It's designed for seamless integration with n8n and other automation platforms.

## Development Commands

```bash
# Install dependencies
npm install

# Build the TypeScript code to JavaScript
npm run build

# Watch mode - rebuilds on file changes
npm run build:watch
# or
npm run dev

# Run tests (placeholder currently)
npm test

# Build before publishing (runs automatically)
npm run prepublishOnly
```

## High-Level Architecture

### Core Structure
The library follows a clear separation of concerns:

1. **Client Layer** (`src/client/SogniClientWrapper.ts`)
   - Main wrapper class extending EventEmitter
   - Manages WebSocket connection lifecycle
   - Implements automatic reconnection with exponential backoff
   - Provides promise-based wrappers for all Sogni operations
   - Handles project creation with progress tracking via callbacks

2. **Type System** (`src/types/index.ts`)
   - Defines all public interfaces (SogniClientConfig, ProjectConfig, ProjectResult, etc.)
   - Re-exports types from underlying Sogni SDK for convenience
   - Provides type-safe event definitions via ClientEvent enum

3. **Error Hierarchy** (`src/utils/errors.ts`)
   - Base SogniError class with code, status, and details
   - Specialized errors mapped to HTTP status codes:
     - SogniAuthenticationError (401)
     - SogniBalanceError (402)
     - SogniValidationError (400)
     - SogniTimeoutError (408)
   - Each error captures stack traces and original error context

4. **Utilities** (`src/utils/helpers.ts`)
   - Configuration validation and UUID generation
   - Async utilities (retry, waitFor, debounce, throttle)
   - Formatting helpers (bytes, duration)
   - Security utilities (sanitizeForLog for credentials)

### Connection Management Strategy

The wrapper implements sophisticated connection handling that abstracts away the complexity of WebSocket management:

- **Lazy Connection**: Connects automatically on first operation if not already connected
- **State Tracking**: Maintains detailed connection state (disconnected, connecting, connected, reconnecting, failed)
- **Automatic Reconnection**: Configurable reconnection with exponential backoff
- **Event-Driven**: Emits connection lifecycle events for monitoring
- **Concurrent Operation Safety**: Prevents duplicate connection attempts and handles pending operations

### Project Execution Flow

When creating image generation projects:
1. Validates configuration (steps, guidance, dimensions)
2. Ensures connection is established
3. Creates project with underlying SDK
4. If `waitForCompletion` is true, polls for results
5. Emits progress events via callbacks
6. Returns completed project with image URLs

### Model Recommendation System

The wrapper includes intelligent defaults based on model type:
- **Flux models**: 4 steps, 3.5 guidance
- **Lightning/Turbo/LCM models**: 4 steps, 1.0 guidance
- **Standard models**: 20 steps, 7.5 guidance

## Key Implementation Details

### Promise-Based API Design
All async operations return promises and support async/await. The wrapper converts callback-based SDK methods to promises internally, handling timeouts and errors consistently.

### Error Handling Philosophy
- Throw custom error classes for specific failure scenarios
- Include HTTP status codes for API-related errors
- Preserve original error details and stack traces
- Validate inputs early with clear error messages

### Event System
Extends Node.js EventEmitter with type-safe events via the ClientEvent enum. Events cover connection lifecycle, model updates, balance changes, and project progress.

### Configuration Validation
Strict validation of client and project configurations with detailed error messages. Validates numeric ranges (steps: 1-100, guidance: 0-30, dimensions: 256-2048) and required fields.

## Testing Approach

The test suite is split into two categories:

1. **Unit/Integration Tests** (`test/basic-tests.ts`)
   - No credentials required
   - Tests configuration validation, event emission, error hierarchy
   - Validates exports and type definitions

2. **End-to-End Tests** (`test/e2e-test.ts`)
   - Requires valid Sogni credentials
   - Tests real connections, model fetching, and image generation
   - Validates progress tracking and event firing

## Dependencies

- **Production**: `@sogni-ai/sogni-client` (latest) - The underlying Sogni SDK
- **Development**: `typescript` (^5.0.0), `@types/node` (^22.0.0)
- **Node.js**: Requires version 18.0.0 or higher

## Build Output

TypeScript compilation generates:
- JavaScript files in `dist/`
- Type declarations (`.d.ts`) with source maps
- Preserves directory structure from `src/`

Published package includes only `dist/`, `README.md`, and `LICENSE`.