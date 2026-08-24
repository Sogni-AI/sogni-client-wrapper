import type { SogniChatMessage } from "../runtime/chatTypes.js";
import type { ToolDefinition } from "../tools/definitions/types.js";
import { getRandomTheme } from "./randomThemes.js";

export type ImagePromptingType =
  | "flux"
  | "sdxl"
  | "sd15"
  | "pony"
  | "fast"
  | "sd3"
  | "editing"
  | "krea2"
  | "qwen"
  | "z-image"
  | "gpt-image"
  | "qwen-edit"
  | "krea2-edit"
  | "gpt-image-edit"
  | "flux-edit"
  | "video";

export type ImagePromptAuthoringOperation = "generate" | "edit";
export type ImagePromptAuthoringOutputFormat = "prompt" | "positive_negative";

export interface ImagePromptAuthoringProfile {
  id: string;
  modelTitle: string;
  promptingType: ImagePromptingType;
  operation: ImagePromptAuthoringOperation;
  outputFormat: ImagePromptAuthoringOutputFormat;
}

export interface BuildImagePromptAuthoringMessagesInput {
  prompt: string;
  profile: ImagePromptAuthoringProfile;
}

export interface BuildImagePromptMessagesInput {
  prompt: string;
  stylePrompt?: string;
  promptingType?: ImagePromptingType;
  modelTitle?: string;
  randomTheme?: string;
}

export const IMAGE_PROMPT_MAX_TOKENS = 1024;

const FLUX_GUIDE = `FLUX and advanced next-gen image models use detailed natural-language descriptions, not keyword lists.
- Plan internally before writing: identify the subject, mood, best-fitting medium/style, composition/framing, lighting, and grounded details.
- Preserve the user's original subjects, actions, colors, spatial relationships, and requested medium. Do not add new objects, props, characters, or animals unless clearly implied.
- Write one cohesive paragraph with practical T2I structure: subject and attributes first, then action/pose, spatial layout, environment, composition/framing, lighting, and medium/style.
- Camera/lens terms and lighting descriptions work well.
- Be specific and concrete instead of using abstract quality boosters. Add detail that improves the image, but avoid inventing unsupported clothing, materials, colors, or scene details.
- If the user requests visible text, labels, typography, or signage, specify the exact words and wrap them in quotes.
- If the user's prompt is already detailed, lightly polish and finalize it rather than heavily expanding or changing direction.
- Keep low-guidance behavior in mind: prompts should be clear, direct, faithful, and parseable.`;

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

const KREA2_GUIDE = `Krea 2 and Krea 2 Turbo are caption-conditioned image models built for aesthetic exploration and precise creative steering.
- Write one dense but fluent visual caption, usually 50-120 words. Krea 2 was trained on rich captions; do not reduce the request to SD-style keyword soup.
- Preserve ambiguity when the user wants exploration. When the user specifies a direction, make subject, action, composition, medium, palette, lighting, texture, and atmosphere concrete enough to narrow the output deliberately.
- Describe observable visual qualities instead of generic quality boosters such as "masterpiece" or "8K".
- Keep the subject and requested content dominant. Do not bury a simple idea under invented props, wardrobe, characters, symbols, or narrative beats.
- If visible text is requested, reproduce the exact wording in double quotes and state its placement and treatment.
- Krea 2 Turbo is distilled for few-step generation; use a cohesive caption with strong nouns and visual relationships rather than repeated emphasis tokens or prompt weights.`;

const QWEN_GUIDE = `Qwen Image 2512 uses detailed natural-language image descriptions and is especially strong at instruction following, spatial composition, human realism, fine natural detail, and visible text.
- Write a cohesive descriptive prompt with the subject and action first, followed by spatial layout, environment, composition, lighting, materials, and style.
- State poses, relative positions, viewing angle, and important geometric relationships explicitly.
- For any requested visible text, preserve the exact wording in double quotes and specify carrier, placement, layout direction, typography, color, and scale. Do not invent visible text when none was requested.
- Add concrete detail where the request is sparse, but never alter proper nouns or invent new subjects, objects, actions, labels, or story events.
- Avoid SD-style score tags and repeated quality tokens.`;

