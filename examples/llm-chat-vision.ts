import { config } from 'dotenv';
import { extname } from 'path';
import { readFile } from 'fs/promises';
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
      'Missing --image <path-or-data-uri>. Vision chat requires an inline base64 data URI; local files are converted automatically.'
    );
  }
  return image;
}

function contentTypeForPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/png';
  }
}

async function toImageDataUri(imageInput: string): Promise<string> {
  if (imageInput.startsWith('data:')) {
    return imageInput;
  }
  if (/^https?:/i.test(imageInput)) {
    const response = await fetch(imageInput);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get('content-type')?.split(';')[0] || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
  }

  const buffer = await readFile(imageInput);
  return `data:${contentTypeForPath(imageInput)};base64,${buffer.toString('base64')}`;
}

async function main() {
  if (!process.env.SOGNI_USERNAME || !process.env.SOGNI_PASSWORD) {
    throw new Error('Missing SOGNI_USERNAME or SOGNI_PASSWORD in environment.');
  }

  const imageInput = resolveImageInput();
  const prompt = resolvePrompt();
  const imageUrl = await toImageDataUri(imageInput);

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
