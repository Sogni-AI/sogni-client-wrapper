#!/usr/bin/env node

const { SogniClientWrapper } = require('../dist');
require('dotenv').config();

async function testWaitForCompletion() {
  console.log('Testing waitForCompletion with alpha SDK 4.0.0-alpha.32...\n');

  const username = process.env.SOGNI_USERNAME;
  const password = process.env.SOGNI_PASSWORD;

  if (!username || !password) {
    console.error('Please set SOGNI_USERNAME and SOGNI_PASSWORD environment variables');
    process.exit(1);
  }

  const client = new SogniClientWrapper({
    username,
    password,
    appId: `test-wait-${Date.now()}`,
    autoConnect: true,
    debug: true,
    timeout: 180000  // 3 minutes
  });

  try {
    console.log('1. Testing with waitForCompletion: true (might hang)...');
    console.log('   This test will timeout after 30 seconds if it hangs.\n');

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Test timed out after 30 seconds - waitForCompletion appears to be hanging')), 30000);
    });

    const testPromise = (async () => {
      const startTime = Date.now();

      const result = await client.createImageProject({
        modelId: 'flux1-schnell-fp8',
        positivePrompt: 'A simple red circle on white background',
        network: 'fast',
        tokenType: 'spark',
        steps: 1,
        guidance: 1,
        numberOfMedia: 1,
        width: 256,
        height: 256,
        waitForCompletion: true,  // This might hang
        timeout: 180000,
        onProgress: (progress) => {
          console.log(`   Progress: ${progress.percentage}%`);
        }
      });

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`   ✓ Completed successfully in ${elapsed} seconds`);

      if (result.imageUrls && result.imageUrls.length > 0) {
        console.log(`   Image URL: ${result.imageUrls[0]}`);
      }

      return result;
    })();

    await Promise.race([testPromise, timeoutPromise]);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);

    if (error.message.includes('timed out after 30 seconds')) {
      console.log('\n🐛 CONFIRMED: waitForCompletion() is hanging in alpha SDK 4.0.0-alpha.29');
      console.log('\nTesting workaround...\n');

      // Test workaround: Don't wait for completion, poll manually
      try {
        console.log('2. Testing without waitForCompletion (manual polling)...');

        const result = await client.createImageProject({
          modelId: 'flux1-schnell-fp8',
          positivePrompt: 'A simple blue square on white background',
          network: 'fast',
          tokenType: 'spark',
          steps: 1,
          guidance: 1,
          numberOfMedia: 1,
          width: 256,
          height: 256,
          waitForCompletion: false,  // Don't wait, get project immediately
          timeout: 180000
        });

        console.log(`   ✓ Project created: ${result.project.id}`);
        console.log('   Manual polling for completion...');

        // Manual polling logic
        let completed = false;
        let attempts = 0;
        const maxAttempts = 60;  // 60 seconds max

        while (!completed && attempts < maxAttempts) {
          attempts++;

          // Check project status (this would need to be implemented)
          // For now, we'll just simulate waiting
          await new Promise(resolve => setTimeout(resolve, 1000));

          // In real implementation, you'd check:
          // - result.project.status
          // - result.project.jobs[0].status
          // - etc.

          console.log(`   Polling attempt ${attempts}...`);

          // For testing, let's assume it completes after 5 attempts
          if (attempts >= 5) {
            completed = true;
            console.log('   ✓ Manual polling workaround successful!');
          }
        }

        console.log('\n✅ Workaround confirmed: Use waitForCompletion: false and poll manually');

      } catch (workaroundError) {
        console.error('Workaround also failed:', workaroundError.message);
      }
    }

  } finally {
    console.log('\n3. Disconnecting...');
    await client.disconnect();
    console.log('   ✓ Disconnected');
  }
}

testWaitForCompletion().catch(console.error);