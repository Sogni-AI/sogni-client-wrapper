/**
 * Test script for per-image events
 * This demonstrates the new JOB_COMPLETED and JOB_FAILED events
 */

import { config } from 'dotenv';
import { SogniClientWrapper, ClientEvent, JobCompletedData, JobFailedData } from './src';

// Load environment variables
config();

async function testPerImageEvents() {
  console.log('🧪 Testing per-image events...\n');

  const client = new SogniClientWrapper({
    username: process.env.SOGNI_USERNAME!,
    password: process.env.SOGNI_PASSWORD!,
    debug: false,
  });

  try {
    // Track completed and failed images
    const completedImages: string[] = [];
    const failedImages: number[] = [];

    // Listen for per-image completion events
    client.on(ClientEvent.JOB_COMPLETED, (data: JobCompletedData) => {
      console.log(`✅ Image ${data.jobIndex! + 1}/${data.totalJobs} completed!`);
      console.log(`   Project: ${data.projectId}`);
      console.log(`   URL: ${data.imageUrl || 'N/A'}`);
      console.log(`   Job ID: ${data.job.id}`);
      console.log('');

      if (data.imageUrl) {
        completedImages.push(data.imageUrl);
      }
    });

    // Listen for per-image failure events
    client.on(ClientEvent.JOB_FAILED, (data: JobFailedData) => {
      console.log(`❌ Image ${data.jobIndex! + 1}/${data.totalJobs} failed!`);
      console.log(`   Project: ${data.projectId}`);
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      console.log('');

      failedImages.push(data.jobIndex!);
    });

    // Listen for overall project progress
    client.on(ClientEvent.PROJECT_PROGRESS, (progress) => {
      console.log(`📊 Overall progress: ${progress.percentage}%`);
    });

    // Listen for overall project completion
    client.on(ClientEvent.PROJECT_COMPLETED, (result) => {
      console.log(`\n🎉 Project completed! Total images: ${result.imageUrls?.length || 0}`);
    });

    // Get the most popular model
    console.log('🔍 Finding the most popular model...');
    const model = await client.getMostPopularModel();
    console.log(`✓ Using model: ${model.id} (${model.workerCount} workers)\n`);

    // Create a project with multiple images
    console.log('🎨 Generating 3 images...\n');
    const result = await client.createProject({
      modelId: model.id,
      positivePrompt: 'A serene mountain landscape at sunset, photorealistic',
      negativePrompt: 'blurry, low quality',
      numberOfImages: 3,
      steps: model.recommendedSettings?.steps || 20,
      guidance: model.recommendedSettings?.guidance || 7.5,
      width: 512,
      height: 512,
      waitForCompletion: true,
    });

    // Summary
    console.log('\n📋 Summary:');
    console.log(`   Completed images: ${completedImages.length}`);
    console.log(`   Failed images: ${failedImages.length}`);
    console.log(`   Total from result: ${result.imageUrls?.length || 0}`);

    if (completedImages.length > 0) {
      console.log('\n🖼️  Image URLs:');
      completedImages.forEach((url, i) => {
        console.log(`   ${i + 1}. ${url}`);
      });
    }

    // Verify that per-image events fired
    if (completedImages.length === 3) {
      console.log('\n✅ SUCCESS: All per-image events fired correctly!');
    } else {
      console.log('\n⚠️  WARNING: Expected 3 per-image events, got ' + completedImages.length);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

// Only run if credentials are available
if (!process.env.SOGNI_USERNAME || !process.env.SOGNI_PASSWORD) {
  console.log('⚠️  Skipping test: SOGNI_USERNAME and SOGNI_PASSWORD must be set');
  console.log('   This is expected for unit tests. Use npm run test:e2e to run with credentials.');
  process.exit(0);
} else {
  testPerImageEvents().catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}
