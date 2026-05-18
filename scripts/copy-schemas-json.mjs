// Copies JSON Schemas from @sogni-ai/sogni-protocol (the language-neutral
// protocol package) into both the CJS dist (./dist/schemas/) and ESM dist
// (./dist-esm/schemas/) so the package's `./schemas/*` subpath export resolves
// to the same artifacts SogniKit / quicktype and other consumers read directly
// from sogni-protocol.
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';

const require = createRequire(import.meta.url);
const protocolPkg = require.resolve('@sogni-ai/sogni-protocol/package.json');
const protocolSchemasRoot = join(dirname(protocolPkg), 'schemas');

async function collectJsonFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectJsonFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

const jsonFiles = await collectJsonFiles(protocolSchemasRoot);

for (const outRoot of ['dist', 'dist-esm']) {
  const targetRoot = join(process.cwd(), outRoot, 'schemas');
  for (const srcFile of jsonFiles) {
    const rel = relative(protocolSchemasRoot, srcFile);
    const dest = join(targetRoot, rel);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(srcFile, dest);
  }
}
