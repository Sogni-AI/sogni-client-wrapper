export const IMAGE_CONTEXT_TOOL_NAMES = [
    'edit_image',
    'restore_photo',
    'apply_style',
    'refine_result',
    'change_angle',
    'animate_photo',
    'dance_montage',
    'orbit_video',
];
export const VIDEO_CONTEXT_TOOL_NAMES = [
    'video_to_video',
    'extend_video',
    'replace_video_segment',
    'overlay_video',
    'add_subtitles',
];
const IMAGE_UNLOCK_SIGNALS = [
    'has_uploaded_image',
    'has_generated_image',
    'has_active_persona',
];
const VIDEO_UNLOCK_SIGNALS = [
    'has_uploaded_video',
    'has_generated_video',
];
export const TOOL_SURFACE_GATING_POLICIES = [
    {
        policyId: 'LOCK_IMAGE_CONTEXT_TOOLS_WHEN_NO_IMAGE_SCOPE',
        version: '1.0.0',
        trigger: {
            allOf: [],
            noneOf: [...IMAGE_UNLOCK_SIGNALS],
        },
        effect: { forbid: [...IMAGE_CONTEXT_TOOL_NAMES] },
        rationale: 'No image is in scope (no uploaded image, no generated image, no active persona). ' +
            'Hide image-edit / iteration / animation tools so the model picks generate_image ' +
            'instead of an edit variant it cannot supply a source for.',
    },
    {
        policyId: 'LOCK_VIDEO_CONTEXT_TOOLS_WHEN_NO_VIDEO_SCOPE',
        version: '1.0.0',
        trigger: {
            allOf: [],
            noneOf: [...VIDEO_UNLOCK_SIGNALS],
        },
        effect: { forbid: [...VIDEO_CONTEXT_TOOL_NAMES] },
        rationale: 'No video is in scope. Hide video post-production / transformation tools — they ' +
            'cannot operate without an existing video.',
    },
];
export function populateContractsToolSurfaceGatingPolicies(registry) {
    for (const policy of TOOL_SURFACE_GATING_POLICIES) {
        registry.registerGatingPolicy(policy);
    }
}
//# sourceMappingURL=gatingPoliciesToolSurface.js.map