import { config } from 'dotenv';
import { SogniClientWrapper, type ChatMessage } from '../src';
import {
  getArgValue,
  resolveVisionModel,
} from './llm-example-utils';

config();

function resolvePrompt(): string {
  return getArgValue('--prompt') || 'Describe this image in one concise paragraph and mention any visible text.';
}

function resolveImageInput(): string {
  const image = getArgValue('--image');
  if (!image) {
    throw new Error(
      'Missing --image <sogni-hosted-url>. The current backend does not accept inline data URIs for vision chat.'
    );
  }
  return image;
}

function toImageUrl(imageInput: string): string {
  if (/^https?:/i.test(imageInput)) {
    return imageInput;
  }
  throw new Error(
    `Unsupported image input: ${imageInput}. Vision chat currently requires a Sogni-hosted https URL.`
  );
}

async function main() {
  if (!process.env.SOGNI_USERNAME || !process.env.SOGNI_PASSWORD) {
    throw new Error('Missing SOGNI_USERNAME or SOGNI_PASSWORD in environment.');
  }

  const imageInput = resolveImageInput();
  const prompt = resolvePrompt();
  const imageUrl = toImageUrl(imageInput);

  const client = new SogniClientWrapper({
    username: process.env.SOGNI_USERNAME,
    password: process.env.SOGNI_PASSWORD,
  });

  try {
    const model = await resolveVisionModel(client);
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
        ],
      },
    ];

    console.log(`Using vision model: ${model}`);
    console.log(`Image source: ${imageInput}`);
    console.log(`Prompt: ${prompt}`);

    const result = await client.createChatCompletion({
      model,
      messages,
      max_tokens: 300,
      think: false,
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
