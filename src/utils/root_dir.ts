import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const PACKAGE_NAME = '@nori-zk/proof-conversion';

// Walks up from this file's own location to find the repo root, identified
// by its package.json name - rather than assuming a fixed number of '..'
// levels. A fixed-depth resolve() only works when this file runs from its
// compiled location (build/src/utils/root_dir.js); under ts-jest it runs
// directly from source (src/utils/root_dir.ts), one directory shallower,
// which silently resolved rootDir one level too high (dropping the
// package's own directory from the path entirely).
function findRootDir(startDir: string): string {
  let dir = startDir;
  while (true) {
    const pkgPath = path.join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg.name === PACKAGE_NAME) {
          return dir;
        }
      } catch {
        // malformed package.json - keep walking up
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not locate ${PACKAGE_NAME}'s package.json walking up from ${startDir}`
      );
    }
    dir = parent;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = findRootDir(__dirname);

export default rootDir;
