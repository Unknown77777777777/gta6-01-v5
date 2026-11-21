// main.ts — Costa Sol entry program (Node 22, stdlib only).
// Copies game/ and screenshots/ from this repository to the output directory
// (MAKEFUN_OUTPUT_DIR outside the grader, /output inside it) and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Deterministic: two runs on the same tree write byte-identical output.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

export const BUILD_VERSION = '5.0.0-costa-sol-v5';

const REQUIRED_GAME_FILES = [
  'index.html',
  'style.css',
  'src/main.js',
  'src/city.js',
  'src/render.js',
  'src/player.js',
  'src/vehicles.js',
  'src/pedestrians.js',
  'src/wanted.js',
  'src/missions.js',
  'src/missions2.js',
  'src/audio.js',
  'src/hud.js',
  'src/save.js',
  'src/particles.js',
  'src/weapons.js',
  'src/daynight.js',
  'src/districts.js',
  'src/cutscenes.js',
  'src/minigames.js',
  'src/side.js',
];
const REQUIRED_SCREENSHOTS = ['1-cover.jpg', '2-driving.jpg', '3-mission.jpg', '4-foot.jpg'];

function fail(message) {
  throw new Error(`costa-sol v5 (${BUILD_VERSION}): ${message}`);
}

function preflight(repoRoot) {
  const gameDir = join(repoRoot, 'game');
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    fail(`game/ directory is missing at ${gameDir}`);
  }
  for (const f of REQUIRED_GAME_FILES) {
    const p = join(gameDir, f);
    if (!existsSync(p)) fail(`required game file is missing: game/${f}`);
  }
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
    fail(`screenshots/ directory is missing at ${shotsDir}`);
  }
  for (const f of REQUIRED_SCREENSHOTS) {
    const p = join(shotsDir, f);
    if (!existsSync(p)) fail(`required screenshot is missing: screenshots/${f}`);
    const size = statSync(p).size;
    if (size > 256 * 1024) fail(`screenshot screenshots/${f} is ${size} bytes, over the 256 KiB cap`);
  }
  // LICENSE must declare an OSI-approved SPDX identifier.
  const license = join(repoRoot, 'LICENSE');
  if (!existsSync(license)) fail('LICENSE is missing at the repository root');
  const licenseText = readFileSync(license, 'utf8');
  if (!licenseText.includes('SPDX-License-Identifier: MIT')) {
    fail('LICENSE does not declare SPDX-License-Identifier: MIT');
  }
}

function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, dereference: false });
}

function main() {
  const repoRoot = resolve(import.meta.dirname);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  preflight(repoRoot);
  mkdirSync(outDir, { recursive: true });
  copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
  copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 256 * 1024 },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  if (dossier.length > 1.5 * 1024 * 1024) {
    fail(`dossier.json is ${dossier.length} bytes, over the 1.5 MiB cap`);
  }
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  const shots = readdirSync(join(outDir, 'screenshots')).sort();
  console.log(`costa-sol v5 (${BUILD_VERSION}): wrote ${outDir} (game/ + ${shots.length} screenshots + dossier.json ${dossier.length} bytes)`);
}

main();
