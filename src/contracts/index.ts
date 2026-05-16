/**
 * Public Sogni Intelligence contracts surface — carved out of @sogni/creative-agent.
 *
 * The package.json `exports` map publishes this module as
 * `@sogni-ai/sogni-intelligence-client/contracts` for downstream consumers.
 *
 * Source of truth: @sogni/creative-agent/contracts. This file is a re-export shim;
 * Phase 8.2 follow-up will physically move the source so creative-agent flips its
 * dep direction.
 */
// @ts-ignore — wrapper's tsconfig still uses moduleResolution:'node' (cannot read modern
// `exports` map at COMPILE time). Runtime is fine: the emitted require('@sogni/creative-agent/contracts')
// hits Node's exports-map require-condition and resolves to dist-cjs.
export * from '@sogni/creative-agent/contracts';
