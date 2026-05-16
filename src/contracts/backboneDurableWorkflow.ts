/**
 * Backbone durable-workflow shape contracts.
 *
 * Phase 8.2-prep extracts the type-only / pure-data slice of the
 * backbone durable workflow run so PUBLIC-bucket modules — notably
 * `runtime/durableWorkflowClient.ts` — can describe the
 * `/v1/creative-agent/workflows` REST contract without crossing into
 * PRIVATE `backbone/`. The original declarations lived in
 * `src/backbone/index.ts` and are re-exported from there for back-
 * compat so existing private consumers (durable workflow runtime,
 * chat run, workflow plan/template, etc.) keep working unchanged.
 *
 * This file is intentionally type-only with version-tag string
 * constants the types reference via `typeof`, plus the pure-data
 * `BACKBONE_DURABLE_HOSTED_STEP_TOOL_NAMES` list (derived from the
 * catalog already in `backboneToolCatalog.ts`). No business logic
 * lives here — the canonical `buildBackboneDurableWorkflowRun()` and
 * `normalizeBackboneDurableWorkflowSteps()` runtime functions remain
 * in `backbone/index.ts`.
 */

import {
  BACKBONE_DURABLE_HOSTED_CREATIVE_TOOL_NAMES,
  BACKBONE_HOSTED_APP_TOOL_NAMES,
} from "./backboneToolCatalog.js";

export const BACKBONE_SCHEMA_VERSION = "2026-04-27.1";
export const BACKBONE_MODEL_KB_VERSION = "2026-04-27.2";
export const BACKBONE_ROUTING_POLICY_VERSION = "2026-04-27.1";

export const BACKBONE_DURABLE_HOSTED_STEP_TOOL_NAMES = [
  ...BACKBONE_DURABLE_HOSTED_CREATIVE_TOOL_NAMES,
  ...BACKBONE_HOSTED_APP_TOOL_NAMES,
] as const;

export type BackboneDurableHostedStepToolName =
  (typeof BACKBONE_DURABLE_HOSTED_STEP_TOOL_NAMES)[number];

export type BackboneWorkflowStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial_failure"
  | "waiting_for_user"
  | "failed"
  | "cancelled";

export type BackboneWorkflowDependencyTransform =
  | "artifact_url"
  | "artifact_data_uri"
  | "image_url"
  | "video_url"
  | "audio_url"
  | "image_index"
  | "video_index"
  | "audio_index"
  | "subtitle_cues"
  | "subtitle_srt"
  | "overlay_items"
  | "asset_ref";

export interface BackboneWorkflowStepDependencyBinding {
  sourceStepId: string;
  targetArgument: string;
  transform: BackboneWorkflowDependencyTransform;
  sourceArtifactId?: string;
  sourceArtifactIndex?: number;
  mediaType?: "image" | "video" | "audio";
  required?: boolean;
}

export interface BackboneDurableWorkflowPlanStep {
  id: string;
  sequence: number;
  toolName: BackboneDurableHostedStepToolName;
  arguments: Record<string, unknown>;
  dependsOn?: BackboneWorkflowStepDependencyBinding[];
}

export interface BackboneVersionManifest {
  schemaVersion: typeof BACKBONE_SCHEMA_VERSION;
  modelKnowledgeVersion: typeof BACKBONE_MODEL_KB_VERSION;
  routingPolicyVersion: typeof BACKBONE_ROUTING_POLICY_VERSION;
}

export interface BackboneDurableWorkflowRunContract {
  workflowId: string;
  status: BackboneWorkflowStatus;
  backbone: BackboneVersionManifest;
  title?: string;
  input: Record<string, unknown>;
  steps: BackboneDurableWorkflowPlanStep[];
  events: unknown[];
  artifacts: unknown[];
  lease?: {
    leaseId: string;
    ownerId: string;
    acquiredAt: string;
    heartbeatAt: string;
    expiresAt: string;
  };
  recovery?: {
    resumeCount: number;
    lastResumeAt?: string;
    lastRecoveredAt?: string;
    reason?: string;
  };
  quality?: {
    postflightAudits?: unknown[];
  };
  timestamps: {
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
  };
}