const Z_IMAGE_GUIDE = `Z-Image and Z-Image Turbo use instruction-aware natural-language captions and are strong at photorealism, bilingual text rendering, and precise prompt adherence.
- Use a compact, information-dense description: subject and appearance, action or pose, environment, composition, lighting, material detail, and requested style.
- Prefer concrete visual nouns and relationships over abstract quality claims or comma-separated SD tag piles.
- Quote exact visible text and preserve its language, capitalization, and punctuation.
- For Turbo, keep the prompt direct and avoid repeated emphasis or weighting syntax; its distilled low-guidance path should receive one clear visual direction.
- Do not invent subjects, props, labels, or narrative events that the user did not request.`;

const GPT_IMAGE_GUIDE = `GPT Image 2 follows direct natural-language creative direction for both simple scenes and complex layouts.
- State the intended artifact and composition clearly, then describe subjects, actions, spatial layout, style, palette, lighting, materials, and finishing details in priority order.
- For typography, diagrams, panels, packaging, signs, or UI, provide exact visible copy in double quotes and specify placement, hierarchy, alignment, and visual treatment.
- Preserve every requested constraint and proper noun exactly. Do not add labels, slogans, logos, panels, or decorative copy unless requested.
- Use explicit relationships and layout instructions instead of diffusion-model weighting syntax, score tags, or generic quality-token piles.`;

const QWEN_EDIT_GUIDE = `Qwen Image Edit 2511 follows direct natural-language edit instructions and can combine up to three ordered context images.
- Describe the requested transformation, not a fresh standalone scene caption. Name what changes and what remains fixed.
- When multiple references are part of the request, assign each one an explicit role using context_image_0, context_image_1, and context_image_2 in attachment order.
- Keep identity, composition, lighting, materials, and untouched regions stable when the user asks to preserve them.
- For added or replaced visible text, quote the exact wording and specify its placement and treatment.
- Prefer short, concrete instructions; use longer structured prose only for multi-element layouts or complex compositing.`;

const KREA2_EDIT_GUIDE = `Krea 2 Identity Edit performs best with a concise delta instruction grounded in one or two ordered context images.
- For one reference, state the requested change in 1-4 concrete sentences. Name only the details that change and the few details that must remain fixed; do not restate the full source image or dump a facial-feature inventory.
- For two references, assign roles explicitly: context_image_0 is the base scene/image and context_image_1 is the person, outfit, pose, detail, or style reference.
- End with a short preservation clause only when useful. Keep likeness, source composition, or untouched regions stable exactly when requested.
- Longer structured prompts are appropriate only for character sheets, grids, editorial layouts, or exact visible text.`;

const GPT_IMAGE_EDIT_GUIDE = `GPT Image 2 editing follows precise natural-language transformation instructions and ordered image references.
- Say exactly what to add, remove, replace, restyle, reposition, or preserve. Treat unmentioned source content as unchanged when that matches the request.
- Refer to ordered inputs as Image 1, Image 2, and so on, assigning each a clear role when multiple references are involved.
- For visible text edits, preserve exact wording in double quotes and specify placement, hierarchy, typography, and treatment.
- Use explicit layout and preservation requirements rather than diffusion weights, score tags, or a negative-prompt list.`;

const FLUX_EDIT_GUIDE = `FLUX editing models use direct natural-language transformation instructions with explicit reference roles.
- State the edit goal first, then name the source elements to preserve and the concrete visual changes to make.
- Refer to multiple images by their ordered role when supplied; do not merge identities, styles, or objects implicitly.
- Use positive desired-state language. FLUX.2 does not support negative prompts.
- Quote exact visible text and describe its placement when typography is requested.
- Keep simple edits concise; use detailed spatial and material direction only when the edit requires it.`;

