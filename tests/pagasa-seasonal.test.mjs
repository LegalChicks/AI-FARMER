import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyPagasaDryWetDay,
  getPagasaSeasonalAdvisory
} from '../src/assets/pagasa-seasonal.js';
import { PAGASA_SEASONAL_URL } from '../src/assets/weather-core.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('classifies rice farming dry days and wet days according to DOST-PAGASA agrometeorological standard', () => {
  assert.equal(PAGASA_SEASONAL_URL, 'https://www.pagasa.dost.gov.ph/climate/climate-prediction/seasonal-forecast');

  const zeroRain = classifyPagasaDryWetDay(0);
  assert.equal(zeroRain.type, 'dry');
  assert.equal(zeroRain.label, 'PAGASA Dry Day');
  assert.equal(zeroRain.threshold, '< 1.0 mm');

  const traceRain = classifyPagasaDryWetDay(0.9);
  assert.equal(traceRain.type, 'dry');

  const boundaryWet = classifyPagasaDryWetDay(1.0);
  assert.equal(boundaryWet.type, 'wet');
  assert.equal(boundaryWet.label, 'PAGASA Wet Day');
  assert.equal(boundaryWet.threshold, '≥ 1.0 mm');

  const heavyRain = classifyPagasaDryWetDay(35.5);
  assert.equal(heavyRain.type, 'wet');

  const invalidRain = classifyPagasaDryWetDay(Number.NaN);
  assert.equal(invalidRain.type, 'unknown');
});

test('generates agrometeorological seasonal alerts aligned with M20 phenological phases', async () => {
  const raw = await readFile(path.join(repoRoot, 'src', 'data', 'weather.json'), 'utf8');
  const weather = JSON.parse(raw);
  const pagasaData = weather.pagasaSeasonalForecast;

  assert.ok(pagasaData, 'pagasaSeasonalForecast must be present in weather.json');
  assert.equal(pagasaData.sourceUrl, 'https://www.pagasa.dost.gov.ph/climate/climate-prediction/seasonal-forecast');

  // Test Amihan cooling advisory during D60-D88 sterility audit
  const amihanAlerts = getPagasaSeasonalAdvisory(65, '2026-11-24', pagasaData);
  assert.ok(amihanAlerts.length > 0);
  const sterilityAdv = amihanAlerts.find((a) => a.category === 'PAGASA-SEASONAL');
  assert.ok(sterilityAdv);
  assert.equal(sterilityAdv.severity, 'high');
  assert.match(sterilityAdv.action, /5–7 cm paddy water depth/);
  assert.equal(sterilityAdv.sourceUrl, 'https://www.pagasa.dost.gov.ph/climate/climate-prediction/seasonal-forecast');

  // Test Early vegetative above-normal rain advisory (D0-D45)
  const earlyRainAlerts = getPagasaSeasonalAdvisory(20, '2026-10-05', pagasaData);
  assert.ok(earlyRainAlerts.length > 0);
  const rainAdv = earlyRainAlerts.find((a) => a.category === 'PAGASA-CLIMATE');
  assert.ok(rainAdv);
  assert.equal(rainAdv.severity, 'moderate');
  assert.match(rainAdv.title, /Above Normal rainfall/);
});

test('verifies DOST-PAGASA 6-month seasonal forecast dataset integrity for Solana Cagayan', async () => {
  const raw = await readFile(path.join(repoRoot, 'src', 'data', 'weather.json'), 'utf8');
  const weather = JSON.parse(raw);
  const pagasaData = weather.pagasaSeasonalForecast;

  // 1. Providers check
  const pagasaProvider = weather.providers.find((p) => p.id === 'pagasa-seasonal');
  assert.ok(pagasaProvider, 'DOST-PAGASA must be a listed provider');
  assert.equal(pagasaProvider.documentation, 'https://www.pagasa.dost.gov.ph/climate/climate-prediction/seasonal-forecast');

  // 2. 6-Month Rainfall Progression
  assert.equal(pagasaData.monthlyRainfall.length, 6);
  const sepRain = pagasaData.monthlyRainfall[0];
  assert.equal(sepRain.monthCode, '2026-09');
  assert.equal(sepRain.condition, 'Above Normal');
  assert.ok(sepRain.forecastRainMm > 200);

  // 3. Temperature & TGMS Evaluation
  assert.equal(pagasaData.monthlyTemperature.length, 6);
  const novTemp = pagasaData.monthlyTemperature.find((t) => t.monthCode === '2026-11');
  const decTemp = pagasaData.monthlyTemperature.find((t) => t.monthCode === '2026-12');
  assert.equal(novTemp.tgmsRiskLevel, 'critical');
  assert.equal(decTemp.tgmsRiskLevel, 'critical');

  // 4. Rice Dry / Wet Days Distribution
  assert.equal(pagasaData.dryWetDaysForecast.length, 6);
  for (const item of pagasaData.dryWetDaysForecast) {
    assert.equal(item.dryDaysCount + item.wetDaysCount, item.totalDays);
    assert.ok(item.riceAgriGuidance);
  }

  // 5. Tropical Cyclone Projections
  assert.equal(pagasaData.tropicalCycloneOutlook.length, 6);
  const octCyclone = pagasaData.tropicalCycloneOutlook.find((c) => c.month.includes('October'));
  assert.equal(octCyclone.cagayanThreat, 'High');

  // 6. Bulletins & PDF documents
  assert.ok(pagasaData.bulletins.length >= 4);
  const portalBulletin = pagasaData.bulletins.find((b) => b.url === 'https://www.pagasa.dost.gov.ph/climate/climate-prediction/seasonal-forecast');
  assert.ok(portalBulletin);
});
