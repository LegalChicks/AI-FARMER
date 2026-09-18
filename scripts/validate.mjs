import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(repoRoot, 'dist');
const required = [
  'index.html',
  '404.html',
  'assets/styles.css',
  'assets/print.css',
  'assets/calendar.js',
  'assets/app.js',
  'assets/chemical-core.js',
  'assets/weather-core.js',
  'data/weather.json',
  'favicon.svg',
  'manifest.webmanifest',
  'robots.txt',
  '_headers'
];

await Promise.all(required.map((file) => access(path.join(dist, file))));

const html = await readFile(path.join(dist, 'index.html'), 'utf8');
const requiredMarkers = [
  '<main id="main-content"',
  '<caption>',
  'id="calendar-body"',
  'id="settings-dialog"',
  'id="observation-dialog"',
  'id="application-dialog"',
  'id="nutrient-plan-form"',
  'id="chemical-schedule-body"',
  'type="module"'
];

for (const marker of requiredMarkers) {
  if (!html.includes(marker)) throw new Error(`Missing HTML marker: ${marker}`);
}

const weather = JSON.parse(await readFile(path.join(dist, 'data/weather.json'), 'utf8'));
if (weather.schema !== 'lingan-agronomist-weather/v1') throw new Error('Unexpected weather data schema.');
if (!Array.isArray(weather.providers) || weather.providers.length < 2) throw new Error('Weather data has fewer than two available providers.');
if (!Array.isArray(weather.daily) || weather.daily.length < 7) throw new Error('Weather data has fewer than seven forecast days.');

for (const script of ['assets/calendar.js', 'assets/app.js', 'assets/weather-core.js', 'assets/chemical-core.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(dist, script)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `Syntax check failed for ${script}`);
}

console.log(`Validated ${required.length} deployable files, HTML entry points, weather schema, and JavaScript syntax.`);
