/**
 * Build a compact, LLM-ready description for a saved `WorkflowTemplate`.
 *
 * Consumers (sogni-chat's synthetic-tool registration, the workflow catalog
 * search, the durable workflow API listing endpoint) all need the same
 * one-paragraph summary string. Keeping the helper in the shared package
 * means the chat surface and the API surface render identical descriptions
 * without copy/pasting glue.
 */

import type { WorkflowInput, WorkflowTemplate } from './types.js';

export interface SummarizeWorkflowTemplateOptions {
  /**
   * Optional ceiling on the rendered description length, in characters.
   * The summary is truncated on a word boundary; the helper never breaks
   * mid-word. Defaults to 320 — fits comfortably inside the
   * `function.description` budget the chat completion tool catalog uses.
   */
  maxDescriptionLength?: number;
  /**
   * When true (default), append a single trailing sentence describing the
   * declared input parameters. Set false when the caller already renders
   * input metadata separately (e.g. the synthetic-tool JSON schema).
   */
  includeInputsSentence?: boolean;
}

const DEFAULT_MAX_LENGTH = 320;

export function summarizeWorkflowTemplate(
  template: WorkflowTemplate,
  options: SummarizeWorkflowTemplateOptions = {},
): string {
  const maxLength = options.maxDescriptionLength ?? DEFAULT_MAX_LENGTH;
  const includeInputs = options.includeInputsSentence ?? true;

  const base = template.description?.trim() || template.name.trim();
  const inputsSentence = includeInputs ? buildInputsSentence(template.inputs) : '';
  const stagesSentence = buildStagesSentence(template);

  const parts = [base, stagesSentence, inputsSentence].filter((part) => part.length > 0);
  const merged = parts.join(' ');
  return truncateOnBoundary(merged, maxLength);
}

function buildStagesSentence(template: WorkflowTemplate): string {
  const stageCount = template.stages.length;
  if (stageCount === 0) return '';
  const interactiveCount = template.stages.filter((stage) => stage.type === 'interactive').length;
  const batchCount = template.stages.filter((stage) => stage.type === 'batch').length;
  const fragments: string[] = [`${stageCount} ${stageCount === 1 ? 'stage' : 'stages'}`];
  if (batchCount > 0) fragments.push(`${batchCount} batch`);
  if (interactiveCount > 0) fragments.push(`${interactiveCount} interactive`);
  return `(${fragments.join(', ')}).`;
}

function buildInputsSentence(inputs: WorkflowInput[]): string {
  const declared = inputs.filter((input) => !input.internal);
  if (declared.length === 0) return 'No inputs required.';
  const requiredNames = declared
    .filter((input) => input.required)
    .map((input) => `${input.name} (${input.type})`);
  const optionalNames = declared
    .filter((input) => !input.required)
    .map((input) => `${input.name} (${input.type})`);
  const parts: string[] = [];
  if (requiredNames.length > 0) parts.push(`Required inputs: ${requiredNames.join(', ')}.`);
  if (optionalNames.length > 0) parts.push(`Optional inputs: ${optionalNames.join(', ')}.`);
  return parts.join(' ');
}

function truncateOnBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace <= 0) return `${slice.trimEnd()}…`;
  return `${slice.slice(0, lastSpace).trimEnd()}…`;
}
