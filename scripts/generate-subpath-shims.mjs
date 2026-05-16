// Generates explicit named re-export shims for each public subpath the
// intelligence-client exposes. Necessary because the wrapper builds to CJS;
// `export * from '@sogni/creative-agent/...'` compiles to dynamic
// `__exportStar` which Rollup (used by Vite in sogni-web) can't statically
// analyze for named imports. Explicit names compile to static
// `Object.defineProperty` exports that Rollup can resolve.
//
// Enumerates BOTH runtime exports (via `Object.keys(require(src))`) AND
// type-only exports (by parsing `export {...}` blocks in the .d.ts file).
//
// Run after every wrapper build; outputs replace the hand-authored shims in
// `src/<subpath>/index.ts`.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const require_ = createRequire(import.meta.url);

const subpaths = [
  { src: '@sogni/creative-agent/contracts', target: 'src/contracts/index.ts' },
  { src: '@sogni/creative-agent/tools', target: 'src/tools/index.ts' },
  { src: '@sogni/creative-agent/replay', target: 'src/replay/index.ts' },
  { src: '@sogni/creative-agent/runtime', target: 'src/runtime/index.ts' },
  { src: '@sogni/creative-agent/media', target: 'src/media/index.ts' },
  { src: '@sogni/creative-agent/workflows', target: 'src/workflows/index.ts' },
  {
    src: '@sogni/creative-agent/skills/asset_reference_management',
    target: 'src/skills/asset_reference_management/index.ts',
  },
  {
    src: '@sogni/creative-agent/public-skill-runtime',
    target: 'src/public-skill-runtime/index.ts',
  },
];

// Walks the .d.ts barrel of a subpath and recursively collects every type
// name reachable from `export type { ... }` and `export type * from ...`
// re-exports. Pure type names that have no runtime counterpart need an
// explicit `export type` declaration on our side (`export {...}` of a
// pure-type symbol would error at compile time when isolatedModules is on
// and types are erased).
function collectTypeNames(dtsPath, seen = new Set()) {
  if (!existsSync(dtsPath) || seen.has(dtsPath)) return new Set();
  seen.add(dtsPath);
  const content = readFileSync(dtsPath, 'utf8');
  const types = new Set();

  // Match `export type { Name1, Name2 as X, ... } from "..."` and the same
  // without `from`. Also match bare `export type Name = ...` and `export
  // interface Name`.
  for (const m of content.matchAll(/export\s+type\s+\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const asMatch = trimmed.match(/\bas\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*$/);
      const name = asMatch ? asMatch[1] : trimmed.match(/[A-Za-z_$][A-Za-z0-9_$]*/)?.[0];
      if (name) types.add(name);
    }
  }
  for (const m of content.matchAll(/export\s+type\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/g)) {
    types.add(m[1]);
  }
  for (const m of content.matchAll(/export\s+interface\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/g)) {
    types.add(m[1]);
  }
  // Recurse into `export * from "./relative"` and `export type * from "./relative"`.
  for (const m of content.matchAll(/export\s+(?:type\s+)?\*\s+from\s+['"]([^'"]+)['"]/g)) {
    const rel = m[1];
    if (!rel.startsWith('.')) continue;
    const target = resolve(dirname(dtsPath), rel.endsWith('.js') ? rel.replace(/\.js$/, '.d.ts') : `${rel}.d.ts`);
    if (existsSync(target)) {
      for (const t of collectTypeNames(target, seen)) types.add(t);
    } else {
      const indexTarget = resolve(dirname(dtsPath), rel, 'index.d.ts');
      if (existsSync(indexTarget)) {
        for (const t of collectTypeNames(indexTarget, seen)) types.add(t);
      }
    }
  }
  return types;
}

function dtsPathFor(spec) {
  // Resolve via require.resolve to get the runtime JS path, then map to .d.ts.
  // Types live in `dist/` (ESM tree), not `dist-cjs/` (CJS tree which require
  // resolves to). Swap directories accordingly.
  const js = require_.resolve(spec);
  return js.replace('/dist-cjs/', '/dist/').replace(/\.js$/, '.d.ts');
}

for (const { src, target } of subpaths) {
  const m = require_(src);
  const runtimeNames = new Set(
    Object.keys(m).filter((k) => k !== 'default' && k !== '__esModule')
  );
  const dtsPath = dtsPathFor(src);
  const allTypes = collectTypeNames(dtsPath);
  // Pure type-only names = present in .d.ts but not in runtime.
  const typeOnlyNames = [...allTypes].filter((n) => !runtimeNames.has(n)).sort();
  const valueNames = [...runtimeNames].sort();

  const banner = [
    `/* eslint-disable */`,
    `// @ts-nocheck — wrapper's tsconfig uses moduleResolution:'node' which can't`,
    `// read the modern exports map at COMPILE time. Runtime resolution via Node's`,
    `// exports-map require-condition works correctly.`,
    `/**`,
    ` * Public ${src.replace('@sogni/creative-agent', '@sogni-ai/sogni-intelligence-client')}`,
    ` * surface — carved out of @sogni/creative-agent.`,
    ` *`,
    ` * Generated by scripts/generate-subpath-shims.mjs. Do not edit by hand.`,
    ` * Run \`npm run sync:subpath-shims\` to regenerate.`,
    ` *`,
    ` * Explicit named re-exports (not \`export *\`) so that downstream CJS`,
    ` * builds compile to statically analyzable named exports — required by`,
    ` * Vite/Rollup consumers (sogni-web, sogni-chat).`,
    ` */`,
    `export {`,
    ...valueNames.map((n) => `  ${n},`),
    `} from '${src}';`,
    '',
  ];
  if (typeOnlyNames.length > 0) {
    banner.push(`export type {`);
    for (const n of typeOnlyNames) banner.push(`  ${n},`);
    banner.push(`} from '${src}';`);
    banner.push('');
  }
  const fullPath = resolve(root, target);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, banner.join('\n'));

  // Also write a hand-rolled ESM `.mjs` shim alongside the TypeScript source.
  // The wrapper's tsc emits CJS for the .ts file (consumed by n8n via require);
  // the .mjs file is emitted as static ESM that Rollup can statically follow
  // through the chain. Vite's exports-map `import` condition points at this
  // .mjs file so bundler consumers (sogni-web) get the ESM path.
  const esmFullPath = fullPath.replace(/\.ts$/, '.mjs');
  const esmLines = [
    `// Generated by scripts/generate-subpath-shims.mjs. Do not edit by hand.`,
    `// Static ESM re-export of @sogni/creative-agent's subpath. Vite/Rollup`,
    `// can follow this through to the source via @sogni/creative-agent's own`,
    `// ESM dist (which uses static \`export *\`). Types come from the .ts shim.`,
    `export {`,
    ...valueNames.map((n) => `  ${n},`),
    `} from '${src}';`,
    '',
  ];
  writeFileSync(esmFullPath, esmLines.join('\n'));

  console.log(
    `  ${target}: ${valueNames.length} value + ${typeOnlyNames.length} type-only re-exports (+ .mjs ESM sibling)`
  );
}

console.log('Done. Run `npm run build` to compile the regenerated shims.');
