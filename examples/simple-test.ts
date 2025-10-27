import { SogniClientWrapper } from '../src';

// This is a placeholder test file.
// To run this, you would need to:
// 1. Have a valid Sogni AI account.
// 2. Create a .env file with your credentials:
//    SOGNI_USERNAME=your_username
//    SOGNI_PASSWORD=your_password

async function testClient() {
  const client = new SogniClientWrapper({
    username: process.env.SOGNI_USERNAME || '',
    password: process.env.SOGNI_PASSWORD || '',
    debug: true,
  });

  try {
    console.log('Connecting...');
    await client.connect();
    console.log('Connected!');

    const balance = await client.getBalance();
    console.log('Balance:', balance);

    const models = await client.getAvailableModels({ sortByWorkers: true });
    console.log('Top 5 Models:', models.slice(0, 5).map(m => ({ id: m.id, workers: m.workerCount })));

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await client.disconnect();
    console.log('Disconnected.');
  }
}

testClient();

