import { getRandomLyricsTheme, getRandomTheme } from './randomThemes.js';
export const HOSTED_COMPOSITION_ROUTER_MAX_TOKENS = 512;
export function buildEnhancePromptToolArgs(input) {
    return {
        prompt: input.prompt.trim() || `Come up with a unique, creative image inspired by: ${input.randomTheme || getRandomTheme()}. Be original and surprising.`,
        target_output: input.targetOutput ?? 'image_prompt',
        destination_tool: input.destinationTool ?? 'generate_image',
        ...(input.destinationModel ? { destination_model: input.destinationModel } : {}),
        ...(input.promptingType ? { prompting_type: input.promptingType } : {}),
        ...(input.modelTitle ? { model_title: input.modelTitle } : {}),
        ...(input.stylePrompt?.trim() ? { style_prompt: input.stylePrompt.trim() } : {}),
    };
}
export function buildLyricsCompositionToolArgs(input) {
    return {
        prompt: input.prompt.trim() || `Come up with a unique, original song about: ${input.randomTheme || getRandomLyricsTheme()}. Be creative and surprising.`,
        language: input.language ?? 'unknown',
        ...(input.musicPrompt?.trim() ? { music_prompt: input.musicPrompt.trim() } : {}),
    };
}
export function buildInstrumentalCompositionToolArgs(input) {
    return {
        prompt: input.prompt.trim() || `Come up with a unique, original instrumental piece inspired by: ${input.randomTheme || getRandomLyricsTheme()}. Be creative and surprising.`,
        ...(input.musicPrompt?.trim() ? { music_prompt: input.musicPrompt.trim() } : {}),
    };
}
export function buildScriptCompositionToolArgs(input) {
    const brief = input.brief ?? input.prompt ?? '';
    return {
        brief: brief.trim() || input.firstFrameDescription?.trim() || `Come up with a unique, original video scene inspired by: ${input.randomTheme || getRandomTheme()}. Be creative and surprising.`,
        script_type: input.scriptType ?? 'video_prompt',
        destination_tool: input.destinationTool ?? 'generate_video',
        ...(input.destinationModel ? { destination_model: input.destinationModel } : {}),
        ...(input.durationSeconds ? { duration_seconds: input.durationSeconds } : {}),
        ...(input.firstFrameDescription?.trim()
            ? { first_frame_description: input.firstFrameDescription.trim() }
            : {}),
        ...(input.firstFrameDataUrl ? { first_frame_data_url: input.firstFrameDataUrl } : {}),
        ...(input.lastFrameDataUrl ? { last_frame_data_url: input.lastFrameDataUrl } : {}),
    };
}
export function buildComposeWorkflowToolArgs(input) {
    const destinationModels = input.destinationModels ? {
        ...(input.destinationModels.image ? { image: input.destinationModels.image } : {}),
        ...(input.destinationModels.video ? { video: input.destinationModels.video } : {}),
        ...(input.destinationModels.music ? { music: input.destinationModels.music } : {}),
    } : undefined;
    return {
        brief: input.brief.trim(),
        ...(typeof input.sceneCount === 'number' && Number.isFinite(input.sceneCount)
            ? { scene_count: input.sceneCount }
            : {}),
        ...(typeof input.durationSeconds === 'number' && Number.isFinite(input.durationSeconds)
            ? { duration_seconds: input.durationSeconds }
            : {}),
        ...(input.aspectRatio?.trim() ? { aspect_ratio: input.aspectRatio.trim() } : {}),
        ...(input.style?.trim() ? { style: input.style.trim() } : {}),
        ...(destinationModels && Object.keys(destinationModels).length > 0
            ? { destination_models: destinationModels }
            : {}),
        ...(typeof input.maxEstimatedCapacityUnits === 'number'
            && Number.isFinite(input.maxEstimatedCapacityUnits)
            ? { max_estimated_capacity_units: input.maxEstimatedCapacityUnits }
            : {}),
        ...(typeof input.includeAudio === 'boolean' ? { include_audio: input.includeAudio } : {}),
        ...(input.returnFormat ? { return_format: input.returnFormat } : {}),
    };
}
export function buildComposeWorkflowTemplateToolArgs(input) {
    const base = buildComposeWorkflowToolArgs(input);
    const out = { ...base, name: input.name.trim() };
    const description = input.description?.trim();
    if (description)
        out.description = description;
    if (input.category)
        out.category = input.category;
    if (input.visibility)
        out.visibility = input.visibility;
    if (input.inputs && input.inputs.length > 0) {
        out.inputs = input.inputs.map((decl) => {
            const entry = { name: decl.name, type: decl.type };
            if (decl.required !== undefined)
                entry.required = decl.required;
            if (decl.description?.trim())
                entry.description = decl.description.trim();
            if (decl.default !== undefined)
                entry.default = decl.default;
            if (decl.options && decl.options.length > 0)
                entry.options = decl.options;
            if (decl.multiple)
                entry.multiple = decl.multiple;
            if (decl.internal !== undefined)
                entry.internal = decl.internal;
            return entry;
        });
    }
    if (input.existingTemplate) {
        out.existing_template = input.existingTemplate;
    }
    return out;
}
export function buildWanScriptCompositionToolArgs(params) {
    return buildScriptCompositionToolArgs({
        brief: params.prompt,
        destinationModel: 'wan22',
        durationSeconds: params.duration,
        firstFrameDescription: params.firstFrameDescription,
        firstFrameDataUrl: params.firstFrameDataUrl,
        lastFrameDataUrl: params.lastFrameDataUrl,
        randomTheme: params.randomTheme,
    });
}
export function buildHostedCompositionToolMessages(request) {
    return [
        {
            role: 'system',
            content: 'You are a strict dispatcher for Sogni synchronous creative tools. Call the requested tool exactly once with the exact JSON arguments supplied by the user. Do not rewrite, summarize, or add creative content in this dispatch step.',
        },
        {
            role: 'user',
            content: JSON.stringify({
                tool: request.toolName,
                arguments: request.arguments,
            }),
        },
    ];
}
//# sourceMappingURL=hostedComposition.js.map