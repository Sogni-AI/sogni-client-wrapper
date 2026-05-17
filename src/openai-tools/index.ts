import {
  generationToolsManifest,
  compositionToolsManifest,
  appToolsManifest,
} from './_manifests.generated.js';
import type { ToolDefinition } from '../tools/definitions/types.js';

export type { ToolDefinition } from '../tools/definitions/types.js';

export interface OpenAIToolsManifest {
  version?: string;
  generatedAt?: string | null;
  source?: string;
  schemaRefs?: Record<string, string>;
  tools: ToolDefinition[];
}

const generationManifest = generationToolsManifest as OpenAIToolsManifest;
const compositionManifest = compositionToolsManifest as OpenAIToolsManifest;
const appManifest = appToolsManifest as OpenAIToolsManifest;

export const GENERATION_TOOLS_MANIFEST: OpenAIToolsManifest = generationManifest;
export const COMPOSITION_TOOLS_MANIFEST: OpenAIToolsManifest = compositionManifest;
export const APP_TOOLS_MANIFEST: OpenAIToolsManifest = appManifest;

const hostedTools: ToolDefinition[] = [
  ...generationManifest.tools,
  ...compositionManifest.tools,
];

const hostedVersions = [generationManifest.version, compositionManifest.version]
  .filter((v): v is string => typeof v === 'string' && v.length > 0);

export const SOGNI_HOSTED_TOOLS_MANIFEST: OpenAIToolsManifest = {
  version: hostedVersions.length > 0 ? hostedVersions.join('+') : new Date().toISOString().slice(0, 10),
  source: '@sogni-ai/sogni-intelligence-client hosted creative-tools surface (generation + composition)',
  generatedAt: null,
  tools: hostedTools,
};

export const SOGNI_HOSTED_TOOL_NAMES: readonly string[] = hostedTools.map((tool) => tool.function.name);

export function getHostedToolDefinition(name: string): ToolDefinition | undefined {
  return hostedTools.find((tool) => tool.function.name === name);
}

export function listHostedToolNames(): string[] {
  return hostedTools.map((tool) => tool.function.name);
}
