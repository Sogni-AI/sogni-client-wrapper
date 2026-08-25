import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const mismatches = [];

for (const [name, expected] of Object.entries(packageJson.dependencies ?? {})) {
  if (!exactVersion.test(expected)) continue;

  const installedPackagePath = join(repoRoot, 'node_modules', ...name.split('/'), 'package.json');
  try {
    const installedPackage = JSON.parse(await readFile(installedPackagePath, 'utf8'));
    if (installedPackage.version !== expected) {
      mismatches.push(`${name}: package.json requires ${expected}, installed ${installedPackage.version}`);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    mismatches.push(`${name}: package.json requires ${expected}, but it is not installed`);
  }
}

if (mismatches.length > 0) {
  console.error('Exact dependency installation is stale:');
  for (const mismatch of mismatches) console.error(`- ${mismatch}`);
  console.error('Run npm install before building or publishing.');
  process.exitCode = 1;
} else {
  console.log('Exact dependency installation matches package.json.');
}
