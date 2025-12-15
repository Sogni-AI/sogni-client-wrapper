/**
 * End-to-end tests with real Sogni API credentials
 */

import * as dotenv from 'dotenv';
import { SogniClientWrapper, ClientEvent } from '../src';

// Load environment variables from .env file
dotenv.config();

console.log('🧪 Starting end-to-end tests with real API...\n');

// Validate environment variables
if (!process.env.SOGNI_USERNAME || !process.env.SOGNI_PASSWORD) {
  console.error('❌ Missing required environment variables!');
  console.error('Please create a .env file with:');
  console.error('  SOGNI_USERNAME=your_username');
  console.error('  SOGNI_PASSWORD=your_password');
  process.exit(1);
}

const CREDENTIALS = {
  username: process.env.SOGNI_USERNAME,
  password: process.env.SOGNI_PASSWORD,
};

let testsPassed = 0;
let testsFailed = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      console.log(`\n🔄 Running: ${name}`);
      await fn();
      console.log(`✅ PASS: ${name}`);
      testsPassed++;
    } catch (error) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        console.error(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }
      testsFailed++;
    }
  };
}

async function runTests() {
  let client: SogniClientWrapper | null = null;
  let catImageUrl: string | undefined; // Store the cat image URL for video test

  try {
    // Test 1: Create client
    await test('Should create client with credentials', async () => {
      client = new SogniClientWrapper({
        ...CREDENTIALS,
        autoConnect: false,
        debug: true,
      });
      if (!client) throw new Error('Client not created');
    })();

    // Test 2: Connect to Sogni
    await test('Should connect to Sogni Supernet', async () => {
      if (!client) throw new Error('Client not initialized');
      
      console.log('   Connecting to Sogni...');
      await client.connect();
      
      if (!client.isConnected()) {
        throw new Error('Client not connected after connect()');
      }
      console.log('   Connected successfully!');
    })();

    // Test 3: Get balance
    await test('Should retrieve account balance', async () => {
      if (!client) throw new Error('Client not initialized');

      const balance = await client.getBalance();
      console.log(`   SOGNI tokens: ${balance.sogni}`);
      console.log(`   Spark tokens: ${balance.spark}`);

      // Note: refreshBalance() returns both SOGNI and Spark balances
      // We're checking the 'net' balance (settled + credit - debit)
      if (typeof balance.sogni !== 'number') {
        throw new Error('Invalid balance format');
      }
    })();

    // Test 4: Get available models
    await test('Should retrieve available models', async () => {
      if (!client) throw new Error('Client not initialized');
      
      const models = await client.getAvailableModels({ sortByWorkers: true });
      console.log(`   Found ${models.length} models`);
      
      if (models.length === 0) {
        throw new Error('No models available');
      }
      
      console.log(`   Top model: ${models[0].id} (${models[0].workerCount} workers)`);
    })();

    // Test 5: Get most popular model
    await test('Should get most popular model', async () => {
      if (!client) throw new Error('Client not initialized');
      
      const model = await client.getMostPopularModel();
      console.log(`   Model ID: ${model.id}`);
      console.log(`   Model name: ${model.name}`);
      console.log(`   Workers: ${model.workerCount}`);
      console.log(`   Recommended steps: ${model.recommendedSettings?.steps}`);
      console.log(`   Recommended guidance: ${model.recommendedSettings?.guidance}`);
      
      if (!model.id) throw new Error('Invalid model');
    })();

    // Test 6: Get specific model
    await test('Should get specific model by ID', async () => {
      if (!client) throw new Error('Client not initialized');
      
      const models = await client.getAvailableModels();
      if (models.length === 0) throw new Error('No models available');
      
      const firstModelId = models[0].id;
      const model = await client.getModel(firstModelId);
      
      console.log(`   Retrieved model: ${model.id}`);
      if (model.id !== firstModelId) {
        throw new Error('Model ID mismatch');
      }
    })();

    // Test 7: Generate a simple image
    await test('Should generate image with Flux model', async () => {
      // Wait a bit to avoid rate limiting
      await sleep(5000);
      if (!client) throw new Error('Client not initialized');
      
      const model = await client.getMostPopularModel();
      console.log(`   Using model: ${model.id}`);
      console.log(`   Generating image...`);
      
      let progressCount = 0;
      
      const result = await client.createProject({
        type: 'image',
        modelId: model.id,
        positivePrompt: 'A cute cartoon cat wearing sunglasses',
        negativePrompt: 'blurry, low quality',
        steps: model.recommendedSettings?.steps || 4,
        guidance: model.recommendedSettings?.guidance || 3.5,
        numberOfMedia: 1,
        network: 'fast',
        tokenType: 'spark',
        waitForCompletion: true,
        timeout: 180000,
        onProgress: (progress) => {
          progressCount++;
          if (progressCount % 5 === 0) {
            console.log(`   Progress: ${progress.percentage}%`);
          }
        },
      });
      
      console.log(`   Generation completed: ${result.completed}`);
      console.log(`   Project ID: ${result.project.id}`);
      console.log(`   Images generated: ${result.imageUrls?.length || 0}`);
      
      if (result.imageUrls && result.imageUrls.length > 0) {
        console.log(`   Image URL: ${result.imageUrls[0]}`);
        catImageUrl = result.imageUrls[0]; // Store for video test
      }
      
      if (!result.completed) {
        throw new Error('Image generation did not complete');
      }
      
      if (!result.imageUrls || result.imageUrls.length === 0) {
        throw new Error('No image URLs returned');
      }
    })();

    // Test 8: Event listeners
    await test('Should emit events during operation', async () => {
      // Wait to avoid rate limiting
      await sleep(10000);
      if (!client) throw new Error('Client not initialized');
      
      let eventsFired = {
        projectCreated: false,
        projectProgress: false,
        projectCompleted: false,
      };
      
      client.on(ClientEvent.PROJECT_CREATED, () => {
        eventsFired.projectCreated = true;
        console.log('   Event: PROJECT_CREATED');
      });
      
      client.on(ClientEvent.PROJECT_PROGRESS, () => {
        eventsFired.projectProgress = true;
      });
      
      client.on(ClientEvent.PROJECT_COMPLETED, () => {
        eventsFired.projectCompleted = true;
        console.log('   Event: PROJECT_COMPLETED');
      });
      
      const model = await client.getMostPopularModel();
      
      await client.createProject({
        type: 'image',
        modelId: model.id,
        positivePrompt: 'A simple red circle on white background',
        steps: model.recommendedSettings?.steps || 4,
        guidance: model.recommendedSettings?.guidance || 3.5,
        numberOfMedia: 1,
        network: 'fast',
        tokenType: 'spark',
        waitForCompletion: true,
        timeout: 180000,
      });
      
      console.log('   Events fired:', eventsFired);
      
      if (!eventsFired.projectCreated) {
        throw new Error('PROJECT_CREATED event not fired');
      }
      if (!eventsFired.projectCompleted) {
        throw new Error('PROJECT_COMPLETED event not fired');
      }
    })();

    // Test 9: Generate a video with fastest settings
    await test('Should generate video with wan_v2.2-14b-fp8_i2v_lightx2v model', async () => {
      // Wait to avoid rate limiting
      await sleep(10000);
      if (!client) throw new Error('Client not initialized');

      if (!catImageUrl) {
        console.log('   ⚠️ No cat image URL from previous test, skipping i2v test');
        throw new Error('Reference image required for i2v model - run image test first');
      }

      console.log('   Using model: wan_v2.2-14b-fp8_i2v_lightx2v (image-to-video)');
      console.log('   Settings: 512x512, 16fps, 81 frames');
      console.log('   Reference image: Using cat image from test 7');
      console.log('   Fetching reference image...');

      // Fetch the image from the URL
      const imageResponse = await fetch(catImageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch reference image: ${imageResponse.statusText}`);
      }

      // Convert to Buffer for the SDK
      const arrayBuffer = await imageResponse.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);
      console.log(`   Reference image fetched: ${(imageBuffer.length / 1024).toFixed(2)} KB`);

      console.log('   Generating video...');

      let progressCount = 0;

      const result = await client.createProject({
        type: 'video',
        modelId: 'wan_v2.2-14b-fp8_i2v_lightx2v',
        positivePrompt: 'The cat transforms into a majestic lion, morphing animation, smooth transition',
        negativePrompt: 'blurry, low quality, distorted, glitchy',
        referenceImage: imageBuffer, // Use the cat image as reference
        width: 512,
        height: 512,
        fps: 16,
        frames: 81,
        numberOfMedia: 1,
        network: 'fast',
        tokenType: 'spark',
        waitForCompletion: true,
        timeout: 300000, // 5 minutes for video generation
        onProgress: (progress) => {
          progressCount++;
          if (progressCount % 5 === 0) {
            console.log(`   Progress: ${progress.percentage}%`);
          }
        },
      });

      console.log(`   Video generation completed: ${result.completed}`);
      console.log(`   Project ID: ${result.project.id}`);
      console.log(`   Videos generated: ${result.videoUrls?.length || 0}`);

      if (result.videoUrls && result.videoUrls.length > 0) {
        console.log(`   Video URL: ${result.videoUrls[0]}`);
        console.log(`   Video duration: ~5 seconds (81 frames @ 16fps)`);
      }

      if (!result.completed) {
        throw new Error('Video generation did not complete');
      }

      if (!result.videoUrls || result.videoUrls.length === 0) {
        throw new Error('No video URLs returned');
      }
    })();

    // Test 10: Disconnect
    await test('Should disconnect cleanly', async () => {
      if (!client) throw new Error('Client not initialized');
      
      await client.disconnect();
      
      if (client.isConnected()) {
        throw new Error('Client still connected after disconnect');
      }
      console.log('   Disconnected successfully');
    })();

  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('END-TO-END TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Tests passed: ${testsPassed}`);
  console.log(`❌ Tests failed: ${testsFailed}`);
  console.log(`📊 Total tests: ${testsPassed + testsFailed}`);
  console.log(`🎯 Success rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
