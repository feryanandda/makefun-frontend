// funboard's hand-in program for make.fun's makefun-frontend-01 bounty
// (Node 22, standard library only, no build step anywhere).
//
// What it does, start to finish:
//   1. works out where the entry lives (this file's directory) and where
//      the output goes — MAKEFUN_OUTPUT_DIR when set, else /output;
//   2. copies the static frontend (app/) and the screenshots
//      (screenshots/) across, replacing whatever a previous run left so
//      two runs of the same commit write the same bytes;
//   3. writes dossier.json with buildDossier from the vendored library
//      in vendor/makefun-frontend.ts. That file is the kit's own copy
//      and stays untouched: the scorer rebuilds the dossier with its
//      copy and compares the two byte for byte, so the caps below are
//      the gate's own numbers (160 KiB of text, 3 screenshots of at
//      most 256 KiB, app/ within 993 entries and 16 MiB).
//
// Run it locally the way the grader will:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Replace, never merge: a stale file from an earlier run must not leak
// into the hand-in.
for (const name of ['app', 'screenshots']) {
  const target = join(outDir, name);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(join(repoDir, name), target, { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163_840,
  screenshots: { max: 3, max_bytes: 262_144 },
  app_max_files: 993,
  app_max_bytes: 16_777_216,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
