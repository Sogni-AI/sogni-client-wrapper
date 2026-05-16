export type {
  AssetManifest,
  AssetRecord,
  AssetType,
  AssetReferenceValidationResult,
  KnownAssetModelId,
} from './types.js';

export {
  createAssetManifest,
  addAsset,
  updateAsset,
  findAsset,
  listAssets,
  mapAssetsForModel,
  validateAssetReferences,
} from './manifest.js';

export type { AddAssetInput, UpdateAssetInput } from './manifest.js';

export {
  formatModelRef,
  getModelRefFormat,
  getModelRefFormatEntries,
  getModelRefFormatResolution,
  listKnownAssetModelIds,
} from './modelRefRegistry.js';
export type { ModelRefFormat, ModelRefFormatResolution, ParsedModelRef } from './modelRefRegistry.js';
