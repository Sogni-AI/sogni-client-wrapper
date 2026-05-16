import { BACKBONE_APP_TOOL_NAMES, BACKBONE_COMPOSITION_TOOL_NAMES, BACKBONE_DURABLE_HOSTED_CREATIVE_TOOL_NAMES, BACKBONE_GENERATION_TOOL_NAMES, BACKBONE_HOSTED_APP_TOOL_NAMES, } from '../backboneToolCatalog.js';
import { PHASE_5_PROMPT_CONTRACTS } from './promptContracts.js';
import { TOOL_COST_METADATA, getToolCostMetadata } from './toolCostMetadata.js';
const PROMPT_CONTRACT_TOOL_NAMES = new Set(PHASE_5_PROMPT_CONTRACTS.map((contract) => contract.toolName));
const BACKBONE_APP_TOOL_NAME_SET = new Set(BACKBONE_APP_TOOL_NAMES);
const BACKBONE_COMPOSITION_TOOL_NAME_SET = new Set(BACKBONE_COMPOSITION_TOOL_NAMES);
const BACKBONE_GENERATION_TOOL_NAME_SET = new Set(BACKBONE_GENERATION_TOOL_NAMES);
const BACKBONE_HOSTED_APP_TOOL_NAME_SET = new Set(BACKBONE_HOSTED_APP_TOOL_NAMES);
const BACKBONE_DURABLE_HOSTED_CREATIVE_TOOL_NAME_SET = new Set(BACKBONE_DURABLE_HOSTED_CREATIVE_TOOL_NAMES);
const CREATIVE_TOOLS_APP_TOOL_NAME_SET = new Set([
    'analyze_image',
    'analyze_video',
    'extract_metadata',
]);
function promptContractStatusFor(tool, family) {
    if (PROMPT_CONTRACT_TOOL_NAMES.has(tool))
        return 'present';
    if (family === 'chat_tool_registry' || family === 'backbone_composition')
        return 'not_required';
    return 'missing';
}
function makeEntry(args) {
    const costMetadataTool = args.costMetadataTool ?? args.tool;
    const costMetadata = getToolCostMetadata(costMetadataTool);
    const promptContractTool = args.promptContractTool ?? args.tool;
    const promptContractStatus = promptContractStatusFor(promptContractTool, args.family);
    return {
        tool: args.tool,
        family: args.family,
        definitionSource: args.definitionSource,
        hostedApiSurface: args.hostedApiSurface,
        apiExecutorSupport: args.apiExecutorSupport,
        workflowEligibility: args.workflowEligibility,
        costMetadataTool,
        costMetadataStatus: costMetadata ? 'present' : 'missing',
        promptContractTool,
        promptContractStatus,
        costMetadata,
    };
}
const BACKBONE_GENERATION_CATALOG_ENTRIES = BACKBONE_GENERATION_TOOL_NAMES.map((tool) => makeEntry({
    tool,
    family: 'backbone_generation',
    definitionSource: 'backbone/openai-tools/generation-tools.json',
    hostedApiSurface: 'creative-tools',
    apiExecutorSupport: 'implemented',
    workflowEligibility: BACKBONE_DURABLE_HOSTED_CREATIVE_TOOL_NAME_SET.has(tool)
        ? 'durable_hosted_step'
        : 'direct_hosted_execution',
}));
const BACKBONE_APP_CATALOG_ENTRIES = BACKBONE_APP_TOOL_NAMES.map((tool) => makeEntry({
    tool,
    family: 'backbone_app',
    definitionSource: BACKBONE_HOSTED_APP_TOOL_NAME_SET.has(tool)
        ? 'backbone/openai-tools/app-tools.json'
        : 'backbone/app-tool-names',
    hostedApiSurface: CREATIVE_TOOLS_APP_TOOL_NAME_SET.has(tool)
        ? 'creative-tools'
        : BACKBONE_HOSTED_APP_TOOL_NAME_SET.has(tool) ? 'creative-agent' : 'none',
    apiExecutorSupport: BACKBONE_HOSTED_APP_TOOL_NAME_SET.has(tool) ? 'implemented' : 'not_applicable',
    workflowEligibility: BACKBONE_HOSTED_APP_TOOL_NAME_SET.has(tool)
        ? 'durable_hosted_step'
        : 'not_eligible',
}));
const CREATIVE_AGENT_ONLY_COMPOSITION_TOOLS = new Set([
    'compose_workflow',
    'compose_workflow_template',
]);
const BACKBONE_COMPOSITION_CATALOG_ENTRIES = BACKBONE_COMPOSITION_TOOL_NAMES.map((tool) => makeEntry({
    tool,
    family: 'backbone_composition',
    definitionSource: 'backbone/openai-tools/composition-tools.json',
    hostedApiSurface: CREATIVE_AGENT_ONLY_COMPOSITION_TOOLS.has(tool)
        ? 'creative-agent'
        : 'creative-tools',
    apiExecutorSupport: 'implemented',
    workflowEligibility: 'direct_hosted_execution',
}));
const EXTRA_COST_METADATA_CATALOG_ENTRIES = TOOL_COST_METADATA
    .filter((entry) => !BACKBONE_GENERATION_TOOL_NAME_SET.has(entry.tool)
    && !BACKBONE_APP_TOOL_NAME_SET.has(entry.tool)
    && !BACKBONE_COMPOSITION_TOOL_NAME_SET.has(entry.tool))
    .map((entry) => makeEntry({
    tool: entry.tool,
    family: 'chat_tool_registry',
    definitionSource: 'sogni-chat/tool-registry',
    hostedApiSurface: 'none',
    apiExecutorSupport: 'not_applicable',
    workflowEligibility: 'not_eligible',
}));
export const CANONICAL_TOOL_CATALOG = [
    ...BACKBONE_GENERATION_CATALOG_ENTRIES,
    ...BACKBONE_APP_CATALOG_ENTRIES,
    ...BACKBONE_COMPOSITION_CATALOG_ENTRIES,
    ...EXTRA_COST_METADATA_CATALOG_ENTRIES,
];
const CATALOG_ENTRY_BY_TOOL = new Map(CANONICAL_TOOL_CATALOG.map((entry) => [entry.tool, entry]));
export function getCanonicalToolCatalogEntry(toolName) {
    return CATALOG_ENTRY_BY_TOOL.get(toolName);
}
export function listCanonicalToolCatalogEntries() {
    return CANONICAL_TOOL_CATALOG;
}
export function listHostedApiToolCatalogEntries(options) {
    const requestedSurfaces = options?.surface
        ? Array.isArray(options.surface) ? options.surface : [options.surface]
        : undefined;
    const surfaces = requestedSurfaces
        ? new Set(requestedSurfaces.flatMap((surface) => surface === 'creative-agent' ? ['creative-tools', 'creative-agent'] : [surface]))
        : undefined;
    return CANONICAL_TOOL_CATALOG.filter((entry) => {
        if (entry.hostedApiSurface === 'none')
            return false;
        return surfaces ? surfaces.has(entry.hostedApiSurface) : true;
    });
}
export function listHostedApiImplementedToolNames(options) {
    return listHostedApiToolCatalogEntries(options)
        .filter((entry) => entry.apiExecutorSupport === 'implemented')
        .map((entry) => entry.tool);
}
//# sourceMappingURL=toolCatalog.js.map