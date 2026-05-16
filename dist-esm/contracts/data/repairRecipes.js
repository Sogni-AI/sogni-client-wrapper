import { MEDIA_TOOL_NAMES } from './gatingPolicies.js';
const ASSET_CONSUMING_TOOLS = [
    ...MEDIA_TOOL_NAMES,
    'analyze_image',
    'analyze_video',
    'extract_metadata',
];
const SAFETY_FILTERED_TOOLS = [
    'generate_image',
    'edit_image',
    'restore_photo',
    'apply_style',
    'refine_result',
    'animate_photo',
    'generate_video',
    'sound_to_video',
    'video_to_video',
    'generate_music',
];
const SPECIFIC_RECIPES = [
    {
        recipeId: 'extend_video.duration_clamp',
        version: '1.0.0',
        toolName: 'extend_video',
        errorCode: 'PARAMETER_INVALID',
        mode: 'autoRepair',
        maxRetries: 1,
        repairNoteTemplate: 'Seedance video segments cap at 15s; adjusted duration from {{requested}}s to {{clamped}}s.',
        autoRepairFields: ['duration'],
    },
    {
        recipeId: 'animate_photo.all_failed',
        version: '1.0.0',
        toolName: 'animate_photo',
        errorCode: 'GPU_WORKER_FAILED',
        mode: 'stopAndAsk',
        maxRetries: 0,
        repairNoteTemplate: 'All animation attempts failed. Want to try a different photo or rewrite the motion prompt?',
    },
    {
        recipeId: 'replace_video_segment.window_invalid',
        version: '1.0.0',
        toolName: 'replace_video_segment',
        errorCode: 'PARAMETER_INVALID',
        mode: 'stopAndAsk',
        maxRetries: 0,
        repairNoteTemplate: 'replace_video_segment needs a valid replacement window. {{message}} Please provide a shorter explicit start and end time, for example "replace 5s to 9s" or "redo the last 4 seconds."',
    },
];
function makeUserInputIncompleteRecipe(toolName) {
    return {
        recipeId: `${toolName}.user_input_incomplete`,
        version: '1.0.0',
        toolName,
        errorCode: 'USER_INPUT_INCOMPLETE',
        mode: 'stopAndAsk',
        maxRetries: 0,
        repairNoteTemplate: 'I need more details before I can run {{toolName}}. {{missingDetail}}',
    };
}
function makeCostLimitExceededRecipe(toolName) {
    return {
        recipeId: `${toolName}.cost_limit_exceeded`,
        version: '1.0.0',
        toolName,
        errorCode: 'COST_LIMIT_EXCEEDED',
        mode: 'stopAndAsk',
        maxRetries: 0,
        repairNoteTemplate: 'You have hit the credit limit for this turn. Top up credits or wait for the daily refill.',
    };
}
function makeAssetNotFoundRecipe(toolName) {
    return {
        recipeId: `${toolName}.asset_not_found`,
        version: '1.0.0',
        toolName,
        errorCode: 'ASSET_NOT_FOUND',
        mode: 'stopAndAsk',
        maxRetries: 0,
        repairNoteTemplate: 'I cannot find the asset that {{toolName}} needs. {{message}} Which uploaded or generated asset did you want?',
    };
}
function makeWorkflowValidationFailedRecipe(toolName) {
    return {
        recipeId: `${toolName}.workflow_validation_failed`,
        version: '1.0.0',
        toolName,
        errorCode: 'WORKFLOW_VALIDATION_FAILED',
        mode: 'stopAndAsk',
        maxRetries: 0,
        repairNoteTemplate: '{{toolName}} could not run: {{message}}',
    };
}
function makeParameterInvalidRecipe(toolName) {
    return {
        recipeId: `${toolName}.parameter_invalid`,
        version: '1.0.0',
        toolName,
        errorCode: 'PARAMETER_INVALID',
        mode: 'stopAndAsk',
        maxRetries: 0,
        repairNoteTemplate: '{{toolName}} rejected the arguments: {{message}}',
    };
}
function makeGpuWorkerFailedRecipe(toolName) {
    return {
        recipeId: `${toolName}.gpu_worker_failed`,
        version: '1.0.0',
        toolName,
        errorCode: 'GPU_WORKER_FAILED',
        mode: 'stopAndAsk',
        maxRetries: 0,
        repairNoteTemplate: 'The {{toolName}} worker failed. {{message}} Want me to try again or change the request?',
    };
}
function makeModelUnavailableRecipe(toolName) {
    return {
        recipeId: `${toolName}.model_unavailable`,
        version: '1.0.0',
        toolName,
        errorCode: 'MODEL_UNAVAILABLE',
        mode: 'stopAndAsk',
        maxRetries: 0,
        repairNoteTemplate: 'The model {{toolName}} wanted is offline. {{message}} Pick a different model or try again later.',
    };
}
function makePermissionRequiredRecipe(toolName) {
    return {
        recipeId: `${toolName}.permission_required`,
        version: '1.0.0',
        toolName,
        errorCode: 'PERMISSION_REQUIRED',
        mode: 'stopAndAsk',
        maxRetries: 0,
        repairNoteTemplate: '{{toolName}} needs permission you have not granted yet. {{message}}',
    };
}
function makeSafetyRejectedRecipe(toolName) {
    return {
        recipeId: `${toolName}.safety_rewrite`,
        version: '1.0.0',
        toolName,
        errorCode: 'SAFETY_REJECTED',
        mode: 'suggestFollowup',
        maxRetries: 1,
        repairNoteTemplate: 'Content filter rejected the prompt for {{toolName}}. Try a softer phrasing or different scene.',
        suggestedFollowupTool: toolName,
    };
}
function makeProviderTimeoutRecipe(toolName) {
    return {
        recipeId: `${toolName}.provider_timeout`,
        version: '1.0.0',
        toolName,
        errorCode: 'PROVIDER_TIMEOUT',
        mode: 'stopAndAsk',
        maxRetries: 0,
        repairNoteTemplate: '{{toolName}} timed out. {{message}} Want me to retry, or simplify the request?',
    };
}
function makeUserCancelledRecipe(toolName) {
    return {
        recipeId: `${toolName}.user_cancelled`,
        version: '1.0.0',
        toolName,
        errorCode: 'USER_CANCELLED',
        mode: 'stopAndAsk',
        maxRetries: 0,
        repairNoteTemplate: 'The {{toolName}} run was cancelled by the user. I will stop here unless you ask me to try again.',
    };
}
const PARAMETER_INVALID_TOOLS = MEDIA_TOOL_NAMES.filter((name) => name !== 'extend_video' && name !== 'replace_video_segment');
const GPU_WORKER_FAILED_TOOLS = MEDIA_TOOL_NAMES.filter((name) => name !== 'animate_photo');
export const PHASE_4_REPAIR_RECIPES = [
    ...SPECIFIC_RECIPES,
    ...MEDIA_TOOL_NAMES.map(makeUserInputIncompleteRecipe),
    ...MEDIA_TOOL_NAMES.map(makeCostLimitExceededRecipe),
    ...ASSET_CONSUMING_TOOLS.map(makeAssetNotFoundRecipe),
    ...MEDIA_TOOL_NAMES.map(makeWorkflowValidationFailedRecipe),
    ...PARAMETER_INVALID_TOOLS.map(makeParameterInvalidRecipe),
    ...GPU_WORKER_FAILED_TOOLS.map(makeGpuWorkerFailedRecipe),
    ...MEDIA_TOOL_NAMES.map(makeModelUnavailableRecipe),
    ...MEDIA_TOOL_NAMES.map(makePermissionRequiredRecipe),
    ...SAFETY_FILTERED_TOOLS.map(makeSafetyRejectedRecipe),
    ...MEDIA_TOOL_NAMES.map(makeProviderTimeoutRecipe),
    ...MEDIA_TOOL_NAMES.map(makeUserCancelledRecipe),
];
export function populateContractsRepairRecipes(registry) {
    for (const recipe of PHASE_4_REPAIR_RECIPES) {
        registry.registerRepairRecipe(recipe);
    }
}
//# sourceMappingURL=repairRecipes.js.map