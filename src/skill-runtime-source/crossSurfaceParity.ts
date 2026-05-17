export type CrossSurfaceParitySurface =
  | 'chat'
  | 'api_chat_completions'
  | 'api_creative_agent_workflows'
  | 'public_skill';

export type CrossSurfaceParityFocus =
  | 'subtitles'
  | 'overlay'
  | 'uploaded_video_edits'
  | 'asset_manifest_sequence'
  | 'cancellation'
  | 'duplicate_start'
  | 'skill_media_refs'
  | 'generated_video_rerender'
  | 'seedance_storyboard_rerender'
  | 'image_selection_wait'
  | 'stitch_after_batch'
  | 'durable_chat_run_completion_after_close'
  | 'durable_chat_run_resume_after_worker_restart'
  | 'durable_chat_run_waiting_for_user'
  | 'sdk_flat_namespace_rest_parity'
  | 'api_socket_session_reuse'
  | 'public_skill_sdk_transport';

export interface CrossSurfaceParityExpectation {
  surface: CrossSurfaceParitySurface;
  entrypoint: string;
  expectedTools?: string[];
  expectedRequest?: Record<string, unknown>;
  expectedBehavior?: string[];
}

export interface CrossSurfaceParityFixture {
  id: string;
  focus: CrossSurfaceParityFocus;
  description: string;
  userText: string;
  mediaReferences?: Array<{
    kind: 'image' | 'video' | 'audio';
    filename: string;
  }>;
  expectations: CrossSurfaceParityExpectation[];
}

export const CROSS_SURFACE_PARITY_SURFACES: CrossSurfaceParitySurface[] = [
  'chat',
  'api_chat_completions',
  'api_creative_agent_workflows',
  'public_skill',
];

