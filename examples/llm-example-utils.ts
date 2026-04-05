import { SogniClientWrapper, type LLMModelInfo } from '../src';

const VISION_MODEL_ID_PATTERN =
  /(vision|vlm|(^|[-_.])vl($|[-_.])|qwen3\.5|qwen.*(?:vl|vision)|llava|internvl|pixtral|molmo|minicpm-v|omni)/i;

export function getArgValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

function getAvailableModelEntries(models: Record<string, LLMModelInfo>): Array<[string, LLMModelInfo]> {
  return Object.entries(models).filter(([, info]) => (info.workers || 0) > 0);
}

export function isLikelyVisionModelId(modelId: string): boolean {
  return VISION_MODEL_ID_PATTERN.test(modelId);
}

export async function resolveChatModel(client: SogniClientWrapper): Promise<string> {
  const models = await client.waitForChatModels(15000);
  const preferred = process.env.SOGNI_LLM_MODEL;
  if (preferred && models[preferred] && (models[preferred].workers || 0) > 0) {
    return preferred;
  }

  const available = getAvailableModelEntries(models);
  if (available.length > 0) {
    return available[0][0];
  }

  const fallback = Object.keys(models)[0];
  if (!fallback) {
    throw new Error('No LLM models are currently available.');
  }
  return fallback;
}

export async function resolveVisionModel(client: SogniClientWrapper): Promise<string> {
  const models = await client.waitForChatModels(15000);
  const preferred = process.env.SOGNI_VISION_MODEL;

  if (preferred) {
    const modelInfo = models[preferred];
    if (modelInfo && (modelInfo.workers || 0) > 0) {
      return preferred;
    }
    throw new Error(
      `SOGNI_VISION_MODEL=${preferred} is not currently available.`
    );
  }

  const available = getAvailableModelEntries(models);
  const visionEntries = available
    .filter(([modelId]) => isLikelyVisionModelId(modelId))
    .sort((a, b) => (b[1].workers || 0) - (a[1].workers || 0));

  if (visionEntries.length > 0) {
    return visionEntries[0][0];
  }

  const availableIds = available.map(([modelId]) => modelId);
  const preview = availableIds.slice(0, 8).join(', ') || 'none';
  throw new Error(
    `No likely vision-capable chat model is currently available. ` +
      `Set SOGNI_VISION_MODEL to override detection. Available models: ${preview}`
  );
}
