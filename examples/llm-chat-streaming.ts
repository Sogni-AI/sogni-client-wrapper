import { config } from 'dotenv';
import { SogniClientWrapper } from '../src';
import { resolveChatModel } from './llm-example-utils';

config();

function resolvePrompt(): string {
  return process.argv.slice(2).join(' ').trim() || 'Give me a concise overview of image diffusion models.';
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
    console.log(`Prompt: ${prompt}\n`);

    const stream = await client.createChatCompletion({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
      stream: true,
      tokenType: 'spark',
    });

    for await (const chunk of stream) {
      if (chunk.content) {
        process.stdout.write(chunk.content);
      }
    }

    const final = stream.finalResult;
    if (final?.usage) {
      console.log('\n\nUsage:', final.usage);
    } else {
      console.log('\n');
    }
  } finally {
    await client.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