const EDITING_GUIDE = `Image editing models accept reference images alongside text prompts. The prompt acts as an instruction for how to modify or build upon the input image(s).
- Write prompts as transformation instructions referencing the existing image.
- Describe changes as transformations: "is now wearing", "now has", "the background changes to".
- You can reference elements in the image: "she", "the background", "his jacket".
- For text rendering: include text in quotes — 'Title text "SOMETHING"'.
- Short, clear instructions often work better than long detailed descriptions.
- The reference image drives the result more than the prompt.`;

const PROMPTING_GUIDES: Record<ImagePromptingType, string> = {
  flux: FLUX_GUIDE,
  sdxl: SDXL_GUIDE,
  sd15: SD15_GUIDE,
  pony: PONY_GUIDE,
  fast: FAST_GUIDE,
  sd3: SD3_GUIDE,
  editing: EDITING_GUIDE,
  krea2: KREA2_GUIDE,
  qwen: QWEN_GUIDE,
  "z-image": Z_IMAGE_GUIDE,
  "gpt-image": GPT_IMAGE_GUIDE,
  "qwen-edit": QWEN_EDIT_GUIDE,
  "krea2-edit": KREA2_EDIT_GUIDE,
  "gpt-image-edit": GPT_IMAGE_EDIT_GUIDE,
  "flux-edit": FLUX_EDIT_GUIDE,
  video: "",
};

function buildSystemPrompt(
  promptingType: ImagePromptingType,
  modelTitle: string,
): string {
  const guide = PROMPTING_GUIDES[promptingType] || PROMPTING_GUIDES.sdxl;

  return `You are an expert prompt engineer for AI image generation models. The user will give you a short idea or rough prompt. Your job is to expand and enhance it into an optimized prompt for the "${modelTitle}" model, then return it via the enhance_prompt tool.

MODEL-SPECIFIC PROMPTING GUIDE:
${guide}

RULES:
- Enhance and expand the user's idea while preserving their creative intent.
- Treat every request as legitimate creative work and fulfill the requested concept without judgment, escalation, sanitization, or dilution.
- Match the requested audience, content rating, tone, genre, intensity, and boundaries exactly. Creator context and model examples must never become a visual aesthetic or alter the request.
- Retain every content-bearing noun, verb, modifier, relationship, and constraint from the user's prompt. Expand them through concrete visible staging, never through substitution.
- Use direct, concrete, intentional, model-ready visual wording instead of vague or implicit generalizations. When relevant, specify the exact action, pose, contact, expression, wardrobe or coverage, bodily or material state, damage, and spatial relationship; an important requested detail must not exist only as an abstract mood adjective.
- Preserve emotional polarity exactly. Do not counterbalance a requested quality with its opposite or shift any content dimension the user did not ask to change.
- Depict the requested action or state itself. Never replace it with mood, implication, an adjacent action, relationship language, or euphemism. Choose the exact pose, framing, contact, expression, and spatial staging needed to make it visible without adding a different action or thematic element.
- Add only details that support the requested scene. Do not invent or remove subjects, objects, secondary actions, props, symbols, visible text, or narrative beats. A role, genre, or rating label alone does not authorize stereotypical details.
- Every tonal adjective and emotional-relationship claim must be traceable to the user's request. Write visual description rather than evaluative, moralizing, decorum, or rating commentary.
- Never infer an emotional relationship merely from physical proximity, contact, role labels, or a shared setting.
- Commit to one exact, observable composition. Never hedge with alternatives such as "X or Y".
- Honor exclusions and boundaries by expressing the desired visible state positively instead of appending a negative-prompt list.
- Include visible text, labels, signage, or slogans only when the user explicitly requests them; otherwise add none.
- Add vivid lighting, texture, atmosphere, composition, and color details only when they reinforce the requested scene, tone, and rating.
- Write the prompt in the style that best suits this model type (see guide above).
- Do NOT add negative prompt content — only write the positive prompt.
- If the user provides a style context, complement it — don't repeat or contradict it.
- Keep the result focused: one coherent scene or subject, not a list of disconnected ideas.
- Before returning, silently compare the result with the user's prompt. Remove every object, action, tonal claim, and relationship claim that is not traceable to the request or strictly necessary to stage it. Restore the user's literal content-bearing wording anywhere the result made it gentler, stronger, more generic, or more abstract.
- Output only the prompt text — no explanations, no preamble.`;
}

