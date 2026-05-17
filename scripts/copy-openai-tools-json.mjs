// Copies src/openai-tools/*.json to both the CJS dist (./dist/openai-tools/)
// and ESM dist (./dist-esm/openai-tools/) so the package's `./openai-tools`
// subpath export can load the raw JSON tool manifests at runtime under both
// module systems.
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const srcDir = join(process.cwd(), 'src', 'openai-tools');
const entries = await readdir(srcDir, { withFileTypes: true });
const jsonFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => entry.name);

for (const outRoot of ['dist', 'dist-esm']) {
  const targetDir = join(process.cwd(), outRoot, 'openai-tools');
  await mkdir(targetDir, { recursive: true });
  for (const file of jsonFiles) {
    await copyFile(join(srcDir, file), join(targetDir, file));
  }
}
