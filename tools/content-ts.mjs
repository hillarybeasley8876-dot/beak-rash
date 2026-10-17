// Lets the content unit's node tools import the game's TypeScript data/logic directly: Node strips the
// types itself; this hook only resolves extensionless relative imports ('./x' → './x.ts' or './x/index.ts').
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (relative && context.parentURL?.endsWith('.ts') && !/\.[cm]?[jt]s$/.test(specifier)) {
      const base = new URL(specifier, context.parentURL);
      for (const candidate of [`${base.href}.ts`, `${base.href}/index.ts`]) {
        if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

/** Import a project TypeScript module by repo-relative path. */
export function importTs(rel) {
  return import(pathToFileURL(path.join(ROOT, rel)).href);
}
