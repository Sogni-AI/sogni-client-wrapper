import { BACKBONE_DURABLE_HOSTED_CREATIVE_TOOL_NAMES, BACKBONE_HOSTED_APP_TOOL_NAMES, } from "./backboneToolCatalog.js";
export const BACKBONE_SCHEMA_VERSION = "2026-04-27.1";
export const BACKBONE_MODEL_KB_VERSION = "2026-04-27.2";
export const BACKBONE_ROUTING_POLICY_VERSION = "2026-04-27.1";
export const BACKBONE_DURABLE_HOSTED_STEP_TOOL_NAMES = [
    ...BACKBONE_DURABLE_HOSTED_CREATIVE_TOOL_NAMES,
    ...BACKBONE_HOSTED_APP_TOOL_NAMES,
];
export const BACKBONE_VERSIONS = {
    schemaVersion: BACKBONE_SCHEMA_VERSION,
    modelKnowledgeVersion: BACKBONE_MODEL_KB_VERSION,
    routingPolicyVersion: BACKBONE_ROUTING_POLICY_VERSION,
};
export class BackboneWorkflowValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "BackboneWorkflowValidationError";
    }
}
export const MAX_HOSTED_TOOL_SEQUENCE_STEPS = 12;
const HOSTED_TOOL_NAME_SET = new Set(BACKBONE_DURABLE_HOSTED_STEP_TOOL_NAMES);
function safeStepId(value, fallback) {
    const safe = value
        .trim()
        .replace(/[^A-Za-z0-9_-]/g, "_")
        .replace(/_+/g, "_");
    return safe.length > 0 ? safe : fallback;
}
function compactRecord(entries) {
    return Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined));
}
export function normalizeBackboneDurableWorkflowSteps(input) {
    if (!Array.isArray(input.steps) || input.steps.length === 0) {
        throw new BackboneWorkflowValidationError("Durable workflow requires at least one step");
    }
    if (input.steps.length > MAX_HOSTED_TOOL_SEQUENCE_STEPS) {
        throw new BackboneWorkflowValidationError(`Durable workflow supports at most ${MAX_HOSTED_TOOL_SEQUENCE_STEPS} steps`);
    }
    const seenIds = new Set();
    return input.steps.map((step, index) => {
        if (!HOSTED_TOOL_NAME_SET.has(step.toolName)) {
            throw new BackboneWorkflowValidationError(`Unsupported hosted tool: ${step.toolName}`);
        }
        if (!step.arguments ||
            typeof step.arguments !== "object" ||
            Array.isArray(step.arguments)) {
            throw new BackboneWorkflowValidationError(`Workflow step ${index} requires object arguments`);
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
export function buildBackboneDurableWorkflowRun(input, options) {
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
//# sourceMappingURL=backboneDurableWorkflow.js.map