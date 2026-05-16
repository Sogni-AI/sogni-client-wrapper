/**
 * Summarise per-slot failures from a fan-out tool (animate_photo,
 * generate_video, sound_to_video, etc.) into a stable code + a short
 * sanitized phrase that the manual-wait formatter can weave into the
 * user-visible message.
 *
 * The aim is to give the user one actionable hint about WHY a slot failed
 * (worker disconnected, content refused, etc.) without leaking SDK
 * internals, stack traces, or vendor diagnostic strings.
 *
 * Pure logic — used by all three consumers of the shared package.
 */

import { classifyError } from './errorClassification.js';

export type SlotFailureCode =
  | 'worker_disconnected'
  | 'timeout'
  | 'content_refused'
  | 'insufficient_credits'
  | 'transient_failure'
  | 'cancelled'
  | 'permanent_failure';

export interface SlotFailureSummary {
  code: SlotFailureCode;
  reason: string;
}

const REASON_BY_CODE: Record<SlotFailureCode, string> = {
  worker_disconnected: 'the generation worker disconnected',
  timeout: 'the generation service stopped responding',
  content_refused: 'the prompt was blocked by content moderation',
  insufficient_credits: 'the account ran out of credits',
  transient_failure: 'a temporary network issue interrupted the job',
  cancelled: 'the job was cancelled before completing',
  permanent_failure: 'the generation worker reported a permanent failure',
};

const PRIORITY: SlotFailureCode[] = [
  'worker_disconnected',
  'timeout',
  'content_refused',
  'insufficient_credits',
  'transient_failure',
  'cancelled',
  'permanent_failure',
];

function codeForError(slotError: unknown): SlotFailureCode | null {
  if (!slotError) return null;
  const message = slotError instanceof Error ? slotError.message : String(slotError);
  const lower = message.toLowerCase();

  if (lower.includes('worker disconnected') || lower.includes('workerdisconnected')) {
    return 'worker_disconnected';
  }

  const classified = classifyError(slotError);
  switch (classified.category) {
    case 'timeout':
      return 'timeout';
    case 'content_refused':
      return 'content_refused';
    case 'insufficient_credits':
      return 'insufficient_credits';
    case 'transient_failure':
      return 'transient_failure';
    case 'cancelled':
      return 'cancelled';
    case 'permanent_failure':
      return 'permanent_failure';
    default:
      return null;
  }
}

export function summarizeSlotFailures(
  slotErrors: ReadonlyArray<unknown>,
): SlotFailureSummary | undefined {
  const seen = new Set<SlotFailureCode>();
  for (const slotError of slotErrors) {
    const code = codeForError(slotError);
    if (code) seen.add(code);
  }
  for (const code of PRIORITY) {
    if (seen.has(code)) {
      return { code, reason: REASON_BY_CODE[code] };
    }
  }
  return undefined;
}
