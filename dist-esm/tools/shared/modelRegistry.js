const QUALITY_TIER_MODELS = [
    { key: 'fast', displayName: 'Qwen Image Edit 2511 Lightning' },
    { key: 'hq', displayName: 'Qwen Image Edit 2511' },
    { key: 'pro', displayName: 'Flux.2 Dev (Pro)' },
];
const QUALITY_ONLY_MODELS = [
    { key: 'fast', displayName: 'Qwen Image Edit 2511 Lightning' },
    { key: 'hq', displayName: 'Qwen Image Edit 2511' },
];
export const MODELS_BY_TOOL = {
    generate_image: [
        { key: 'gpt-image-2', displayName: 'GPT Image 2' },
        { key: 'z-turbo', displayName: 'Z-Image Turbo' },
        { key: 'z-image', displayName: 'Z-Image' },
        { key: 'chroma-v46-flash', displayName: 'Chroma v.46 Flash' },
        { key: 'chroma-detail', displayName: 'Chroma Detail' },
        { key: 'flux1-krea', displayName: 'Flux.1 Krea' },
        { key: 'flux2', displayName: 'Flux.2 Dev' },
        { key: 'pony-v7', displayName: 'CyberRealistic Pony v7' },
        { key: 'qwen-2512', displayName: 'Qwen Image 2512' },
        { key: 'qwen-2512-lightning', displayName: 'Qwen Image 2512 Lightning' },
        { key: 'albedo-xl', displayName: 'AlbedoBase XL v3.1-Large' },
        { key: 'animagine-xl', displayName: 'Animagine XL 4.0' },
        { key: 'anima-pencil-xl', displayName: 'Anima Pencil XL v5' },
        { key: 'art-universe-xl', displayName: 'Art Universe XL v6' },
        { key: 'hyphoria-real', displayName: 'Hyphoria Real [Illu] v0.5' },
        { key: 'analog-madness-xl', displayName: 'Analog Madness SDXL v2' },
        { key: 'cyberrealistic-xl', displayName: 'CyberRealistic XL v6' },
        { key: 'real-dream-xl', displayName: 'Real Dream XL-Pony-11' },
        { key: 'faetastic-xl', displayName: 'FaeTastic Details XL v24' },
        { key: 'zavychroma-xl', displayName: 'ZavyChromaXL v8' },
        { key: 'pony-faetality', displayName: 'Pony FaeTality v1.1' },
        { key: 'dreamshaper-xl', displayName: 'DreamShaper XL' },
    ],
    edit_image: [
        { key: 'gpt-image-2', displayName: 'GPT Image 2' },
        { key: 'qwen-lightning', displayName: 'Qwen Image Edit Lightning' },
        { key: 'qwen', displayName: 'Qwen Image Edit 2511' },
        { key: 'flux2', displayName: 'Flux.2 Dev' },
    ],
    restore_photo: QUALITY_TIER_MODELS,
    apply_style: QUALITY_TIER_MODELS,
    refine_result: QUALITY_TIER_MODELS,
    change_angle: QUALITY_ONLY_MODELS,
    generate_video: [
        { key: 'ltx23', displayName: 'LTX 2.3 22B' },
        { key: 'wan22', displayName: 'WAN 2.2 14B' },
        { key: 'seedance2', displayName: 'Seedance 2.0' },
        { key: 'seedance2-fast', displayName: 'Seedance 2.0 Fast' },
    ],
    animate_photo: [
        { key: 'ltx23', displayName: 'LTX 2.3 22B' },
        { key: 'wan22', displayName: 'WAN 2.2 14B' },
    ],
    sound_to_video: [
        { key: 'wan-s2v', displayName: 'WAN 2.2 S2V' },
        { key: 'seedance2', displayName: 'Seedance 2.0 Image+Audio' },
        { key: 'seedance2-fast', displayName: 'Seedance 2.0 Fast Image+Audio' },
        { key: 'ltx23-ia2v', displayName: 'LTX 2.3 Image+Audio' },
        { key: 'ltx23-a2v', displayName: 'LTX 2.3 Audio Only' },
    ],
    generate_music: [
        { key: 'turbo', displayName: 'ACE-Step 1.5 Turbo' },
        { key: 'sft', displayName: 'ACE-Step 1.5 SFT' },
    ],
};
const QUALITY_ARG_TOOLS = [
    'restore_photo',
    'apply_style',
    'refine_result',
    'change_angle',
];
const VIDEO_MODEL_ARG_TOOLS = ['generate_video', 'animate_photo', 'sound_to_video'];
export function getModelArgKey(toolName) {
    if (QUALITY_ARG_TOOLS.includes(toolName))
        return 'quality';
    return VIDEO_MODEL_ARG_TOOLS.includes(toolName) ? 'videoModel' : 'model';
}
export function isQualityTierTool(toolName) {
    return QUALITY_ARG_TOOLS.includes(toolName);
}
export function getModelOptions(toolName) {
    return MODELS_BY_TOOL[toolName] ?? [];
}
export function getAlternativeModels(toolName, currentModelKey) {
    const all = getModelOptions(toolName);
    if (!currentModelKey)
        return all;
    return all.filter((m) => m.key !== currentModelKey);
}
//# sourceMappingURL=modelRegistry.js.map