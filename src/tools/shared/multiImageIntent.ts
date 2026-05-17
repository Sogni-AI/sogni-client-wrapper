/**
 * Detects whether user text explicitly requests multiple image outputs.
 *
 * Used by tool-call guardrails that auto-downgrade `numberOfVariations`
 * back to 1 when the user did not ask for multiple images. When this
 * function returns true, the caller should NOT downgrade.
 *
 * Caller responsibility: if the caller has additional negative guards
 * (e.g. single-composite-image detection, scene-count parsing), apply
 * them BEFORE consulting this function. This helper only inspects the
 * surface text and does not look at conversation state.
 */
export function textExplicitlyRequestsMultipleImageOutputs(text: string): boolean {
  return /\b(?:a\s+few|several|multiple|many|some)\s+(?:new\s+|different\s+|distinct\s+|alternate\s+)?(?:images?|photos?|pictures?|portraits?|versions?|variations?|variants?|options?|takes?|looks?|styles?|scenes?|settings?|backgrounds?|outfits?|poses?)\b/i.test(text)
    || /\b(?:images?|photos?|pictures?|portraits?|versions?|variations?|variants?|options?|takes?|looks?|styles?|scenes?)\b[\s\S]{0,40}\b(?:a\s+few|several|multiple|many)\b/i.test(text)
    || /\b(?:different|distinct|alternate|various|separate)\s+(?:images?|photos?|pictures?|portraits?|versions?|variations?|variants?|options?|takes?|looks?|styles?|scenes?|settings?|backgrounds?|outfits?|poses?)\b/i.test(text)
    || /\b(?:more|another|additional)\s+(?:images?|photos?|pictures?|portraits?|versions?|variations?|variants?|options?|takes?)\b/i.test(text)
    // Casual count-only follow-ups that lean on prior image context, e.g.
    // "draw 2 more", "give me 3 more", "make 2 additional", "another 2",
    // "2 more", "two more". Common after a previous image generation turn.
    || /\b(?:draw|generate|make|create|render|do|give\s+(?:me|us)|show\s+(?:me|us))\s+(?:me\s+|us\s+)?(?:\d{1,2}|two|three|four|five|six|seven|eight|nine|ten)\s+more\b/i.test(text)
    || /\b(?:another|additional)\s+(?:\d{1,2}|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(text)
    || /^\s*(?:\d{1,2}|two|three|four|five|six|seven|eight|nine|ten)\s+more\b/i.test(text);
}