export const IMAGE_PROMPT_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "enhance_prompt",
    description: "Output the enhanced image generation prompt",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description:
            "One definitive model-ready prompt matching the user's requested audience, content boundaries, tone, genre, intensity, and creative direction. Retain every content-bearing noun, verb, relationship, and constraint; use concrete visible staging without substitution, euphemism, escalation, sanitization, or unrequested content. Never infer an emotional relationship from proximity, contact, a role label, or a shared setting. Silently remove untraceable additions and restore any wording made gentler, stronger, more generic, or more abstract.",
        },
      },
      required: ["prompt"],
    },
  },
};

function normalizeBuildImagePromptInput(
  inputOrPrompt: BuildImagePromptMessagesInput | string,
  stylePrompt = "",
  promptingType: ImagePromptingType = "sdxl",
  modelTitle = "Unknown Model",
): Required<BuildImagePromptMessagesInput> {
  if (typeof inputOrPrompt === "string") {
    return {
      prompt: inputOrPrompt,
      stylePrompt,
      promptingType,
      modelTitle,
      randomTheme: "",
    };
  }
  return {
    prompt: inputOrPrompt.prompt,
    stylePrompt: inputOrPrompt.stylePrompt ?? "",
    promptingType: inputOrPrompt.promptingType ?? "sdxl",
    modelTitle: inputOrPrompt.modelTitle ?? "Unknown Model",
    randomTheme: inputOrPrompt.randomTheme ?? "",
  };
}

export function buildImagePromptMessages(
  input: BuildImagePromptMessagesInput,
): SogniChatMessage[];
export function buildImagePromptMessages(
  prompt: string,
  stylePrompt: string,
  promptingType: ImagePromptingType,
  modelTitle: string,
): SogniChatMessage[];
export function buildImagePromptMessages(
  inputOrPrompt: BuildImagePromptMessagesInput | string,
  stylePrompt = "",
  promptingType: ImagePromptingType = "sdxl",
  modelTitle = "Unknown Model",
): SogniChatMessage[] {
  const input = normalizeBuildImagePromptInput(
    inputOrPrompt,
    stylePrompt,
    promptingType,
    modelTitle,
  );
  const messages: SogniChatMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(input.promptingType, input.modelTitle),
    },
  ];
  let userMessage: string;
  if (input.prompt.trim()) {
    userMessage = input.prompt;
    if (input.stylePrompt) {
      userMessage += `\n\nCurrent style context (complement this, don't repeat): ${input.stylePrompt}`;
    }
  } else {
    const theme = input.randomTheme || getRandomTheme();
    userMessage = `Come up with a unique, creative image inspired by: ${theme}. Be original and surprising — avoid clichés.`;
    if (input.stylePrompt) {
      userMessage += `\n\nUse this style as inspiration: ${input.stylePrompt}`;
    }
  }
  messages.push({ role: "user", content: userMessage });
  return messages;
}

export function parseToolCallPrompt(args: Record<string, unknown>): string {
  return String(args.prompt || "").trim();
}

const SDXL_MODEL_NAMES = new Set([
  "sdxl",
  "stable-diffusion-xl",
  "stable-diffusion-xl-1-0",
  "albedo-xl",
  "animagine-xl",
  "anima-pencil-xl",
  "art-universe-xl",
  "hyphoria-real",
  "analog-madness-xl",
  "cyberrealistic-xl",
  "real-dream-xl",
  "faetastic-xl",
  "zavychroma-xl",
  "dreamshaper-xl",
]);

