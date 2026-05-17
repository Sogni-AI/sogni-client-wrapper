export type WorkflowDebugEventLevel = 'debug' | 'info' | 'warn' | 'error';

export interface WorkflowDebugEventLike {
  event: string;
  message?: string;
  level?: WorkflowDebugEventLevel | string;
  data?: Record<string, unknown> | null;
}

export type WorkflowStatusKind = 'info' | 'warn' | 'error' | 'pending' | 'success';

export interface WorkflowStatusItem {
  key: string;
  label: string;
  kind: WorkflowStatusKind;
}

export function formatWorkflowToolName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'tool';
  return value
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function eventToolName(event: WorkflowDebugEventLike): string {
  return formatWorkflowToolName(
    event.data?.toolName
      ?? event.data?.toTool
      ?? event.data?.requiredTool
      ?? event.data?.nextToolName,
  );
}

const TOOL_SETTING_ADJUSTMENT_EVENTS = new Set([
  'add_subtitles_source_uploaded_normalized',
  'analyze_video_source_uploaded_normalized',
  'approved_storyboard_image_args_normalized',
  'batched_image_prompt_sanitized',
  'character_sheet_image_defaults_applied',
  'extend_video_duration_normalized',
  'generated_storyboard_image_edit_args_normalized',
  'image_followup_format_preserved',
  'overlay_video_source_uploaded_normalized',
  'overlay_video_window_inferred',
  'single_composite_image_args_normalized',
  'storyboard_video_stage_redirected_from_analysis',
  'unrequested_image_variations_limited',
  'uploaded_storyboard_edit_source_normalized',
  'uploaded_storyboard_generate_redirected_to_edit',
  'video_stage_rebound_to_generated_composite',
  'video_storyboard_image_defaults_applied',
]);

function isToolSettingAdjustmentEvent(eventName: string): boolean {
  return TOOL_SETTING_ADJUSTMENT_EVENTS.has(eventName);
}

