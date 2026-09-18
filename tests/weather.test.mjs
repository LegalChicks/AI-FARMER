import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEATHER_THRESHOLDS,
  buildConsensus,
  cropDayForDate,
  evaluateCurrentWeatherAlerts,
  generateAgronomicAdvisories
} from '../src/assets/weather-core.js';

test('builds a three-provider temperature consensus and agreement score', () => {
  const consensus = buildConsensus([
    { daylightMeanC: 31, nightMeanC: 24, dailyMeanC: 27.5, minimumC: 23, maximumC: 34, rainMm: 12, rainProbabilityPct: 70, windMaximumKmh: 24, rainSignal: true },
    { daylightMeanC: 30, nightMeanC: 24.5, dailyMeanC: 27.2, minimumC: 23.5, maximumC: 33, rainMm: 10, windMaximumKmh: 20, rainSignal: true },
    { daylightMeanC: 31.2, nightMeanC: 24.2, dailyMeanC: 27.7, minimumC: 23, maximumC: 34, rainMm: null, windMaximumKmh: 18, rainSignal: false }
  ]);
  assert.equal(consensus.sourceCount, 3);
  assert.equal(consensus.confidence, 'high');
  assert.equal(consensus.daylightMeanC, 30.7);
  assert.equal(consensus.nightMeanC, 24.2);
  assert.equal(consensus.rainSignalSources, 2);
});

test('maps forecast dates to crop days', () => {
  assert.equal(cropDayForDate('2026-09-20', '2026-09-20'), 0);
  assert.equal(cropDayForDate('2026-09-20', '2026-11-19'), 60);
  assert.equal(cropDayForDate('2026-09-20', '2026-09-16'), -4);
});

test('creates a critical TGMS restraint for cool nights in the sensitive window', () => {
  const advisories = generateAgronomicAdvisories({
    consensus: { nightMeanC: 22.8, dailyMeanC: 26.1, daylightMeanC: 30, rainMm: 0, rainMaximumMm: 0, rainProbabilityPct: 10, windMaximumKmh: 8, temperatureSpreadC: 1, rainSignalSources: 0 }
  }, 65, 0);
  assert.equal(advisories[0].severity, 'critical');
  assert.ok(advisories.some((item) => item.category === 'TGMS'));
  assert.ok(advisories.some((item) => /Do not classify/.test(item.restraint)));
});

test('restrains GA3 and rope pulling during wet heading weather', () => {
  const advisories = generateAgronomicAdvisories({
    consensus: { nightMeanC: 25, dailyMeanC: 28, daylightMeanC: 32, rainMm: 22, rainMaximumMm: 30, rainProbabilityPct: 85, windMaximumKmh: 12, temperatureSpreadC: 1, rainSignalSources: 3 }
  }, 90, 40);
  const rain = advisories.find((item) => item.category === 'RAIN');
  assert.match(rain.restraint, /Do not apply GA3/i);
  assert.match(rain.restraint, /rope-pull wet panicles/i);
});

test('automated alert system flags critical sub-24°C TGMS risk in current weather', () => {
  const payload = {
    current: {
      time: '2026-11-25T06:00:00+08:00',
      consensusTemperatureC: 22.1,
      consensusWindKmh: 8,
      sources: [{ temperatureC: 22.1, windKmh: 8, precipitationMm: 0 }]
    }
  };
  const alerts = evaluateCurrentWeatherAlerts(payload, 66);
  assert.ok(alerts.length > 0);
  const tgms = alerts.find((a) => a.category === 'TGMS');
  assert.ok(tgms);
  assert.equal(tgms.severity, 'critical');
  assert.equal(tgms.isCurrent, true);
  assert.match(tgms.restraint, /Do not certify male sterility/i);
  assert.match(tgms.remedial, /Bag additional S-line panicles/i);
});

test('automated alert system flags high wind spray restraint and damaging gust hazard', () => {
  const sprayPayload = {
    current: {
      time: '2026-10-15T09:00:00+08:00',
      consensusTemperatureC: 29,
      consensusWindKmh: 22.4,
      sources: [{ windKmh: 22.4, gustKmh: 26.0 }]
    }
  };
  const sprayAlerts = evaluateCurrentWeatherAlerts(sprayPayload, 25);
  const sprayWind = sprayAlerts.find((a) => a.category === 'WIND');
  assert.ok(sprayWind);
  assert.equal(sprayWind.severity, 'high');
  assert.match(sprayWind.restraint, /Do not apply GA3/i);

  const damagingPayload = {
    current: {
      time: '2026-10-15T09:00:00+08:00',
      consensusTemperatureC: 29,
      consensusWindKmh: 24,
      sources: [{ windKmh: 24, gustKmh: 37.5 }]
    }
  };
  const damagingAlerts = evaluateCurrentWeatherAlerts(damagingPayload, 25);
  const damagingWind = damagingAlerts.find((a) => a.category === 'WIND');
  assert.ok(damagingWind);
  assert.equal(damagingWind.severity, 'critical');
  assert.match(damagingWind.restraint, /Immediately suspend all field operations/i);
});

test('automated alert system flags active precipitation during anthesis as critical', () => {
  const rainPayload = {
    current: {
      time: '2026-12-20T10:00:00+08:00',
      consensusTemperatureC: 26,
      consensusWindKmh: 10,
      sources: [{ temperatureC: 26, precipitationMm: 6.2, windKmh: 10 }]
    }
  };
  const anthesisAlerts = evaluateCurrentWeatherAlerts(rainPayload, 91);
  const rainAlert = anthesisAlerts.find((a) => a.category === 'RAIN');
  assert.ok(rainAlert);
  assert.equal(rainAlert.severity, 'critical');
  assert.match(rainAlert.restraint, /Strictly prohibited: GA3 spraying/i);
});

test('automated alert system returns safe status when all current conditions are within thresholds', () => {
  const safePayload = {
    current: {
      time: '2026-10-05T08:00:00+08:00',
      consensusTemperatureC: 28.5,
      consensusWindKmh: 8,
      sources: [{ temperatureC: 28.5, windKmh: 8, gustKmh: 14, precipitationMm: 0, humidityPct: 75 }]
    }
  };
  const alerts = evaluateCurrentWeatherAlerts(safePayload, 15);
  assert.equal(alerts.length, 0);
});

