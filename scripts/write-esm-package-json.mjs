// Writes a minimal package.json with `type: module` into dist-esm/ so that
// Node treats the ESM build's .js files as ES modules at runtime. The CJS
// build (./dist) inherits the parent package.json which uses commonjs
// (default for Node when "type" is unset).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outputDir = join(process.cwd(), 'dist-esm');
await mkdir(outputDir, { recursive: true });
await writeFile(
  join(outputDir, 'package.json'),
  `${JSON.stringify({ type: 'module' }, null, 2)}\n`,
  'utf8',
);