export const CROSS_SURFACE_PARITY_FIXTURES: CrossSurfaceParityFixture[] = [
  {
    id: 'uploaded-video-subtitles',
    focus: 'subtitles',
    description: 'Quoted subtitle lines burn into the uploaded video instead of regenerating it.',
    userText: 'Add subtitles to this uploaded clip: "Fresh coffee." "Ready when you are."',
    mediaReferences: [{ kind: 'video', filename: 'cafe.mp4' }],
    expectations: [
      {
        surface: 'chat',
        entrypoint: 'workflow fixture subtitles-on-uploaded-video',
        expectedTools: ['add_subtitles'],
        expectedBehavior: ['sourceVideoIndex uses the uploaded video'],
      },
      {
        surface: 'api_chat_completions',
        entrypoint: '/v1/chat/completions',
        expectedTools: ['add_subtitles'],
        expectedRequest: { sogni_tools: 'creative-agent', media_references: true },
      },
      {
        surface: 'api_creative_agent_workflows',
        entrypoint: '/v1/creative-agent/workflows',
        expectedTools: ['add_subtitles'],
        expectedRequest: { input: { steps: true } },
      },
      {
        surface: 'public_skill',
        entrypoint: '--api-chat and --api-workflow',
        expectedTools: ['add_subtitles'],
        expectedBehavior: ['forwards video refs as media_references without prompt base64 leakage'],
      },
    ],
  },
  {
    id: 'uploaded-video-logo-overlay',
    focus: 'overlay',
    description: 'A static logo/image overlay targets the uploaded base video.',
    userText: 'Put this logo in the top left of the uploaded video as a small watermark.',
    mediaReferences: [
      { kind: 'video', filename: 'source.mp4' },
      { kind: 'image', filename: 'logo.png' },
    ],
    expectations: [
      { surface: 'chat', entrypoint: 'workflow fixture uploaded-video-logo-static-overlay', expectedTools: ['overlay_video'] },
      { surface: 'api_chat_completions', entrypoint: '/v1/chat/completions', expectedTools: ['overlay_video'] },
      { surface: 'api_creative_agent_workflows', entrypoint: '/v1/creative-agent/workflows', expectedTools: ['overlay_video'] },
      { surface: 'public_skill', entrypoint: '--api-workflow hosted-tool-sequence', expectedTools: ['overlay_video'] },
    ],
  },
  {
    id: 'uploaded-video-segment-replace',
    focus: 'uploaded_video_edits',
    description: 'A bounded uploaded-video window routes to replace_video_segment.',
    userText: 'Regenerate the 2s-4s window of this uploaded video and keep the original audio.',
    mediaReferences: [{ kind: 'video', filename: 'source.mp4' }],
    expectations: [
      { surface: 'chat', entrypoint: 'workflow fixture replace-video-segment-uploaded', expectedTools: ['replace_video_segment'] },
      { surface: 'api_chat_completions', entrypoint: '/v1/chat/completions', expectedTools: ['replace_video_segment'] },
      { surface: 'api_creative_agent_workflows', entrypoint: '/v1/creative-agent/workflows', expectedTools: ['replace_video_segment'] },
      { surface: 'public_skill', entrypoint: '--api-workflow hosted-tool-sequence', expectedTools: ['replace_video_segment'] },
    ],
  },
  {
    id: 'uploaded-video-extend',
    focus: 'uploaded_video_edits',
    description: 'Uploaded-video extension targets the uploaded base clip instead of regenerating from scratch.',
    userText: 'Extend this uploaded video by 5 seconds.',
    mediaReferences: [{ kind: 'video', filename: 'source.mp4' }],
    expectations: [
      { surface: 'chat', entrypoint: 'workflow fixture extend-video-uploaded-five-seconds', expectedTools: ['extend_video'] },
      { surface: 'api_chat_completions', entrypoint: '/v1/chat/completions', expectedTools: ['extend_video'] },
      { surface: 'api_creative_agent_workflows', entrypoint: '/v1/creative-agent/workflows', expectedTools: ['extend_video'] },
      { surface: 'public_skill', entrypoint: '--api-workflow hosted-tool-sequence', expectedTools: ['extend_video'] },
    ],
  },
  {
    id: 'uploaded-video-transform',
    focus: 'uploaded_video_edits',
    description: 'Uploaded-video restyling routes to video_to_video and does not generate new source media first.',
    userText: 'Transform this uploaded video into watercolor anime style while preserving the motion.',
    mediaReferences: [{ kind: 'video', filename: 'street.mp4' }],
    expectations: [
      { surface: 'chat', entrypoint: 'workflow fixture uploaded-video-restyle', expectedTools: ['video_to_video'] },
      { surface: 'api_chat_completions', entrypoint: '/v1/chat/completions', expectedTools: ['video_to_video'] },
      { surface: 'api_creative_agent_workflows', entrypoint: '/v1/creative-agent/workflows', expectedTools: ['video_to_video'] },
      { surface: 'public_skill', entrypoint: '--api-workflow hosted-tool-sequence', expectedTools: ['video_to_video'] },
    ],
  },
  {
    id: 'uploaded-video-stitch',
    focus: 'uploaded_video_edits',
    description: 'Simple uploaded-video stitch requests preserve upload/UI order and default to hard cuts.',
    userText: 'Combine these 2 clips.',
    mediaReferences: [
      { kind: 'video', filename: 'first.mp4' },
      { kind: 'video', filename: 'second.mp4' },
    ],
    expectations: [
      { surface: 'chat', entrypoint: 'workflow fixture uploaded-videos-simple-stitch-hard-cut', expectedTools: ['stitch_video'] },
      { surface: 'api_chat_completions', entrypoint: '/v1/chat/completions', expectedTools: ['stitch_video'] },
      { surface: 'api_creative_agent_workflows', entrypoint: '/v1/creative-agent/workflows', expectedTools: ['stitch_video'] },
      { surface: 'public_skill', entrypoint: '--api-workflow hosted-tool-sequence', expectedTools: ['stitch_video'] },
    ],
  },
  {
    id: 'uploaded-video-alternating-splice',
    focus: 'uploaded_video_edits',
    description: 'Alternating uploaded-video splices compile into repeated replace_video_segment existing-clip calls.',
    userText: 'Create a video where you alternate 1s from each of these videos one after another.',
    mediaReferences: [
      { kind: 'video', filename: 'first.mp4' },
      { kind: 'video', filename: 'second.mp4' },
    ],
    expectations: [
      { surface: 'chat', entrypoint: 'workflow fixture uploaded-videos-alternating-one-second-splices', expectedTools: ['replace_video_segment'] },
      { surface: 'api_chat_completions', entrypoint: '/v1/chat/completions', expectedTools: ['replace_video_segment'] },
      { surface: 'api_creative_agent_workflows', entrypoint: '/v1/creative-agent/workflows', expectedTools: ['replace_video_segment'] },
      { surface: 'public_skill', entrypoint: '--api-workflow hosted-tool-sequence', expectedTools: ['replace_video_segment'] },
    ],
  },
  {
    id: 'asset-manifest-model-map-sequence',
    focus: 'asset_manifest_sequence',
    description: 'Generated assets are labeled, mapped for the target model, and validated through the shared manifest tools.',
    userText: 'Create a product hero, label it as hero product, map it for Seedance, then validate the reference.',
    expectations: [
      {
        surface: 'chat',
        entrypoint: 'asset manifest workflow',
        expectedTools: ['create_asset_manifest', 'label_asset', 'map_assets_for_model', 'validate_asset_references'],
      },
      {
        surface: 'api_chat_completions',
        entrypoint: '/v1/chat/completions',
        expectedTools: ['create_asset_manifest', 'label_asset', 'map_assets_for_model', 'validate_asset_references'],
      },
      {
        surface: 'api_creative_agent_workflows',
        entrypoint: '/v1/creative-agent/workflows',
        expectedTools: ['create_asset_manifest', 'label_asset', 'map_assets_for_model', 'validate_asset_references'],
      },
      {
        surface: 'public_skill',
        entrypoint: 'generated creative-agent runtime',
        expectedTools: ['create_asset_manifest', 'label_asset', 'map_assets_for_model', 'validate_asset_references'],
      },
    ],
  },
  {
    id: 'durable-workflow-cancel',
    focus: 'cancellation',
    description: 'Cancellation is exposed as the same durable workflow state transition across clients.',
    userText: 'Cancel workflow wf_test.',
    expectations: [
      { surface: 'chat', entrypoint: 'workflow status controls', expectedBehavior: ['cancelled workflow is terminal'] },
      { surface: 'api_chat_completions', entrypoint: '/v1/chat/completions tool execution', expectedBehavior: ['USER_CANCELLED maps to cancelled'] },
      { surface: 'api_creative_agent_workflows', entrypoint: '/v1/creative-agent/workflows/:id/cancel', expectedBehavior: ['idempotent cancel response'] },
      { surface: 'public_skill', entrypoint: '--cancel-workflow', expectedBehavior: ['posts to durable cancel endpoint'] },
    ],
  },
  {
    id: 'durable-workflow-duplicate-start',
    focus: 'duplicate_start',
    description: 'Repeated workflow starts with an idempotency key return the existing run instead of launching a duplicate.',
    userText: 'Start the same durable workflow twice with idempotency key idem_123.',
    expectations: [
      { surface: 'chat', entrypoint: 'hosted tool workflow tracking', expectedBehavior: ['workflowId remains stable for duplicate start'] },
      { surface: 'api_chat_completions', entrypoint: '/v1/chat/completions', expectedBehavior: ['hosted tool workflow tracking keeps one parent run'] },
      { surface: 'api_creative_agent_workflows', entrypoint: '/v1/creative-agent/workflows', expectedRequest: { headers: { 'Idempotency-Key': 'idem_123' } } },
      { surface: 'public_skill', entrypoint: '--api-workflow', expectedBehavior: ['forwards workflow idempotency metadata when provided'] },
    ],
  },
  {
    id: 'generated-video-rerender-latest',
    focus: 'generated_video_rerender',
    description: 'Latest generated-video rerenders reuse the prior video arguments rather than starting a new unrelated render.',
    userText: 'Rerender the latest video with the same prompt, but make it vertical.',
    expectations: [
      { surface: 'chat', entrypoint: 'workflow fixture seedance-uploaded-video-rerender-same-prompt', expectedTools: ['generate_video'] },
      { surface: 'api_chat_completions', entrypoint: '/v1/chat/completions', expectedTools: ['generate_video'] },
      { surface: 'api_creative_agent_workflows', entrypoint: '/v1/creative-agent/workflows', expectedTools: ['generate_video'] },
      { surface: 'public_skill', entrypoint: '--api-chat', expectedTools: ['generate_video'] },
    ],
  },
  {
    id: 'seedance-storyboard-rerender',
    focus: 'seedance_storyboard_rerender',
    description: 'Seedance storyboard rerenders keep the storyboard reference and compile into one generate_video rerender.',
    userText: 'Try that Seedance storyboard video again with the same script, but make the camera movement smoother.',
    mediaReferences: [{ kind: 'image', filename: 'storyboard.png' }],
    expectations: [
      { surface: 'chat', entrypoint: 'workflow fixture seedance-storyboard-rerender-same-script', expectedTools: ['generate_video'] },
      { surface: 'api_chat_completions', entrypoint: '/v1/chat/completions', expectedTools: ['generate_video'] },
      { surface: 'api_creative_agent_workflows', entrypoint: '/v1/creative-agent/workflows', expectedTools: ['generate_video'] },
      { surface: 'public_skill', entrypoint: '--api-workflow storyboard-video', expectedTools: ['generate_video'] },
    ],
  },
  {
    id: 'image-selection-wait-before-video',
    focus: 'image_selection_wait',
    description: 'Image-option batches requested for later video pause after image generation until the user selects one.',
    userText: "Generate 4 image takes and I'll pick the best one before you make the dance video.",
    expectations: [
      { surface: 'chat', entrypoint: 'workflow fixture snow-white-pick-before-dance', expectedTools: ['generate_image'], expectedBehavior: ['waits for user image selection before video tools'] },
      { surface: 'api_chat_completions', entrypoint: '/v1/chat/completions', expectedTools: ['generate_image'], expectedBehavior: ['imageSelectionPolicy=wait_for_user_selection'] },
      { surface: 'api_creative_agent_workflows', entrypoint: '/v1/creative-agent/workflows', expectedTools: ['generate_image'], expectedBehavior: ['stores pending selection state before video continuation'] },
      { surface: 'public_skill', entrypoint: '--api-chat', expectedTools: ['generate_image'], expectedBehavior: ['uses public skill default contract runtime selection policy'] },
    ],
  },
  {
    id: 'stitch-after-generated-batch',
    focus: 'stitch_after_batch',
    description: 'Generated clip batches that must become one video require stitch_video before finalization.',
    userText: 'Animate these generated keyframes as separate clips, then stitch the clips into one video.',
    expectations: [
      { surface: 'chat', entrypoint: 'workflow fixture uploaded-reference-skit-loop-stitch', expectedTools: ['animate_photo', 'stitch_video'] },
      { surface: 'api_chat_completions', entrypoint: '/v1/chat/completions', expectedTools: ['animate_photo', 'stitch_video'] },
      { surface: 'api_creative_agent_workflows', entrypoint: '/v1/creative-agent/workflows', expectedTools: ['animate_photo', 'stitch_video'] },
      { surface: 'public_skill', entrypoint: '--api-workflow hosted-tool-sequence', expectedTools: ['animate_photo', 'stitch_video'] },
    ],
  },
  {
    id: 'skill-audio-video-media-refs',
    focus: 'skill_media_refs',
    description: 'Public skill uploads local audio and video refs as stored media references instead of embedding base64 in prompts.',
    userText: 'Make a music video from this audio and source video.',
    mediaReferences: [
      { kind: 'audio', filename: 'music.mp3' },
      { kind: 'video', filename: 'source.mp4' },
    ],
    expectations: [
      { surface: 'chat', entrypoint: 'uploaded file context', expectedBehavior: ['audio and video are distinct uploaded media refs'] },
      { surface: 'api_chat_completions', entrypoint: '/v1/chat/completions', expectedRequest: { media_references: true } },
      { surface: 'api_creative_agent_workflows', entrypoint: '/v1/creative-agent/workflows', expectedRequest: { media_references: true } },
      { surface: 'public_skill', entrypoint: '--api-chat and --api-workflow', expectedBehavior: ['local files are uploaded to Sogni media URLs before durable execution'] },
    ],
  },
  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 5 — Durable hosted chat runs (Slice F). Fixtures #24-27.
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'durable-chat-run-completes-after-browser-close',
    focus: 'durable_chat_run_completion_after_close',
    description:
      'A durable chat run that spans multiple tool rounds finishes server-side after the client disconnects; rehydration via getRun returns the final assistant response and artifacts without re-running the LLM.',
    userText:
      'Make me a 12-second storyboard video with three scenes — go ahead and execute the full plan without waiting for me.',
    expectations: [
      {
        surface: 'chat',
        entrypoint: 'sogni.chat.runs.create',
        expectedBehavior: [
          'session.pendingDurableRunId is set immediately on submit',
          'after browser close + reopen, resumeDurableChatRun fetches the terminal record and surfaces finalResponse without re-running the LLM',
        ],
      },
      {
        surface: 'api_chat_completions',
        entrypoint: 'POST /v1/chat/runs',
        expectedRequest: { messages: true },
        expectedBehavior: [
          'returns 202 with run record on first submit',
          'GET /v1/chat/runs/:id returns finalResponse + artifacts once status=completed',
        ],
      },
      {
        surface: 'api_creative_agent_workflows',
        entrypoint: 'subrun creative_workflows[]',
        expectedBehavior: [
          'child workflow ids are captured on chat-run.childWorkflowIds for paid-artifact preservation',
        ],
      },
      {
        surface: 'public_skill',
        entrypoint: 'sogni.chat.runs.create via SDK transport',
        expectedBehavior: [
          'skill can recover a durable run id from local state and rehydrate via SDK getRun',
        ],
      },
    ],
  },
  {
    id: 'durable-chat-run-resumes-after-api-worker-restart',
    focus: 'durable_chat_run_resume_after_worker_restart',
    description:
      'A durable chat run whose executor lease expired (API worker crashed mid-tool-round) is picked up by the recovery scanner and resumes from the last persisted checkpoint — no duplicate paid work.',
    userText: 'Generate four versions and stitch the best into a final clip.',
    expectations: [
      {
        surface: 'chat',
        entrypoint: 'resumeDurableChatRun on reload',
        expectedBehavior: [
          'SSE replay uses Last-Event-ID derived from pendingDurableRunLastSequence',
          'recovery scanner appends a run_resumed event observable in SSE',
        ],
      },
      {
        surface: 'api_chat_completions',
        entrypoint: 'POST /v1/chat/runs + ChatRunRecoveryService.scanOnce',
        expectedBehavior: [
          'recovery worker acquires the lease, increments recovery.resumeCount, and continues from completed-step checkpoints',
          'persisted toolResults are not re-executed',
        ],
      },
      {
        surface: 'api_creative_agent_workflows',
        entrypoint: '/v1/creative-agent/workflows recovery worker',
        expectedBehavior: [
          'parallel pattern: workflow recovery and chat-run recovery both expose metrics on /v1/internal/recovery-metrics',
        ],
      },
      {
        surface: 'public_skill',
        entrypoint: 'sogni.chat.runs.streamEvents w/ lastEventId',
        expectedBehavior: ['skill can resume the SSE stream after disconnect using Last-Event-ID'],
      },
    ],
  },
  {
    id: 'durable-chat-run-waiting-for-user',
    focus: 'durable_chat_run_waiting_for_user',
    description:
      'A durable chat run that emits ask_clarifying_question (or hits a cost approval gate) transitions to waiting_for_user and stops; forced tool execution must NOT resume until the user replies.',
    userText:
      'Make me something cool — and ask me what vibe to go for before you start.',
    expectations: [
      {
        surface: 'chat',
        entrypoint: 'durableChatRuns onWaitingForUser callback',
        expectedBehavior: [
          'onWaitingForUser fires and the assistant question renders verbatim',
          'pendingDurableRunId remains set so the next user reply can reopen the same run',
        ],
      },
      {
        surface: 'api_chat_completions',
        entrypoint: 'ChatRunExecutorService.runRound (adapter returns waiting)',
        expectedBehavior: [
          'status=waiting_for_user, waiting.reason=ask_clarifying_question is persisted',
          'no further LLM rounds are executed until a new turn submission references the run',
        ],
      },
      {
        surface: 'api_creative_agent_workflows',
        entrypoint: '/v1/creative-agent/workflows analogue (waiting_for_user)',
        expectedBehavior: [
          'chat-run waiting state behaves like workflow waiting_for_user — no auto-resume by the recovery scanner',
        ],
      },
      {
        surface: 'public_skill',
        entrypoint: 'sogni.chat.runs.get',
        expectedBehavior: [
          'skill can read waiting.reason + waiting.message and surface them in the CLI',
        ],
      },
    ],
  },
  {
    id: 'sdk-flat-namespace-rest-parity',
    focus: 'sdk_flat_namespace_rest_parity',
    description:
      'The flat SDK namespaces (sogni.chat.runs.*, sogni.workflows.*) wrap the underlying REST resources without changing semantics. Identical inputs must produce identical durable record shapes whether the caller used the SDK method or hit the REST endpoint directly.',
    userText: 'Generate a 4-second clip and stitch it with the previous one.',
    expectations: [
      {
        surface: 'chat',
        entrypoint: 'sogni.chat.runs.create',
        expectedBehavior: [
          'SDK wrapper forwards messages, tools, idempotencyKey, and tokenType to POST /v1/chat/runs with no transform',
          'returned ChatRunRecord is the same shape produced by the REST controller',
        ],
      },
      {
        surface: 'api_chat_completions',
        entrypoint: 'POST /v1/chat/runs (direct REST)',
        expectedBehavior: [
          'direct REST submit with the same body produces the same persisted ChatRunRecord as the SDK call (after normalizing id + timestamps)',
        ],
      },
      {
        surface: 'api_creative_agent_workflows',
        entrypoint: 'sogni.workflows.start vs POST /v1/creative-agent/workflows',
        expectedBehavior: [
          'sogni.workflows.start and direct REST submission yield identical CreativeWorkflowRecord shapes for the same input plan',
        ],
      },
      {
        surface: 'public_skill',
        entrypoint: '--api-workflow start via SDK transport',
        expectedBehavior: [
          'when SOGNI_SKILL_USE_SDK_TRANSPORT=1, the skill\'s workflow start goes through sogni.workflows.start and produces the same record as the legacy fetch path',
        ],
      },
    ],
  },
  {
    id: 'api-socket-session-reuse-across-concurrent-submissions',
    focus: 'api_socket_session_reuse',
    description:
      'The hosted API\'s SogniClientSessionService reuses a single authenticated SDK socket for concurrent project submissions under the same owner/key scope. Two back-to-back tool calls in one chat-run must share the same pooled client, not construct a fresh SDK instance per call.',
    userText: 'Generate four images in parallel, then animate the best two.',
    expectations: [
      {
        surface: 'chat',
        entrypoint: 'sogni.chat.runs.create (drives tool execution)',
        expectedBehavior: [
          'multiple tool rounds in a single chat run do not visibly stall on socket reconnects',
        ],
      },
      {
        surface: 'api_chat_completions',
        entrypoint: 'ToolExecutionService.executeSogniToolCalls via withSession',
        expectedBehavior: [
          'withSession() borrows an existing pooled client when one matches the (env, owner, keyFingerprint, tokenType, appSource) scope',
          'parallel tool calls for the same scope share one app-id; getMetricsSnapshot() shows reuseCount > 0',
        ],
      },
      {
        surface: 'api_creative_agent_workflows',
        entrypoint: 'CreativeWorkflowExecutor uses the same pool',
        expectedBehavior: [
          'durable workflow steps share the same pool as durable chat runs — same scope key, same pooled client',
        ],
      },
      {
        surface: 'public_skill',
        entrypoint: 'n/a (server-side concern)',
        expectedBehavior: [
          'no public-skill surface; this fixture protects the API pool only',
        ],
      },
    ],
  },
  {
    id: 'public-skill-sdk-transport-no-direct-rest',
    focus: 'public_skill_sdk_transport',
    description:
      'When SOGNI_SKILL_USE_SDK_TRANSPORT=1, the public skill\'s durable chat-run and durable-workflow happy paths route through sogni-client SDK methods rather than calling /v1/chat/runs* or /v1/creative-agent/workflows* via fetchApiJson.',
    userText: 'Generate a storyboard video from this concept.',
    expectations: [
      {
        surface: 'chat',
        entrypoint: 'n/a (browser-only)',
        expectedBehavior: ['this fixture is skill-only; chat surface always uses the SDK directly'],
      },
      {
        surface: 'api_chat_completions',
        entrypoint: 'POST /v1/chat/runs (SDK transport)',
        expectedBehavior: [
          'request reaches the API via SogniClient.chat.runs.create; no parallel direct fetch is made',
        ],
      },
      {
        surface: 'api_creative_agent_workflows',
        entrypoint: 'POST /v1/creative-agent/workflows (SDK transport)',
        expectedBehavior: [
          'request reaches the API via SogniClient.workflows.start; no parallel direct fetch is made',
        ],
      },
      {
        surface: 'public_skill',
        entrypoint: 'sogni-agent.mjs with SOGNI_SKILL_USE_SDK_TRANSPORT=1',
        expectedBehavior: [
          'SogniHostedClientFactory is constructed and SSRF-validates the endpoints before any request',
          'no fetchApiJson call for /v1/chat/runs* or /v1/creative-agent/workflows* happy-path operations',
          'legacy fetch path still handles the long tail (e.g. /v1/media/uploadUrl) until SDK absorbs it',
        ],
      },
    ],
  },
];
