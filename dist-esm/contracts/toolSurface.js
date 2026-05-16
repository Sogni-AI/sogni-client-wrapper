import { classifyTurn, compileToolsForTurn, } from './evaluators.js';
export const DEFAULT_CONTRACT_CONTEXT_PREFIX = 'Sogni Creative Agent tool policy for this turn:';
export function normalizeContractMessages(messages) {
    return messages.map((message) => ({
        role: message.role,
        content: contractMessageContentToText(message.content),
    }));
}
export function buildContractTurnPolicy(input) {
    return classifyTurn({
        messages: normalizeContractMessages(input.messages ?? []),
        assetManifest: input.assetManifest ?? { items: [] },
        sessionState: {
            hasGeneratedVideo: false,
            hasUploadedVideo: false,
            repairCount: 0,
            ...input.sessionState,
        },
        availableTools: input.availableTools,
        registry: input.registry,
        signals: input.signals ?? [],
        telemetry: input.telemetry,
    });
}
export function compileContractToolSurface(input) {
    const definitions = input.tools.map(normalizeContractToolDefinition);
    const availableTools = definitions.map((tool) => tool.function.name);
    const turnPolicy = input.turnPolicy
        ? turnPolicyWithDefaultVisibleTools(input.turnPolicy, availableTools)
        : buildContractTurnPolicy({
            availableTools,
            registry: input.registry,
            messages: input.messages,
            assetManifest: input.assetManifest,
            sessionState: input.sessionState,
            signals: input.signals,
            telemetry: input.telemetry,
        });
    const compiled = compileToolsForTurn({
        turnPolicy,
        registry: input.registry,
        availableToolDefinitions: definitions,
        telemetry: input.telemetry,
    });
    return {
        ...compiled,
        turnPolicy,
    };
}
export function formatContractsContextBlock(contextBlock, prefix = DEFAULT_CONTRACT_CONTEXT_PREFIX) {
    const trimmed = contextBlock.trim();
    if (!trimmed)
        return '';
    return `${prefix}\n${trimmed}`;
}
export function appendContractsContextToSystemContent(systemContent, contextBlock) {
    const formatted = formatContractsContextBlock(contextBlock);
    return formatted ? `${systemContent}\n\n${formatted}` : systemContent;
}
export function reconcileToolChoiceForCompiledTools(toolChoice, tools) {
    if (!toolChoice)
        return toolChoice;
    if (tools.length === 0)
        return undefined;
    if (typeof toolChoice !== 'object' || toolChoice.type !== 'function')
        return toolChoice;
    const forcedToolName = toolChoice.function.name;
    const isStillVisible = tools.some((tool) => tool.function.name === forcedToolName);
    return isStillVisible ? toolChoice : 'auto';
}
function contractMessageContentToText(content) {
    if (typeof content === 'string')
        return content;
    if (!Array.isArray(content))
        return '';
    return content
        .map((part) => {
        if (part && typeof part === 'object' && 'text' in part) {
            const text = part.text;
            return typeof text === 'string' ? text : '';
        }
        return '';
    })
        .filter(Boolean)
        .join(' ');
}
function normalizeContractToolDefinition(tool) {
    return {
        type: 'function',
        function: {
            name: tool.function.name,
            description: tool.function.description ?? '',
            parameters: tool.function.parameters ?? { type: 'object', properties: {} },
        },
    };
}
function turnPolicyWithDefaultVisibleTools(turnPolicy, availableTools) {
    if (turnPolicy.visibleTools.length > 0
        || turnPolicy.forbiddenTools.length > 0
        || turnPolicy.requiredTools.length > 0
        || turnPolicy.appliedPolicies.length > 0
        || turnPolicy.rationale) {
        return turnPolicy;
    }
    return {
        ...turnPolicy,
        visibleTools: [...availableTools],
    };
}
//# sourceMappingURL=toolSurface.js.map