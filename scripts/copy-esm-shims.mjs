// Copies the generated .mjs subpath shims from src/ to dist/ so the
// published package's exports-map `import` condition can point at them.
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const subpaths = [
  'contracts',
  'tools',
  'replay',
  'runtime',
  'media',
  'workflows',
  'skills/asset_reference_management',
  'public-skill-runtime',
];

for (const p of subpaths) {
  const src = resolve(root, 'src', p, 'index.mjs');
  const dst = resolve(root, 'dist', p, 'index.mjs');
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
}
console.log(`Copied ${subpaths.length} ESM shims to dist/`);
