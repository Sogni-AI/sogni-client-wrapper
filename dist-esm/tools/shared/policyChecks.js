export function checkPersonaPolicy(toolName, args, state) {
    const promptText = String(args.prompt || '').toLowerCase();
    if (toolName === 'generate_image' && state.hasPersonaPhotos) {
        return {
            allowed: true,
            redirectTo: 'edit_image',
            explanation: 'Redirecting generate_image → edit_image: persona photos require edit_image for identity preservation',
        };
    }
    if (toolName !== 'resolve_personas'
        && state.personaNames.length > 0
        && !state.hasPersonaPhotos
        && state.personaNames.some((name) => promptText.includes(name.toLowerCase()))) {
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
export function checkQuestionSuppression(responseText, hasToolCalls) {
    if (!hasToolCalls)
        return { allowed: true };
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
const TOOL_PREREQUISITES = {
    edit_image: [
        {
            requires: 'resolve_personas',
            condition: 'When prompt references personas that have not been resolved',
            check: (state) => state.personaNames.length > 0 && !state.hasPersonaPhotos,
        },
    ],
};
export function checkPrerequisites(toolName, state) {
    const prereqs = TOOL_PREREQUISITES[toolName];
    if (!prereqs)
        return { allowed: true };
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
export function runPolicyChecks(toolName, args, state) {
    const personaCheck = checkPersonaPolicy(toolName, args, state);
    if (!personaCheck.allowed || personaCheck.redirectTo)
        return personaCheck;
    const prereqCheck = checkPrerequisites(toolName, state);
    if (!prereqCheck.allowed)
        return prereqCheck;
    return { allowed: true };
}
//# sourceMappingURL=policyChecks.js.map