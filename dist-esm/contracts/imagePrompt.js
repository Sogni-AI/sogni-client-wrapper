import { getRandomTheme } from './randomThemes.js';
export const IMAGE_PROMPT_MAX_TOKENS = 1024;
const FLUX_GUIDE = `FLUX & Next-Gen models use natural language descriptions, not keyword lists.
- Write flowing, descriptive prose: subject, environment, lighting, mood.
- Be specific about what you want rather than using abstract quality boosters.
- You can mix descriptive phrases with comma-separated keywords, but lean toward sentences.
- Camera/lens terms and lighting descriptions work well.
- Keep guidance context in mind: these models use very low guidance (1-5), so prompts should be clear and direct.`;
const SDXL_GUIDE = `SDXL models work well with a hybrid approach: natural language descriptions combined with comma-separated quality/style keywords.
Prompt structure (in this order):
1. Subject — what/who is in the image
2. Details — appearance, clothing, expression, pose
3. Environment — setting, background, time of day
4. Lighting & mood — lighting setup, atmosphere
5. Quality/style boosters — technical quality keywords (e.g. "highly detailed, 8K, photorealistic")
For anime SDXL models, use danbooru-style tags: "1girl, long hair, blue eyes" with quality tags first: "masterpiece, best quality".
Camera/lens terminology helps photorealistic models: "Canon EOS R5, 85mm lens, f/1.4, shallow depth of field".`;
const SD15_GUIDE = `SD 1.5 models are most responsive to keyword/tag-based prompts. Structured comma-separated tags give the best results.
Prompt structure (in this order):
1. Quality boosters first: "RAW photo, best quality, masterpiece, highly detailed"
2. Subject description
3. Environment/setting
4. Style/medium: "watercolor, oil painting, digital art, photograph"
5. Lighting/camera: "studio lighting, golden hour, Fujifilm XT3, 85mm"
For photorealistic: start with "RAW photo" or "photograph", include camera references and film grain.
For anime: use danbooru tags "1girl, solo, long_hair", quality tags first "masterpiece, best quality", higher guidance (8-14).
Keep prompts keyword-rich rather than conversational.`;
const PONY_GUIDE = `Pony Diffusion models use a unique score-based tag system for quality control.
Add score tags at the BEGINNING of the prompt:
- Full range: "score_9, score_8_up, score_7_up, score_6_up, score_5_up, score_4_up"
- Short range: "score_9, score_8_up, score_7_up"
After score tags, describe the subject using comma-separated tags similar to SDXL.
Content rating tags are available: "rating_safe", "rating_suggestive".
The model understands character names from anime/cartoon/anthro fandoms.
Example: "score_9, score_8_up, score_7_up, punk rock singer, leather jacket, crazy hair, dynamic angle, highly detailed, film grain, 8k"`;
const FAST_GUIDE = `Turbo, Lightning, and LCM models are optimized for speed (2-7 steps). They have less capacity to process complex prompts.
- Keep prompts concise and direct — under ~50 tokens for best results.
- Focus on the core subject and one clear style direction.
- Use strong, specific descriptors.
- Don't overload with quality boosters — at very low guidance they have minimal effect.
- Don't use extremely long, multi-sentence prompts.
Example: "a majestic lion in golden savanna, sunset, cinematic"`;
const SD3_GUIDE = `SD3 has improved natural language understanding, multi-subject composition, and typography rendering.
- Write clear, descriptive natural language prompts — not keyword lists.
- You can be specific about spatial relationships: "on the left", "in the background", "above".
- Multi-subject scenes work well: describe each subject and their relationship.
- For text in images, spell out exactly what to render in quotes.
- Don't over-tag with "masterpiece, best quality" etc. — just describe what you want.
- SD3 handles complex scenes better than SD1.5/SDXL.`;
const EDITING_GUIDE = `Image editing models accept reference images alongside text prompts. The prompt acts as an instruction for how to modify or build upon the input image(s).
- Write prompts as transformation instructions referencing the existing image.
- Describe changes as transformations: "is now wearing", "now has", "the background changes to".
- You can reference elements in the image: "she", "the background", "his jacket".
- For text rendering: include text in quotes — 'Title text "SOMETHING"'.
- Short, clear instructions often work better than long detailed descriptions.
- The reference image drives the result more than the prompt.`;
const PROMPTING_GUIDES = {
    flux: FLUX_GUIDE,
    sdxl: SDXL_GUIDE,
    sd15: SD15_GUIDE,
    pony: PONY_GUIDE,
    fast: FAST_GUIDE,
    sd3: SD3_GUIDE,
    editing: EDITING_GUIDE,
    video: '',
};
function buildSystemPrompt(promptingType, modelTitle) {
    const guide = PROMPTING_GUIDES[promptingType] || PROMPTING_GUIDES.sdxl;
    return `You are an expert prompt engineer for AI image generation models. The user will give you a short idea or rough prompt. Your job is to expand and enhance it into an optimized prompt for the "${modelTitle}" model, then return it via the enhance_prompt tool.

MODEL-SPECIFIC PROMPTING GUIDE:
${guide}

RULES:
- Enhance and expand the user's idea while preserving their creative intent.
- Add vivid details: lighting, textures, atmosphere, composition, colors.
- Write the prompt in the style that best suits this model type (see guide above).
- Do NOT add negative prompt content — only write the positive prompt.
- If the user provides a style context, complement it — don't repeat or contradict it.
- Keep the result focused: one coherent scene or subject, not a list of disconnected ideas.
- Output only the prompt text — no explanations, no preamble.`;
}
export const IMAGE_PROMPT_TOOL = {
    type: 'function',
    function: {
        name: 'enhance_prompt',
        description: 'Output the enhanced image generation prompt',
        parameters: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: 'The enhanced image generation prompt optimized for the target model',
                },
            },
            required: ['prompt'],
        },
    },
};
function normalizeBuildImagePromptInput(inputOrPrompt, stylePrompt = '', promptingType = 'sdxl', modelTitle = 'Unknown Model') {
    if (typeof inputOrPrompt === 'string') {
        return {
            prompt: inputOrPrompt,
            stylePrompt,
            promptingType,
            modelTitle,
            randomTheme: '',
        };
    }
    return {
        prompt: inputOrPrompt.prompt,
        stylePrompt: inputOrPrompt.stylePrompt ?? '',
        promptingType: inputOrPrompt.promptingType ?? 'sdxl',
        modelTitle: inputOrPrompt.modelTitle ?? 'Unknown Model',
        randomTheme: inputOrPrompt.randomTheme ?? '',
    };
}
export function buildImagePromptMessages(inputOrPrompt, stylePrompt = '', promptingType = 'sdxl', modelTitle = 'Unknown Model') {
    const input = normalizeBuildImagePromptInput(inputOrPrompt, stylePrompt, promptingType, modelTitle);
    const messages = [
        { role: 'system', content: buildSystemPrompt(input.promptingType, input.modelTitle) },
    ];
    let userMessage;
    if (input.prompt.trim()) {
        userMessage = input.prompt;
        if (input.stylePrompt) {
            userMessage += `\n\nCurrent style context (complement this, don't repeat): ${input.stylePrompt}`;
        }
    }
    else {
        const theme = input.randomTheme || getRandomTheme();
        userMessage = `Come up with a unique, creative image inspired by: ${theme}. Be original and surprising — avoid clichés.`;
        if (input.stylePrompt) {
            userMessage += `\n\nUse this style as inspiration: ${input.stylePrompt}`;
        }
    }
    messages.push({ role: 'user', content: userMessage });
    return messages;
}
export function parseToolCallPrompt(args) {
    return String(args.prompt || '').trim();
}
//# sourceMappingURL=imagePrompt.js.map