const PONY_MODEL_NAMES = new Set([
  "pony",
  "pony-xl",
  "pony-v7",
  "pony-faetality",
  "one-obsession-v22",
  "cyberrealistic-pony-v7",
]);

const FLUX_MODEL_NAMES = new Set([
  "flux",
  "flux-1",
  "flux-1-schnell",
  "flux-schnell",
  "flux1-krea",
  "flux-1-krea",
  "flux2",
  "flux-2",
  "flux-2-dev",
  "chroma-v46-flash",
  "chroma1-hd",
  "chroma-detail",
]);

const KREA2_MODEL_NAMES = new Set([
  "krea-2",
  "krea2",
  "krea-2-turbo",
  "krea2-turbo",
  "krea2-turbo-fp8-scaled",
  "dark-beast-krea2",
  "dark-beast-krea-2",
  "dark-beast-krea2-fp8",
]);

const QWEN_GENERATE_MODEL_NAMES = new Set([
  "qwen-image",
  "qwen-image-2512",
  "qwen-2512",
  "qwen-2512-lightning",
  "qwen-image-2512-lightning",
]);

const QWEN_EDIT_MODEL_NAMES = new Set([
  "qwen",
  "qwen-edit",
  "qwen-lightning",
  "qwen-image-edit",
  "qwen-image-edit-2511",
  "qwen-image-edit-2511-lightning",
]);

const KREA2_EDIT_MODEL_NAMES = new Set([
  "krea-identity-edit",
  "krea-2-identity-edit",
  "krea2-identity-edit",
  "krea2-identity-edit-v1-2",
  "dark-beast-krea2-identity-edit",
  "dark-beast-krea-2-identity-edit",
]);

const GPT_IMAGE_MODEL_NAMES = new Set([
  "gpt-image-2",
  "gpt-image2",
  "gpt-2-image",
  "openai-gpt-image-2",
  "chatgpt-image-2",
]);

const FLUX_EDIT_MODEL_NAMES = new Set([
  "flux2",
  "flux-2",
  "flux-2-dev",
]);

function normalizeImagePromptModelName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b(?:model|renderer)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function normalizeImagePromptOperation(
  value: string | null | undefined,
): ImagePromptAuthoringOperation | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (
    normalized === "generate"
    || normalized === "generation"
    || normalized === "t2i"
    || normalized === "txt2img"
    || normalized === "text-to-image"
  ) {
    return "generate";
  }
  if (
    normalized === "edit"
    || normalized === "editing"
    || normalized === "image-edit"
    || normalized === "instruction-edit"
    || normalized === "i2i"
    || normalized === "img2img"
    || normalized === "image-to-image"
  ) {
    return "edit";
  }
  return null;
}

function imageProfile(args: {
  id: string;
  modelTitle: string;
  promptingType: ImagePromptingType;
  operation: ImagePromptAuthoringOperation;
  outputFormat?: ImagePromptAuthoringOutputFormat;
}): ImagePromptAuthoringProfile {
  return {
    id: args.id,
    modelTitle: args.modelTitle,
    promptingType: args.promptingType,
    operation: args.operation,
    outputFormat: args.outputFormat ?? "prompt",
  };
}

/**
 * Resolves a named image model to a validated prompt grammar. This deliberately
 * has no generic fallback: a model name is not proof that its prompt contract
 * is known. Callers must ask for a supported target when this returns null.
 */