export interface BackboneDurableWorkflowStepInput {
  id?: string;
  toolName: BackboneDurableHostedStepToolName;
  arguments: Record<string, unknown>;
  dependsOn?: BackboneWorkflowStepDependencyBinding[];
}

export interface BackboneDurableWorkflowInput {
  title?: string;
  steps: BackboneDurableWorkflowStepInput[];
  mediaReferences?: unknown[];
}

// ---------------------------------------------------------------------------
// Pure normalizer / constructor (Phase 8 Path C)
//
// `BACKBONE_VERSIONS`, `normalizeBackboneDurableWorkflowSteps`, and
// `buildBackboneDurableWorkflowRun` were moved here from `backbone/index.ts`
// so PUBLIC-bucket `runtime/durableWorkflowClient.ts` can call them
// without crossing into PRIVATE `backbone/`. They operate purely over the
// already-public types above and have no further backbone dependencies.
// Re-exported from `backbone/index.ts` for back-compat with existing
// private consumers.
// ---------------------------------------------------------------------------

export const BACKBONE_VERSIONS: BackboneVersionManifest = {
  schemaVersion: BACKBONE_SCHEMA_VERSION,
  modelKnowledgeVersion: BACKBONE_MODEL_KB_VERSION,
  routingPolicyVersion: BACKBONE_ROUTING_POLICY_VERSION,
};

export class BackboneWorkflowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackboneWorkflowValidationError";
  }
}

export const MAX_HOSTED_TOOL_SEQUENCE_STEPS = 12;
const HOSTED_TOOL_NAME_SET = new Set<string>(BACKBONE_DURABLE_HOSTED_STEP_TOOL_NAMES);

function safeStepId(value: string, fallback: string): string {
  const safe = value
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .replace(/_+/g, "_");
  return safe.length > 0 ? safe : fallback;
}

function compactRecord(
  entries: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(entries).filter(([, value]) => value !== undefined),
  );
}

export function normalizeBackboneDurableWorkflowSteps(
  input: BackboneDurableWorkflowInput,
): BackboneDurableWorkflowPlanStep[] {
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    throw new BackboneWorkflowValidationError(
      "Durable workflow requires at least one step",
    );
  }
  if (input.steps.length > MAX_HOSTED_TOOL_SEQUENCE_STEPS) {
    throw new BackboneWorkflowValidationError(
      `Durable workflow supports at most ${MAX_HOSTED_TOOL_SEQUENCE_STEPS} steps`,
    );
  }

  const seenIds = new Set<string>();
  return input.steps.map((step, index) => {
    if (!HOSTED_TOOL_NAME_SET.has(step.toolName)) {
      throw new BackboneWorkflowValidationError(
        `Unsupported hosted tool: ${step.toolName}`,
      );
    }
    if (
      !step.arguments ||
      typeof step.arguments !== "object" ||
      Array.isArray(step.arguments)
    ) {
      throw new BackboneWorkflowValidationError(
        `Workflow step ${index} requires object arguments`,
      );
    }

    let id = safeStepId(step.id ?? step.toolName, `step_${index + 1}`);
    if (seenIds.has(id)) {
      id = `${id}_${index + 1}`;
    }
    seenIds.add(id);

    return {
      id,
      sequence: index,
      toolName: step.toolName,
      arguments: step.arguments,
      ...(step.dependsOn ? { dependsOn: step.dependsOn } : {}),
    };
  });
}

export function buildBackboneDurableWorkflowRun(
  input: BackboneDurableWorkflowInput,
  options: { workflowId: string; now?: string; title?: string },
): BackboneDurableWorkflowRunContract {
  const now = options.now ?? new Date().toISOString();
  const steps = normalizeBackboneDurableWorkflowSteps(input);
  return {
    workflowId: options.workflowId,
    status: "queued",
    backbone: BACKBONE_VERSIONS,
    title: options.title ?? input.title ?? "Durable creative workflow",
    input: compactRecord({
      title: input.title,
      mediaReferences: input.mediaReferences,
      steps: steps.map((step) => ({
        id: step.id,
        toolName: step.toolName,
        arguments: step.arguments,
        ...(step.dependsOn ? { dependsOn: step.dependsOn } : {}),
      })),
    }),
    steps,
    events: [],
    artifacts: [],
    timestamps: {
      createdAt: now,
      updatedAt: now,
    },
  };
}
