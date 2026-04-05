import { config } from 'dotenv';
import { SogniClientWrapper } from '../src';
import { resolveChatModel } from './llm-example-utils';

config();

function resolvePrompt(): string {
  return process.argv.slice(2).join(' ').trim() || 'Explain the Sogni Supernet in one short paragraph.';
}

async function main() {
  if (!process.env.SOGNI_USERNAME || !process.env.SOGNI_PASSWORD) {
    throw new Error('Missing SOGNI_USERNAME or SOGNI_PASSWORD in environment.');
  }

  const client = new SogniClientWrapper({
    username: process.env.SOGNI_USERNAME,
    password: process.env.SOGNI_PASSWORD,
  });

  try {
    const model = await resolveChatModel(client);
    const prompt = resolvePrompt();

    console.log(`Using chat model: ${model}`);
    console.log(`Prompt: ${prompt}`);

    const result = await client.createChatCompletion({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 256,
      tokenType: 'spark',
    });

    console.log('\nResponse:\n');
    console.log(result.content);
    console.log('\nUsage:', result.usage);
  } finally {
    await client.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