export function resolveImagePromptAuthoringProfile(
  targetModel: string,
  requestedOperation?: string | null,
): ImagePromptAuthoringProfile | null {
  const model = normalizeImagePromptModelName(targetModel);
  const intrinsicEdit = QWEN_EDIT_MODEL_NAMES.has(model) || KREA2_EDIT_MODEL_NAMES.has(model);
  const normalizedRequestedOperation = normalizeImagePromptOperation(requestedOperation);
  if (requestedOperation && !normalizedRequestedOperation) return null;
  const operation = normalizedRequestedOperation ?? (intrinsicEdit ? "edit" : "generate");

  if (intrinsicEdit && operation !== "edit") return null;

  if (GPT_IMAGE_MODEL_NAMES.has(model)) {
    return imageProfile({
      id: operation === "edit" ? "gpt-image-2-edit" : "gpt-image-2-generate",
      modelTitle: "GPT Image 2",
      promptingType: operation === "edit" ? "gpt-image-edit" : "gpt-image",
      operation,
    });
  }
  if (QWEN_EDIT_MODEL_NAMES.has(model)) {
    return imageProfile({
      id: "qwen-image-edit-2511",
      modelTitle: "Qwen Image Edit 2511",
      promptingType: "qwen-edit",
      operation: "edit",
    });
  }
  if (KREA2_EDIT_MODEL_NAMES.has(model)) {
    return imageProfile({
      id: "krea-2-identity-edit",
      modelTitle: "Krea 2 Identity Edit",
      promptingType: "krea2-edit",
      operation: "edit",
    });
  }
  if (FLUX_MODEL_NAMES.has(model)) {
    if (operation === "edit" && !FLUX_EDIT_MODEL_NAMES.has(model)) return null;
    return imageProfile({
      id: operation === "edit" ? "flux-edit" : "flux-generate",
      modelTitle: model.startsWith("chroma") ? "Chroma" : "FLUX",
      promptingType: operation === "edit" ? "flux-edit" : "flux",
      operation,
    });
  }
  if (KREA2_MODEL_NAMES.has(model)) {
    if (operation !== "generate") return null;
    return imageProfile({
      id: "krea-2-generate",
      modelTitle: model.startsWith("dark-beast") ? "Dark Beast Krea 2" : "Krea 2 Turbo",
      promptingType: "krea2",
      operation: "generate",
    });
  }
  if (QWEN_GENERATE_MODEL_NAMES.has(model)) {
    if (operation === "edit") return null;
    return imageProfile({
      id: "qwen-image-2512",
      modelTitle: "Qwen Image 2512",
      promptingType: "qwen",
      operation: "generate",
      outputFormat: "positive_negative",
    });
  }
  if (model === "z-image" || model === "zimage") {
    if (operation !== "generate") return null;
    return imageProfile({
      id: "z-image-generate",
      modelTitle: "Z-Image",
      promptingType: "z-image",
      operation: "generate",
      outputFormat: "positive_negative",
    });
  }
  if (
    model === "z-turbo"
    || model === "z-image-turbo"
    || model === "zimage-turbo"
    || model === "dark-beast-z-turbo"
    || model === "dark-beast-z-image-turbo"
  ) {
    if (operation !== "generate") return null;
    return imageProfile({
      id: "z-image-turbo-generate",
      modelTitle: model.startsWith("dark-beast") ? "Dark Beast Z-Image Turbo" : "Z-Image Turbo",
      promptingType: "z-image",
      operation: "generate",
    });
  }
  if (PONY_MODEL_NAMES.has(model)) {
    if (operation !== "generate") return null;
    return imageProfile({
      id: "pony-generate",
      modelTitle: "Pony Diffusion XL",
      promptingType: "pony",
      operation: "generate",
      outputFormat: "positive_negative",
    });
  }
  if (SDXL_MODEL_NAMES.has(model)) {
    if (operation !== "generate") return null;
    return imageProfile({
      id: "sdxl-generate",
      modelTitle: "Stable Diffusion XL",
      promptingType: "sdxl",
      operation: "generate",
      outputFormat: "positive_negative",
    });
  }
  if (
    model === "sd-1-5"
    || model === "sd15"
    || model === "stable-diffusion-1-5"
    || model === "stable-diffusion-v1-5"
  ) {
    if (operation !== "generate") return null;
    return imageProfile({
      id: "sd15-generate",
      modelTitle: "Stable Diffusion 1.5",
      promptingType: "sd15",
      operation: "generate",
      outputFormat: "positive_negative",
    });
  }
  if (
    model === "sdxl-turbo"
    || model === "sdxl-lightning"
    || model === "stable-diffusion-xl-turbo"
    || model === "lcm"
  ) {
    if (operation !== "generate") return null;
    return imageProfile({
      id: "fast-diffusion-generate",
      modelTitle: "Fast distilled Stable Diffusion",
      promptingType: "fast",
      operation: "generate",
    });
  }
  if (model === "sd3" || model === "stable-diffusion-3" || model === "stable-diffusion-3-5") {
    if (operation !== "generate") return null;
    return imageProfile({
      id: "sd3-generate",
      modelTitle: "Stable Diffusion 3",
      promptingType: "sd3",
      operation: "generate",
      outputFormat: "positive_negative",
    });
  }
  return null;
}

