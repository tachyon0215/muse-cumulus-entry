// Cumulus Courier — entry program for make.fun's "Make the best flight game"
// bounty (Node 22, standard library only).
//
// The game itself is the static site under game/: plain files a desktop
// browser opens offline, no build step and no network request. This program
// is the hand-in. It copies game/ and screenshots/ into the output directory
// and writes dossier.json there with buildDossier from the vendored make.fun
// library, exactly the shape the grader expects.
//
// Local check:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play locally: node serve.ts  (then open http://localhost:8080)

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

// A one-line receipt for whoever runs this by hand: what was handed in and
// how large the dossier came out, so a local run can be eyeballed against
// the grader's caps before anything is submitted.
const shotCount = existsSync(join(outputDir, 'screenshots'))
  ? readdirSync(join(outputDir, 'screenshots')).length
  : 0;
console.log(
  `Cumulus Courier handed in: game/ + ${shotCount} screenshots, dossier ${dossier.length} bytes -> ${outputDir}`,
);
