#!/usr/bin/env node
// Typecheck gate for one job: runs the whole-project tsc and fails only on errors in the given paths (other workers'
// files may be mid-edit). Prints every error it counts and "TSC-OWN OK" / "TSC-OWN FAIL n".
//   node tools/r4/tsc-own.mjs src/ui/screens/menu.ts src/gameplay/style/   (a trailing / = a whole folder)
import { spawnSync } from 'node:child_process';

const owned = process.argv.slice(2).map((p) => p.replace(/\\/g, '/'));
if (!owned.length) {
  console.error('usage: node tools/r4/tsc-own.mjs <path> [...]');
  process.exit(2);
}
const r = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], { encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });
const lines = `${r.stdout ?? ''}${r.stderr ?? ''}`.split(/\r?\n/);
const mine = (file) => owned.some((o) => (o.endsWith('/') ? file.startsWith(o) : file === o));
const errors = lines.filter((l) => {
  const m = /^([^(]+)\(\d+,\d+\): error /.exec(l);
  return m !== null && mine(m[1].replace(/\\/g, '/'));
});
for (const e of errors) console.log(e);
const others = lines.filter((l) => / error TS\d+/.test(l)).length - errors.length;
if (others > 0) console.log(`(ignored ${others} error(s) in files outside this job)`);
console.log(errors.length ? `TSC-OWN FAIL ${errors.length}` : 'TSC-OWN OK');
process.exit(errors.length ? 1 : 0);
