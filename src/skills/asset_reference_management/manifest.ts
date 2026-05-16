/**
 * Pure helpers operating over an `AssetManifest`. Stateless — each
 * helper takes the current manifest (or partial input) and returns a
 * new value. Per-session storage is the consumer's responsibility.
 */

import { formatModelRef, getModelRefFormat, getModelRefFormatEntries } from './modelRefRegistry.js';
import type {
  AssetManifest,
  AssetRecord,
  AssetReferenceValidationResult,
  AssetType,
} from './types.js';

export function createAssetManifest(): AssetManifest {
  return {
    assets: [],
    next_index: 1,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Charset allowed for caller-supplied `asset_id` values. The auto-minted
 * ids (`asset_001`, …) and the chat-side conventions (`uploaded_image_1`)
 * fit easily inside this set; `.`, `:` and `/` are accepted for namespaced
 * ids consumers might adopt later. Anything outside the set — newlines,
 * chat-template tokens, prose imperatives — is rejected so a downstream
 * tool result cannot smuggle prompt-injection payloads through the asset
 * manifest into the system context block.
 */
const ASSET_ID_PATTERN = /^[A-Za-z0-9_.:/-]+$/;
const MAX_ASSET_ID_LENGTH = 128;

function validateAssetIdOrThrow(rawId: string): void {
  if (rawId.length === 0) {
    // Empty values fall back to the auto-minted id; nothing to validate.
    return;
  }
  if (rawId.length > MAX_ASSET_ID_LENGTH) {
    throw new Error(
      `Invalid asset_id: must be at most ${MAX_ASSET_ID_LENGTH} characters`,
    );
  }
  if (!ASSET_ID_PATTERN.test(rawId)) {
    throw new Error(
      'Invalid asset_id: must match /^[A-Za-z0-9_.:/-]+$/ (no whitespace, control chars, or punctuation)',
    );
  }
}

export interface AddAssetInput {
  user_label: string;
  type: AssetType;
  description?: string;
  url?: string;
  must_preserve?: readonly string[];
  avoid?: readonly string[];
  metadata?: Readonly<Record<string, unknown>>;
  /** Override the auto-minted asset_id. Useful when adopting an id from a tool result. */
  asset_id?: string;
}

export function addAsset(manifest: AssetManifest, input: AddAssetInput): {
  manifest: AssetManifest;
  asset: AssetRecord;
} {
  const requestedId = (input.asset_id ?? `asset_${manifest.next_index.toString().padStart(3, '0')}`).trim();
  // Validate caller-supplied ids before they can land in the manifest and
  // flow into the LLM system context block (`assetManifestHints`). This is
  // primary defense against cross-tool prompt injection.
  validateAssetIdOrThrow(requestedId);
  const existingIds = new Set(manifest.assets.map((asset) => asset.asset_id));
  let asset_id = requestedId || `asset_${manifest.next_index.toString().padStart(3, '0')}`;
  if (existingIds.has(asset_id)) {
    const base = asset_id;
    let suffix = 2;
    while (existingIds.has(`${base}_${suffix}`)) suffix += 1;
    asset_id = `${base}_${suffix}`;
  }
  const asset: AssetRecord = {
    asset_id,
    user_label: input.user_label.trim() || asset_id,
    type: input.type,
    description: input.description?.trim() || undefined,
    url: input.url?.trim() || undefined,
    must_preserve: input.must_preserve?.length ? [...input.must_preserve] : undefined,
    avoid: input.avoid?.length ? [...input.avoid] : undefined,
    metadata: input.metadata,
  };
  return {
    manifest: {
      assets: [...manifest.assets, asset],
      next_index: manifest.next_index + 1,
      updated_at: new Date().toISOString(),
    },
    asset,
  };
}

export interface UpdateAssetInput {
  asset_id: string;
  user_label?: string;
  description?: string;
  must_preserve?: readonly string[];
  avoid?: readonly string[];
  metadata?: Readonly<Record<string, unknown>>;
  url?: string;
}

export function updateAsset(manifest: AssetManifest, input: UpdateAssetInput): {
  manifest: AssetManifest;
  asset: AssetRecord;
} | null {
  const idx = manifest.assets.findIndex((a) => a.asset_id === input.asset_id);
  if (idx < 0) return null;
  const prev = manifest.assets[idx]!;
  const next: AssetRecord = {
    ...prev,
    user_label: input.user_label?.trim() ? input.user_label.trim() : prev.user_label,
    description:
      input.description !== undefined
        ? input.description.trim() || undefined
        : prev.description,
    must_preserve: input.must_preserve ? [...input.must_preserve] : prev.must_preserve,
    avoid: input.avoid ? [...input.avoid] : prev.avoid,
    metadata: input.metadata !== undefined ? input.metadata : prev.metadata,
    url: input.url !== undefined ? input.url.trim() || undefined : prev.url,
  };
  const assets = [...manifest.assets];
  assets[idx] = next;
  return {
    manifest: { ...manifest, assets, updated_at: new Date().toISOString() },
    asset: next,
  };
}

export function findAsset(
  manifest: AssetManifest,
  selector: { asset_id?: string; user_label?: string },
): AssetRecord | null {
  if (selector.asset_id) {
    const byId = manifest.assets.find((a) => a.asset_id === selector.asset_id);
    if (byId) return byId;
  }
  if (selector.user_label) {
    const target = selector.user_label.trim().toLowerCase();
    if (target) {
      const byLabel = manifest.assets.find((a) => a.user_label.toLowerCase() === target);
      if (byLabel) return byLabel;
    }
  }
  return null;
}

/**
 * Build per-asset `model_ref` tokens for the given `model_id`. Indices
 * are assigned in declaration order, restarting at 1 per asset type so
 * Seedance/GPT-Image-2 prompts get `@Image1, @Image2, @Video1` rather
 * than `@Image1, @Image2, @Image3` for a mixed manifest.
 */
export function mapAssetsForModel(
  manifest: AssetManifest,
  modelId: string,
): ReadonlyArray<{ asset_id: string; user_label: string; type: AssetType; model_ref: string }> {
  const perTypeIndex = new Map<AssetType, number>();
  const out: Array<{ asset_id: string; user_label: string; type: AssetType; model_ref: string }> = [];
  for (const asset of manifest.assets) {
    const next = (perTypeIndex.get(asset.type) ?? 0) + 1;
    perTypeIndex.set(asset.type, next);
    out.push({
      asset_id: asset.asset_id,
      user_label: asset.user_label,
      type: asset.type,
      model_ref: formatModelRef(modelId, next, asset.type),
    });
  }
  return out;
}

function normalizeLabelForMatching(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function metadataAliases(metadata: Readonly<Record<string, unknown>> | undefined): string[] {
  const rawAliases = metadata?.aliases ?? metadata?.alias;
  if (typeof rawAliases === 'string') return [rawAliases];
  if (!Array.isArray(rawAliases)) return [];
  return rawAliases.filter((item): item is string => typeof item === 'string');
}

function labelCandidatesForAsset(asset: AssetRecord): string[] {
  return [asset.user_label, ...metadataAliases(asset.metadata)]
    .map((label) => label.trim())
    .filter((label, index, labels) => label.length > 0 && labels.indexOf(label) === index);
}

function normalizedTextMentionsLabel(normalizedText: string, normalizedLabel: string): boolean {
  if (!normalizedText || !normalizedLabel) return false;
  return ` ${normalizedText} `.includes(` ${normalizedLabel} `);
}

function ambiguousLabelsForPrompt(manifest: AssetManifest, promptText: string): string[] {
  const normalizedText = normalizeLabelForMatching(promptText);
  if (!normalizedText) return [];

  const labelsByNormalized = new Map<string, { display: string; assetIds: Set<string> }>();
  for (const asset of manifest.assets) {
    for (const label of labelCandidatesForAsset(asset)) {
      const normalized = normalizeLabelForMatching(label);
      if (!normalized) continue;
      const entry = labelsByNormalized.get(normalized) ?? {
        display: label,
        assetIds: new Set<string>(),
      };
      entry.assetIds.add(asset.asset_id);
      labelsByNormalized.set(normalized, entry);
    }
  }

  const ambiguous: string[] = [];
  for (const [normalized, entry] of labelsByNormalized) {
    if (entry.assetIds.size < 2) continue;
    if (!normalizedTextMentionsLabel(normalizedText, normalized)) continue;
    ambiguous.push(entry.display);
  }
  return ambiguous.sort((a, b) => a.localeCompare(b));
}

/**
 * Scan a prompt for asset references in `modelId`'s format and for any
 * `user_label` mentions. Returns resolved/dangling tokens so the caller
 * can decide whether to refine the prompt before dispatch.
 */
export function validateAssetReferences(
  manifest: AssetManifest,
  modelId: string,
  promptText: string,
): AssetReferenceValidationResult {
  const fmt = getModelRefFormat(modelId);
  const mapping = mapAssetsForModel(manifest, modelId);
  const refToAsset = new Map(mapping.map((m) => [m.model_ref, m]));

  const resolved: Array<{ token: string; asset_id: string; user_label: string }> = [];
  const dangling: Array<AssetReferenceValidationResult['dangling'][number]> = [];

  const text = promptText || '';
  // Dedup tokens — a prompt that mentions Image 1 three times is one logical reference.
  const seenTokens = new Set<string>();
  for (const match of text.matchAll(fmt.scanRegex)) {
    const token = match[0];
    if (seenTokens.has(token)) continue;
    seenTokens.add(token);
    const hit = refToAsset.get(token);
    if (hit) {
      resolved.push({ token, asset_id: hit.asset_id, user_label: hit.user_label });
      continue;
    }
    const parsed = fmt.parse(token);
    if (!parsed) {
      dangling.push({ token, reason: 'unknown_model_ref' });
      continue;
    }
    const sameType = mapping.filter((m) => !parsed.type || m.type === parsed.type);
    const aliasHit = sameType[parsed.index - 1];
    if (aliasHit) {
      resolved.push({ token, asset_id: aliasHit.asset_id, user_label: aliasHit.user_label });
    } else if (sameType.length === 0 || parsed.index > sameType.length) {
      dangling.push({ token, reason: 'index_out_of_range' });
    } else {
      // Falls within range but did not match any supported alias.
      dangling.push({ token, reason: 'unknown_model_ref' });
    }
  }

  for (const entry of getModelRefFormatEntries()) {
    const otherFormat = entry.format;
    if (otherFormat === fmt) continue;
    for (const match of text.matchAll(otherFormat.scanRegex)) {
      const token = match[0];
      if (seenTokens.has(token)) continue;
      const parsedByTarget = fmt.parse(token);
      if (parsedByTarget) continue;
      const parsedByOther = otherFormat.parse(token);
      if (!parsedByOther) continue;
      seenTokens.add(token);
      dangling.push({
        token,
        reason: 'wrong_model_ref_format',
        expected_model_id: modelId,
      });
    }
  }

  return {
    resolved,
    dangling,
    ambiguous_labels: ambiguousLabelsForPrompt(manifest, text),
  };
}

export function listAssets(manifest: AssetManifest): readonly AssetRecord[] {
  return manifest.assets;
}