export function workflowStatusForDebugEvent(
  event: WorkflowDebugEventLike,
): Omit<WorkflowStatusItem, 'key'> | null {
  switch (event.event) {
    case 'run_started':
      return { label: 'Started workflow', kind: 'info' };
    case 'persona_resolution_blocked':
      return { label: 'Using uploaded image as reference', kind: 'info' };
    case 'context_window_compaction':
    case 'context_compaction_notice_received':
    case 'context_compaction_visible_notice':
      return { label: 'Compacting context', kind: 'info' };
    case 'durable_run_submitted':
      return { label: 'Submitted cloud workflow', kind: 'info' };
    case 'durable_run_waiting':
    case 'durable_run_rehydrated_waiting':
      return { label: 'Waiting for user input', kind: 'pending' };
    case 'durable_run_error':
    case 'durable_run_rehydrate_error':
    case 'durable_run_rehydrate_failed':
      return { label: 'Cloud workflow unavailable', kind: event.level === 'error' ? 'error' : 'warn' };
    case 'preproduction_script_stage_started':
      return { label: 'Preparing creative brief', kind: 'info' };
    case 'preproduction_planning_notes_started':
      return { label: 'Planning storyboard structure', kind: 'info' };
    case 'preproduction_planning_notes_failed':
      return { label: 'Storyboard planning notes failed', kind: 'warn' };
    case 'preproduction_script_draft_started':
      return { label: 'Writing storyboard plan', kind: 'info' };
    case 'preproduction_script_continuation_started':
      return { label: 'Continuing storyboard plan', kind: 'info' };
    case 'preproduction_planning_contract_resolved':
      return { label: 'Storyboard contract captured', kind: 'success' };
    case 'preproduction_script_stream_recovered':
      return { label: 'Recovered partial storyboard draft', kind: 'warn' };
    case 'preproduction_script_beat_count_mismatch':
    case 'preproduction_script_beat_count_second_repair_started':
      return { label: 'Correcting storyboard beat count', kind: 'warn' };
    case 'preproduction_script_beat_count_repair_mismatch':
    case 'preproduction_script_beat_count_second_repair_mismatch':
      return { label: 'Checking storyboard structure', kind: 'warn' };
    case 'preproduction_script_count_repair_failed':
      return { label: 'Storyboard repair failed', kind: 'warn' };
    case 'llm_request_started':
      return {
        label: event.data?.toolsEnabled === false ? 'Creative writing pass started' : 'Planning next step',
        kind: 'info',
      };
    case 'vision_context_prepared':
      return { label: 'Inspecting image context', kind: 'info' };
    case 'job_confirmation_waiting':
      return { label: 'Waiting for job approval', kind: 'pending' };
    case 'quality_audit_confirmation_waiting':
      return { label: 'Waiting for quality approval', kind: 'pending' };
    case 'job_confirmation_confirmed':
    case 'quality_audit_confirmation_confirmed':
      return { label: 'Approved', kind: 'success' };
    case 'job_confirmation_overrides_applied':
      return { label: 'Applied approved settings', kind: 'success' };
    case 'job_confirmation_cancelled':
    case 'quality_audit_confirmation_cancelled':
      return { label: 'Approval cancelled', kind: 'warn' };
    case 'job_confirmation_unavailable':
      return { label: 'Approval unavailable', kind: 'error' };
    case 'guardrail_blocked_tool':
      return { label: 'Adjusted workflow before spending credits', kind: 'warn' };
    case 'guardrail_executing_concrete_suggestion':
    case 'guardrail_repeated_executing_suggestion':
      return { label: `Executing corrected ${eventToolName(event)}`, kind: 'warn' };
    case 'guardrail_repeated_stopped':
      return { label: 'Workflow guardrail stopped retries', kind: 'error' };
    case 'permission_gate_blocked':
      return { label: 'Waiting for explicit permission', kind: 'warn' };
    case 'contracts_prior_error_retry_confirmed':
      return { label: `Retrying ${eventToolName(event)}`, kind: 'info' };
    case 'contracts_dispatch_execute_with_repair':
      return { label: 'Adjusted tool settings', kind: 'info' };
    case 'contracts_dispatch_repair_followup':
      return { label: 'Repairing workflow plan', kind: 'warn' };
    case 'contracts_dispatch_ask_user':
      return { label: 'Needs clarification', kind: 'pending' };
    case 'contracts_dispatch_reject':
      return { label: 'Tool call rejected by policy', kind: 'warn' };
    case 'tool_call_received':
      return { label: `Preparing ${eventToolName(event)}`, kind: 'info' };
    case 'tool_progress_started':
      return { label: `Running ${eventToolName(event)}`, kind: 'info' };
    case 'tool_progress_error':
      return { label: `${eventToolName(event)} progress failed`, kind: 'error' };
    case 'tool_redirect':
      return { label: `Redirected to ${eventToolName(event)}`, kind: 'info' };
    case 'tool_error_repairing':
      return { label: 'Retrying with corrected settings', kind: 'warn' };
    case 'internal_repair_text_suppressed':
      return { label: 'Trying corrected tool call', kind: 'warn' };
    case 'internal_repair_no_tool_nudge':
      return { label: 'Retrying workflow plan', kind: 'warn' };
    case 'tool_error_repeated_stopped':
    case 'tool_error_terminal_stopped':
    case 'tool_error_user_message':
      return { label: 'Tool could not continue', kind: 'error' };
    case 'tool_wait_for_user_stopped':
      return { label: 'Waiting for user input', kind: 'pending' };
    case 'vision_analysis_failed':
      return { label: 'Analysis failed', kind: 'error' };
    case 'plain_text_stream_truncated':
    case 'plain_text_result_truncated':
      return { label: 'Trimmed repetitive response', kind: 'warn' };
    case 'assistant_question_waiting_for_user':
    case 'user_requested_question_before_generation':
      return { label: 'Waiting for user response', kind: 'pending' };
    case 'seedance_duration_below_minimum_asked_user':
      return { label: 'Waiting for valid video duration', kind: 'pending' };
    case 'seedance_direct_route_skipped_for_fallback_confirmation':
      return { label: 'Waiting for fallback confirmation', kind: 'pending' };
    case 'seedance_short_duration_switched_to_ltx':
      return { label: 'Switched video model for short duration', kind: 'info' };
    case 'seedance_uploaded_asset_no_tool_forced':
      return { label: 'Routing uploaded asset video', kind: 'info' };
    case 'seedance_storyboard_reference_classified':
      return { label: 'Classified storyboard reference', kind: 'info' };
    case 'seedance_storyboard_reference_classification_failed':
      return { label: 'Could not classify storyboard reference', kind: 'warn' };
    case 'character_reference_video_creative_pass_started':
      return { label: 'Writing character video prompt', kind: 'info' };
    case 'character_reference_video_creative_pass_completed':
      return { label: 'Prepared character video prompt', kind: 'success' };
    case 'character_reference_video_creative_pass_failed':
      return { label: 'Character video prompt fallback', kind: 'warn' };
    case 'uploaded_character_reference_ltx_fallback_direct_tool_call':
    case 'uploaded_character_reference_detected_for_ltx_fallback':
    case 'generated_reference_ltx_fallback_direct_tool_call':
    case 'character_reference_sheet_ltx_fallback_direct_tool_call':
    case 'seedance_uploaded_asset_ltx_fallback_direct_tool_call':
    case 'storyboard_reference_ltx_fallback_direct_tool_call':
      return { label: 'Switched to LTX 2.3 fallback', kind: 'info' };
    case 'uploaded_script_seedance_plan_detected':
      return { label: 'Detected uploaded script plan', kind: 'info' };
    case 'uploaded_character_reference_detected_for_seedance':
      return { label: 'Detected character reference', kind: 'info' };
    case 'character_sheet_image_defaults_applied':
      return { label: 'Prepared character sheet prompt', kind: 'info' };
    case 'video_storyboard_image_defaults_applied':
      return { label: 'Prepared storyboard image prompt', kind: 'info' };
    case 'batched_image_prompt_sanitized':
      return { label: 'Sanitized image batch prompt', kind: 'info' };
    case 'semantic_image_batch_repair_executing':
      return { label: 'Repairing image batch request', kind: 'warn' };
    case 'semantic_image_batch_repair_failed':
    case 'semantic_image_batch_repair_parse_failed':
    case 'semantic_image_batch_repair_prompt_missing':
    case 'semantic_image_batch_repair_rejected':
      return { label: 'Image batch repair failed', kind: 'warn' };
    case 'approved_storyboard_image_blocked_lossy_contract':
      return { label: 'Blocked lossy storyboard image', kind: 'warn' };
    case 'storyboard_prompt_preflight_rebuilt':
      return { label: 'Rebuilt storyboard prompts', kind: 'info' };
    case 'storyboard_prompt_lint_result':
    case 'seedance_storyboard_prompt_lint_result':
      return {
        label: 'Checked storyboard prompt',
        kind: event.level === 'warn' ? 'warn' : 'info',
      };
    case 'storyboard_prompt_integrity_audit_failed':
      return { label: 'Storyboard prompt audit failed', kind: 'warn' };
    case 'storyboard_keyframe_count_mismatch':
      return { label: 'Keyframe count mismatch', kind: 'warn' };
    case 'storyboard_visual_audit_result':
      return {
        label: event.level === 'warn' ? 'Storyboard visual audit found issues' : 'Storyboard visual audit passed',
        kind: event.level === 'warn' ? 'warn' : 'success',
      };
    case 'session_control_turn_ended':
      return { label: 'Turn finalized', kind: 'success' };
    case 'tool_cost_confirmation_cancelled':
      return { label: 'Generation cancelled', kind: 'warn' };
    default:
      break;
  }

  if (event.event.endsWith('_direct_tool_call')) {
    return { label: `Routed to ${eventToolName(event)}`, kind: 'info' };
  }

  if (isToolSettingAdjustmentEvent(event.event)) {
    return { label: 'Adjusted tool settings', kind: 'info' };
  }

  return null;
}

