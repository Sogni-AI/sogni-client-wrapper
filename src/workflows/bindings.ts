/**
 * Template binding resolver for Workflow stage args.
 *
 * Stages declare their args with placeholders like:
 *   "$inputs.photo"
 *   "$artifacts.angle_images.items[0].selectedVersion.url"
 *   "$artifacts.transition_clips.items[*].selectedVersion.url"  // array expand
 *   "$item.azimuth"
 *   "$item.from.selectedVersion.url"
 *   "$runtime.uploadedFiles[0]"
 *   "$run.id"
 *
 * At execution time, `resolveBindings()` walks the args tree recursively.
 *
 * - **Pure binding strings** (the whole string is `$root.path`): replaced
 *   with the resolved value AT TYPE (number stays number, array stays
 *   array, the selected ArtifactVersion stays the object).
 * - **Embedded bindings** (literal text containing `$inputs.X`,
 *   `$artifacts.X.Y`, `$item.X`, etc.): every match is replaced with the
 *   resolved value stringified, so prompts can naturally template a few
 *   inputs into a longer instruction.
 *
 * The resolver is intentionally strict: unknown paths throw so the executor
 * can fail fast and the builder can surface the error before a Run starts.
 * Embedded bindings whose paths fail throw the same `BindingError` rather
 * than silently leaving the `$inputs.foo` text in the rendered prompt.
 */

import type { Artifact, ArtifactItem, ArtifactVersion, BindingContext } from './types.js';

// ---------------------------------------------------------------------------
// Path parsing
// ---------------------------------------------------------------------------

export type PathSegment =
  | { kind: 'field'; name: string }
  | { kind: 'index'; index: number }
  | { kind: 'wildcard' };

export interface ParsedBinding {
  root: 'inputs' | 'artifacts' | 'item' | 'runtime' | 'run';
  segments: PathSegment[];
  /** True if any segment is `[*]`, meaning the resolver returns an array. */
  hasWildcard: boolean;
}

const ROOT_PATTERN = /^\$(inputs|artifacts|item|runtime|run)(?:\.|\[)?/;

export function isBinding(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('$');
}

export function parseBinding(binding: string): ParsedBinding {
  const match = binding.match(ROOT_PATTERN);
  if (!match) {
    throw new BindingError(`Binding must start with $inputs/$artifacts/$item/$runtime/$run: ${binding}`);
  }
  const root = match[1] as ParsedBinding['root'];
  const rest = binding.slice(match[0].length - (binding[match[0].length - 1] === '.' || binding[match[0].length - 1] === '[' ? 1 : 0));

  const segments: PathSegment[] = [];
  let hasWildcard = false;
  let remaining = rest;

  while (remaining.length > 0) {
    if (remaining.startsWith('.')) {
      remaining = remaining.slice(1);
      continue;
    }
    if (remaining.startsWith('[')) {
      const end = remaining.indexOf(']');
      if (end === -1) {
        throw new BindingError(`Unterminated bracket in binding: ${binding}`);
      }
      const inner = remaining.slice(1, end);
      if (inner === '*') {
        segments.push({ kind: 'wildcard' });
        hasWildcard = true;
      } else {
        const idx = Number(inner);
        if (!Number.isInteger(idx) || idx < 0) {
          throw new BindingError(`Invalid index in binding: ${binding}`);
        }
        segments.push({ kind: 'index', index: idx });
      }
      remaining = remaining.slice(end + 1);
      continue;
    }
    // Read a field name up to the next `.` or `[`
    const nextDot = remaining.indexOf('.');
    const nextBracket = remaining.indexOf('[');
    const stops = [nextDot, nextBracket].filter((i) => i !== -1);
    const stop = stops.length > 0 ? Math.min(...stops) : remaining.length;
    const name = remaining.slice(0, stop);
    if (!name) {
      throw new BindingError(`Empty path segment in binding: ${binding}`);
    }
    segments.push({ kind: 'field', name });
    remaining = remaining.slice(stop);
  }

  return { root, segments, hasWildcard };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export class BindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BindingError';
  }
}

/**
 * Recursively walk a value (object/array/primitive) and replace any string
 * that starts with `$` with the resolved binding value.
 */
export function resolveBindings<T>(value: T, ctx: BindingContext): T {
  return walk(value, ctx) as T;
}

function walk(value: unknown, ctx: BindingContext): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('$')) {
      return resolveOne(value, ctx);
    }
    if (value.indexOf('$') !== -1) {
      return interpolateString(value, ctx);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => walk(v, ctx));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walk(v, ctx);
    }
    return out;
  }
  return value;
}

// Match `$root.field[ix].field.field…` greedily but stop at whitespace,
// punctuation, and characters that can't legally appear in a binding path.
// Identifier chars: A-Z a-z 0-9 _. Brackets contain digits or `*`. Dots
// separate fields. The grammar matches the strict parseBinding form.
const EMBEDDED_BINDING_RE =
  /\$(?:inputs|artifacts|item|runtime|run)(?:\.[A-Za-z_][A-Za-z0-9_]*|\[(?:\d+|\*)\])+/g;

