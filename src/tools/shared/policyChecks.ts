/**
 * Centralized policy checks for the tool-calling harness.
 *
 * Policy functions validate whether a tool call is allowed in the current
 * execution state. They return structured check results that the
 * orchestration loop uses to approve, modify, or reject tool calls.
 *
 * Pure logic — used by browser chat, hosted chat in sogni-api, and the skill
 * runtime so all three enforce the same rules.
 */

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  redirectTo?: string;
  injectArgs?: Record<string, unknown>;
  explanation?: string;
}

export interface PersonaPolicyState {
  personaNames: string[];
  hasPersonaPhotos: boolean;
  hasUploadedImages: boolean;
}

/**
 * Check if a tool call involving image generation needs persona resolution
 * first.
 *
 * Rules:
 *  - If `generate_image` is called while persona photos are loaded, redirect
 *    to `edit_image` (personas must always use edit_image with reference
 *    photos).
 *  - If the prompt mentions persona names but personas haven't been
 *    resolved, force `resolve_personas` before proceeding.
 */
export function checkPersonaPolicy(
  toolName: string,
  args: Record<string, unknown>,
  state: PersonaPolicyState,
): PolicyCheckResult {
  const promptText = String(args.prompt || '').toLowerCase();

  if (toolName === 'generate_image' && state.hasPersonaPhotos) {
    return {
      allowed: true,
      redirectTo: 'edit_image',
      explanation:
        'Redirecting generate_image → edit_image: persona photos require edit_image for identity preservation',
    };
  }

  if (
    toolName !== 'resolve_personas'
    && state.personaNames.length > 0
    && !state.hasPersonaPhotos
    && state.personaNames.some((name) => promptText.includes(name.toLowerCase()))
  ) {
    return {
      allowed: false,
      reason: 'precondition_failed',
      explanation: `Prompt mentions personas (${state.personaNames
        .filter((n) => promptText.includes(n.toLowerCase()))
        .join(', ')}) but they haven't been resolved — resolve_personas must run first`,
    };
  }

  return { allowed: true };
}

/**
 * Check if the model's text response ends with a question, indicating it's
 * waiting for user input before executing tools.
 *
 * Rule: If the model's response text ends with "?", suppress tool calls and
 * let the user respond first.
 */
export function checkQuestionSuppression(
  responseText: string,
  hasToolCalls: boolean,
): PolicyCheckResult {
  if (!hasToolCalls) return { allowed: true };

  const tail = responseText.trim().slice(-500);
  const unquoted = tail.replace(/"[^"]*"/g, '').replace(/'[^']*'/g, '');
  if (unquoted.trimEnd().endsWith('?')) {
    return {
      allowed: false,
      reason: 'business_rule',
      explanation: 'Suppressing tool calls: model response ends with "?" — waiting for user input',
    };
  }

  return { allowed: true };
}

export interface ToolCallState {
  personaNames: string[];
  hasPersonaPhotos: boolean;
  hasUploadedImages: boolean;
  executedTools: string[];
  availableResultUrls: string[];
  availableVideoUrls: string[];
}

interface ToolPrerequisite {
  requires: string;
  condition: string;
  check: (state: ToolCallState) => boolean;
}

const TOOL_PREREQUISITES: Record<string, ToolPrerequisite[]> = {
  edit_image: [
    {
      requires: 'resolve_personas',
      condition: 'When prompt references personas that have not been resolved',
      check: (state) => state.personaNames.length > 0 && !state.hasPersonaPhotos,
    },
  ],
};

/** Check if all prerequisites for a tool are satisfied. */
export function checkPrerequisites(
  toolName: string,
  state: ToolCallState,
): PolicyCheckResult {
  const prereqs = TOOL_PREREQUISITES[toolName];
  if (!prereqs) return { allowed: true };

  for (const prereq of prereqs) {
    if (prereq.check(state)) {
      if (!state.executedTools.includes(prereq.requires)) {
        return {
          allowed: false,
          reason: 'precondition_failed',
          explanation: `${toolName} requires ${prereq.requires} first: ${prereq.condition}`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Run all applicable policy checks for a tool call. Returns the first
 * failing check, or an "allowed" result.
 */
export function runPolicyChecks(
  toolName: string,
  args: Record<string, unknown>,
  state: ToolCallState,
): PolicyCheckResult {
  const personaCheck = checkPersonaPolicy(toolName, args, state);
  if (!personaCheck.allowed || personaCheck.redirectTo) return personaCheck;

  const prereqCheck = checkPrerequisites(toolName, state);
  if (!prereqCheck.allowed) return prereqCheck;

  return { allowed: true };
}
