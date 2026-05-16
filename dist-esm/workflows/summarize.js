const DEFAULT_MAX_LENGTH = 320;
export function summarizeWorkflowTemplate(template, options = {}) {
    const maxLength = options.maxDescriptionLength ?? DEFAULT_MAX_LENGTH;
    const includeInputs = options.includeInputsSentence ?? true;
    const base = template.description?.trim() || template.name.trim();
    const inputsSentence = includeInputs ? buildInputsSentence(template.inputs) : '';
    const stagesSentence = buildStagesSentence(template);
    const parts = [base, stagesSentence, inputsSentence].filter((part) => part.length > 0);
    const merged = parts.join(' ');
    return truncateOnBoundary(merged, maxLength);
}
function buildStagesSentence(template) {
    const stageCount = template.stages.length;
    if (stageCount === 0)
        return '';
    const interactiveCount = template.stages.filter((stage) => stage.type === 'interactive').length;
    const batchCount = template.stages.filter((stage) => stage.type === 'batch').length;
    const fragments = [`${stageCount} ${stageCount === 1 ? 'stage' : 'stages'}`];
    if (batchCount > 0)
        fragments.push(`${batchCount} batch`);
    if (interactiveCount > 0)
        fragments.push(`${interactiveCount} interactive`);
    return `(${fragments.join(', ')}).`;
}
function buildInputsSentence(inputs) {
    const declared = inputs.filter((input) => !input.internal);
    if (declared.length === 0)
        return 'No inputs required.';
    const requiredNames = declared
        .filter((input) => input.required)
        .map((input) => `${input.name} (${input.type})`);
    const optionalNames = declared
        .filter((input) => !input.required)
        .map((input) => `${input.name} (${input.type})`);
    const parts = [];
    if (requiredNames.length > 0)
        parts.push(`Required inputs: ${requiredNames.join(', ')}.`);
    if (optionalNames.length > 0)
        parts.push(`Optional inputs: ${optionalNames.join(', ')}.`);
    return parts.join(' ');
}
function truncateOnBoundary(text, maxLength) {
    if (text.length <= maxLength)
        return text;
    const slice = text.slice(0, maxLength);
    const lastSpace = slice.lastIndexOf(' ');
    if (lastSpace <= 0)
        return `${slice.trimEnd()}…`;
    return `${slice.slice(0, lastSpace).trimEnd()}…`;
}
//# sourceMappingURL=summarize.js.map