/**
 * Replace every `$root.path` reference embedded in a literal string with
 * its resolved value (stringified). Throws `BindingError` if any embedded
 * path is structurally invalid, walks into null, or resolves to undefined.
 * A workflow author embedding `$inputs.foo` clearly meant something to
 * substitute there; silently leaving an empty string would let typos
 * ship to production unnoticed.
 */
function interpolateString(value: string, ctx: BindingContext): string {
  return value.replace(EMBEDDED_BINDING_RE, (match) => {
    const resolved = resolveOne(match, ctx);
    if (resolved === undefined) {
      throw new BindingError(`Embedded binding resolved to undefined: ${match}`);
    }
    return stringifyEmbedded(resolved);
  });
}

function stringifyEmbedded(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // Arrays and objects flatten via JSON for safe roundtrip; pure-binding
  // callers wanting typed access should use the standalone `$path` form.
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function resolveOne(binding: string, ctx: BindingContext): unknown {
  const parsed = parseBinding(binding);
  const root = pickRoot(parsed.root, ctx, binding);
  return walkSegments(root, parsed.segments, binding);
}

function pickRoot(
  root: ParsedBinding['root'],
  ctx: BindingContext,
  binding: string,
): unknown {
  switch (root) {
    case 'inputs':
      return ctx.inputs;
    case 'artifacts':
      return ctx.artifacts;
    case 'item':
      if (!ctx.item) {
        throw new BindingError(`$item used outside a batch stage: ${binding}`);
      }
      return ctx.item;
    case 'runtime':
      return ctx.runtime ?? {};
    case 'run':
      return ctx.run ?? {};
  }
}

function walkSegments(
  start: unknown,
  segments: PathSegment[],
  binding: string,
): unknown {
  let current: unknown = start;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (current === undefined || current === null) {
      throw new BindingError(`Binding path walked into null/undefined: ${binding}`);
    }
    if (seg.kind === 'field') {
      // Special case: artifact traversal has convenience accessors
      // `.items[i].selectedVersion.url` → look up selected version live
      if (seg.name === 'selectedVersion' && isArtifactItem(current)) {
        current = getSelectedVersion(current);
        continue;
      }
      if (typeof current !== 'object' || Array.isArray(current)) {
        throw new BindingError(
          `Cannot read field "${seg.name}" on non-object in binding: ${binding}`,
        );
      }
      current = (current as Record<string, unknown>)[seg.name];
      continue;
    }
    if (seg.kind === 'index') {
      if (!Array.isArray(current)) {
        // Artifact is an object but conceptually a list — allow `.items[i]`
        if (isArtifact(current)) {
          current = current.items[seg.index];
          continue;
        }
        throw new BindingError(
          `Cannot read index [${seg.index}] on non-array in binding: ${binding}`,
        );
      }
      current = current[seg.index];
      continue;
    }
    if (seg.kind === 'wildcard') {
      // Expand the rest of the path over an array, returning an array of
      // resolved values. Only one wildcard per binding is supported.
      const arr = coerceToArray(current, binding);
      const remainingSegments = segments.slice(i + 1);
      return arr.map((el) => walkSegments(el, remainingSegments, binding));
    }
  }
  return current;
}

function coerceToArray(value: unknown, binding: string): unknown[] {
  if (Array.isArray(value)) return value;
  if (isArtifact(value)) return value.items;
  throw new BindingError(`Wildcard [*] applied to non-array in binding: ${binding}`);
}

function isArtifact(v: unknown): v is Artifact {
  return !!v
    && typeof v === 'object'
    && 'items' in (v as Record<string, unknown>)
    && 'kind' in (v as Record<string, unknown>)
    && 'name' in (v as Record<string, unknown>);
}

function isArtifactItem(v: unknown): v is ArtifactItem {
  return !!v
    && typeof v === 'object'
    && 'versions' in (v as Record<string, unknown>)
    && 'selectedVersionId' in (v as Record<string, unknown>);
}

function getSelectedVersion(item: ArtifactItem): ArtifactVersion {
  const version = item.versions.find((v) => v.id === item.selectedVersionId);
  if (!version) {
    throw new BindingError(
      `ArtifactItem "${item.id}" has no version matching selectedVersionId "${item.selectedVersionId}"`,
    );
  }
  return version;
}

// ---------------------------------------------------------------------------
// Binding introspection (for validation)
// ---------------------------------------------------------------------------

/**
 * Collect every binding string found in a value tree. Used by the validator
 * to verify that every referenced path is structurally valid at build time.
 */
export function collectBindings(value: unknown): string[] {
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (isBinding(v)) {
      out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    if (v !== null && typeof v === 'object') {
      Object.values(v as Record<string, unknown>).forEach(visit);
    }
  };
  visit(value);
  return out;
}
