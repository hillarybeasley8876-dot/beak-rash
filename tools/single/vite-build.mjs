// Step 1 of the single-file build: the normal production build (the repo's own vite.config.ts)
// with overrides so the output is easy to inline — one JS chunk (every dynamic import() inlined),
// one CSS file, no public/ copy; Vite inlines code-imported images, the inliner handles fonts and public/ assets.
import fs from 'node:fs';
import path from 'node:path';
import { build, loadConfigFromFile, mergeConfig } from 'vite';

/** Builds `root` into `outDir`; returns the list of files Vite wrote (relative to outDir). */
export async function viteBuild(root, outDir) {
  const configFile = path.join(root, 'vite.config.ts');
  const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, configFile, root);
  if (!loaded) throw new Error(`could not load ${configFile}`);
  const overrides = {
    root,
    configFile: false,
    logLevel: 'warn',
    build: {
      outDir,
      emptyOutDir: true,
      copyPublicDir: false,
      cssCodeSplit: false,
      // Images imported from code (e.g. track-card art) become data: URIs here; fonts stay external
      // so the inliner can subset them.
      assetsInlineLimit: (file) => !/\.(woff2?|ttf|otf)$/i.test(file),
      modulePreload: false,
      reportCompressedSize: false,
      rolldownOptions: { output: { codeSplitting: false } },
    },
  };
  await build(mergeConfig(loaded.config, overrides));
  return listFiles(outDir);
}

function listFiles(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}