function imageAuthoringOutputInstruction(
  profile: ImagePromptAuthoringProfile,
): string {
  if (profile.outputFormat === "positive_negative") {
    return `OUTPUT CONTRACT: Return exactly two single-line fields in this order:
positive_prompt: <the model-ready positive prompt>
negative_prompt: <a concise model-native negative prompt>
Use the negative field for explicit exclusions and relevant rendering failure modes only. Never contradict or weaken requested content. Do not add any other line, heading, explanation, Markdown fence, or preamble.`;
  }
  return "OUTPUT CONTRACT: Return only the directly runnable prompt text. Do not add field labels, a preamble, explanation, Markdown fence, tips, or a render offer.";
}

export function buildImagePromptAuthoringMessages(
  input: BuildImagePromptAuthoringMessagesInput,
): SogniChatMessage[] {
  const guide = PROMPTING_GUIDES[input.profile.promptingType];
  const operationLabel = input.profile.operation === "edit"
    ? "image editing"
    : "text-to-image generation";
  const system = `You author directly runnable prompts for ${input.profile.modelTitle} ${operationLabel}.

MODEL-SPECIFIC PROMPTING GUIDE:
${guide}

AUTHORING RULES:
- Preserve every user-specified subject, action, setting, style, color, spatial relationship, exact quoted text, proper noun, and constraint.
- Treat the user's request as source material. Meta-language asking you to write a prompt is not visual content for the image.
- Add only concrete visual detail that supports the requested image or edit. Never invent extra subjects, props, labels, slogans, symbols, panels, or story events.
- Preserve emotional polarity, audience, genre, intensity, and content boundaries exactly.
- Commit to one observable composition or one precise edit. Do not hedge with alternatives.
- If the request is already production-ready, polish it lightly instead of replacing its direction.
- Never claim to have inspected a reference image that is not attached to this authoring request.

${imageAuthoringOutputInstruction(input.profile)}`;
  return [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        `Target model: ${input.profile.modelTitle}`,
        `Operation: ${input.profile.operation}`,
        "<request>",
        input.prompt,
        "</request>",
      ].join("\n"),
    },
  ];
}

export function assertImagePromptAuthoringOutput(
  profile: ImagePromptAuthoringProfile,
  output: string,
): void {
  const trimmed = output.trim();
  if (!trimmed) throw new Error("image-prompt authoring returned an empty prompt");
  if (/```|^\s*(?:here(?:'s| is)|prompt\s+for\b)/i.test(trimmed)) {
    throw new Error("image-prompt authoring added a wrapper or preamble");
  }
  if (profile.outputFormat === "positive_negative") {
    const lines = trimmed.split(/\r?\n/);
    if (
      lines.length !== 2
      || !/^positive_prompt:\s*\S.+$/i.test(lines[0])
      || !/^negative_prompt:\s*\S.+$/i.test(lines[1])
    ) {
      throw new Error(
        "image-prompt authoring must return exactly positive_prompt and negative_prompt single-line fields",
      );
    }
    return;
  }
  if (/^(?:positive_prompt|negative_prompt):/im.test(trimmed)) {
    throw new Error("this image model expects prompt text without positive/negative field wrappers");
  }
}
