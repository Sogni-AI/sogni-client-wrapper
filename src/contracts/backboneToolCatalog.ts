/**
 * Backbone tool-name catalog constants.
 *
 * Phase 8.2-prep extracts the pure-data tool-name lists out of
 * `src/backbone/` so PUBLIC-bucket modules — notably
 * `contracts/data/toolCatalog.ts` and its test — can resolve the
 * canonical tool catalog without crossing into PRIVATE `backbone/`.
 *
 * The original declarations lived in `src/backbone/index.ts` and are
 * re-exported there for back-compat so existing private consumers
 * (knowledge manifests, durable workflow normalization, etc.) keep
 * working without any import changes.
 *
 * This file is intentionally constants/types only. No business logic
 * lives here.
 */

export const BACKBONE_GENERATION_TOOL_NAMES = [
  "generate_image",
  "generate_video",
  "generate_music",
  "edit_image",
  "apply_style",
  "restore_photo",
  "refine_result",
  "animate_photo",
  "change_angle",
  "video_to_video",
  "stitch_video",
  "orbit_video",
  "dance_montage",
  "sound_to_video",
  "extend_video",
  "replace_video_segment",
  "overlay_video",
  "add_subtitles",
] as const;

export const BACKBONE_APP_TOOL_NAMES = [
  "manage_memory",
  "resolve_personas",
  "set_content_filter",
  "analyze_image",
  "analyze_video",
  "extract_metadata",
  "ask_clarifying_question",
  "finalize_response",
  "create_asset_manifest",
  "inspect_asset",
  "label_asset",
  "map_assets_for_model",
  "validate_asset_references",
] as const;

export const BACKBONE_HOSTED_APP_TOOL_NAMES = [
  "analyze_image",
  "analyze_video",
  "extract_metadata",
  "ask_clarifying_question",
  "finalize_response",
  "create_asset_manifest",
  "inspect_asset",
  "label_asset",
  "map_assets_for_model",
  "validate_asset_references",
] as const;

export const BACKBONE_COMPOSITION_TOOL_NAMES = [
  "enhance_prompt",
  "compose_lyrics",
  "compose_instrumental",
  "compose_script",
  "compose_workflow",
  "compose_workflow_template",
] as const;

export const BACKBONE_DURABLE_HOSTED_CREATIVE_TOOL_NAMES = [
  ...BACKBONE_GENERATION_TOOL_NAMES,
] as const;

export type BackboneAppToolName = (typeof BACKBONE_APP_TOOL_NAMES)[number];