export function streamingStatusForDebugEvent(event: WorkflowDebugEventLike): string | null {
  switch (event.event) {
    case 'run_started':
      return 'Starting workflow...';
    case 'persona_resolution_blocked':
      return 'Using the uploaded image as the reference...';
    case 'context_window_compaction':
    case 'context_compaction_notice_received':
    case 'context_compaction_visible_notice':
      return 'Compacting context...';
    case 'durable_run_submitted':
      return 'Submitted cloud workflow...';
    case 'durable_run_waiting':
    case 'durable_run_rehydrated_waiting':
      return 'Waiting for user input...';
    case 'durable_run_error':
    case 'durable_run_rehydrate_error':
    case 'durable_run_rehydrate_failed':
      return 'Cloud workflow could not continue.';
    case 'llm_request_started':
      return event.data?.toolsEnabled === false
        ? 'Running creative writing pass...'
        : 'Planning the next step...';
    case 'vision_context_prepared':
      return 'Inspecting image context...';
    case 'preproduction_script_stage_started':
      return 'Preparing the creative brief...';
    case 'preproduction_planning_notes_started':
      return 'Planning the storyboard structure...';
    case 'preproduction_planning_notes_failed':
      return 'Storyboard planning notes failed.';
    case 'preproduction_script_draft_started':
      return 'Writing the storyboard plan...';
    case 'preproduction_script_continuation_started':
      return 'Continuing the storyboard plan...';
    case 'preproduction_script_stream_recovered':
      return 'Recovered a partial storyboard draft...';
    case 'preproduction_script_beat_count_mismatch':
    case 'preproduction_script_beat_count_second_repair_started':
      return 'Correcting the storyboard beat count...';
    case 'preproduction_script_beat_count_repair_mismatch':
    case 'preproduction_script_beat_count_second_repair_mismatch':
      return 'Checking the storyboard structure...';
    case 'preproduction_script_count_repair_failed':
      return 'Storyboard repair failed.';
    case 'tool_call_received':
      return `Preparing ${formatWorkflowToolName(event.data?.toolName)}...`;
    case 'tool_progress_started':
      return `Running ${formatWorkflowToolName(event.data?.toolName)}...`;
    case 'tool_progress_error':
      return `${formatWorkflowToolName(event.data?.toolName)} progress failed.`;
    case 'tool_redirect':
      return `Redirecting to ${eventToolName(event)}...`;
    case 'tool_error_repairing':
      return 'The tool rejected that attempt. Adjusting the request and trying again...';
    case 'plain_text_stream_truncated':
    case 'plain_text_result_truncated':
      return 'Trimming a repetitive response...';
    case 'assistant_question_waiting_for_user':
    case 'user_requested_question_before_generation':
      return 'Waiting for user response...';
    case 'seedance_duration_below_minimum_asked_user':
      return 'Waiting for a valid video duration...';
    case 'seedance_direct_route_skipped_for_fallback_confirmation':
      return 'Waiting for fallback confirmation...';
    case 'seedance_short_duration_switched_to_ltx':
      return 'Switching video model for short duration...';
    case 'seedance_uploaded_asset_no_tool_forced':
      return 'Routing uploaded asset video...';
    case 'guardrail_executing_concrete_suggestion':
    case 'guardrail_repeated_executing_suggestion':
    case 'semantic_image_batch_repair_executing':
      return 'Trying a corrected tool call...';
    case 'guardrail_repeated_stopped':
      return 'Stopped retrying after repeated workflow guardrails.';
    case 'contracts_prior_error_retry_confirmed':
      return `Retrying ${eventToolName(event)}...`;
    case 'character_sheet_image_defaults_applied':
      return 'Preparing character sheet prompt...';
    case 'video_storyboard_image_defaults_applied':
      return 'Preparing storyboard image prompt...';
    case 'batched_image_prompt_sanitized':
      return 'Sanitizing image batch prompt...';
    case 'job_confirmation_waiting':
      return 'Waiting for job approval before spending credits...';
    case 'quality_audit_confirmation_waiting':
      return 'Waiting for approval on a preflight quality warning...';
    case 'job_confirmation_confirmed':
    case 'quality_audit_confirmation_confirmed':
      return 'Approved. Starting the job...';
    case 'job_confirmation_overrides_applied':
      return 'Applying approved generation settings...';
    case 'job_confirmation_cancelled':
    case 'quality_audit_confirmation_cancelled':
      return 'Generation cancelled before spending credits.';
    case 'tool_error_explaining':
      return 'The tool could not continue. Preparing an update...';
    case 'tool_error_user_message':
      return 'The tool could not continue. Showing an update...';
    case 'internal_repair_text_suppressed':
      return 'Trying a corrected tool call...';
    case 'internal_repair_no_tool_nudge':
      return 'Still correcting the tool request...';
    case 'tool_error_repeated_stopped':
      return 'Stopped retrying after repeated tool errors.';
    case 'storyboard_visual_audit_result':
      return event.level === 'warn'
        ? 'Storyboard visual audit found issues...'
        : 'Storyboard visual audit passed...';
    case 'storyboard_prompt_lint_result':
    case 'seedance_storyboard_prompt_lint_result':
      return 'Checking storyboard prompt...';
    case 'session_control_turn_ended':
      return 'Turn finalized.';
    case 'tool_cost_confirmation_cancelled':
      return 'Generation cancelled.';
    default:
      if (event.event.endsWith('_direct_tool_call')) {
        return `Routing to ${eventToolName(event)}...`;
      }
      if (isToolSettingAdjustmentEvent(event.event)) {
        return 'Adjusting tool settings...';
      }
      return null;
  }
}
