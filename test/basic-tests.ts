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
} from '../src';

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
      'projectCreated', 'projectProgress', 'projectCompleted', 'projectFailed'
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

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Tests passed: ${testsPassed}`);
  console.log(`❌ Tests failed: ${testsFailed}`);
  console.log(`📊 Total tests: ${testsPassed + testsFailed}`);
  console.log('='.repeat(50));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});

