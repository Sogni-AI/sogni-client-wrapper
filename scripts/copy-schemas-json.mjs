// Copies src/schemas/**/*.json to both the CJS dist (./dist/schemas/)
// and ESM dist (./dist-esm/schemas/) so the package's `./schemas/*`
// subpath export can load the raw JSON Schema artifacts at runtime
// under both module systems. Used by downstream Swift codegen
// (SogniKit / quicktype) and any other consumers that need the
// JSON Schemas as data, not as TypeScript types.
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';

const srcRoot = join(process.cwd(), 'src', 'schemas');

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

const jsonFiles = await collectJsonFiles(srcRoot);

for (const outRoot of ['dist', 'dist-esm']) {
  const targetRoot = join(process.cwd(), outRoot, 'schemas');
  for (const srcFile of jsonFiles) {
    const rel = relative(srcRoot, srcFile);
    const dest = join(targetRoot, rel);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(srcFile, dest);
  }
}
