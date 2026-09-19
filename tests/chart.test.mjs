import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TGMS_CONFIG,
  build125DayTemperatureSeries,
  calculateSolanaClimatology,
  computeTgmsRiskMetrics
} from '../src/assets/temperature-chart.js';

test('builds full 125-day daily temperature series for M20 production cycle', () => {
  const series = build125DayTemperatureSeries('2026-09-20');
  assert.equal(series.length, 125);
  assert.equal(series[0].day, 0);
  assert.equal(series[0].date, '2026-09-20');
  assert.equal(series.at(-1).day, 124);
  assert.equal(series.at(-1).date, '2027-01-22');

  for (const dayItem of series) {
    assert.equal(typeof dayItem.day, 'number');
    assert.ok(dayItem.date);
    assert.ok(Number.isFinite(dayItem.meanTemp));
    assert.ok(Number.isFinite(dayItem.minTemp));
    assert.ok(Number.isFinite(dayItem.maxTemp));
    assert.ok(dayItem.maxTemp >= dayItem.meanTemp);
    assert.ok(dayItem.meanTemp >= dayItem.minTemp);
  }
});

test('identifies critical TGMS sterility window from D60 through D88', () => {
  const series = build125DayTemperatureSeries('2026-09-20');
  assert.equal(series[59].inTgmsWindow, false);
  assert.equal(series[60].inTgmsWindow, true);
  assert.equal(series[88].inTgmsWindow, true);
  assert.equal(series[89].inTgmsWindow, false);

  assert.equal(TGMS_CONFIG.windowStart, 60);
  assert.equal(TGMS_CONFIG.windowEnd, 88);
  assert.equal(TGMS_CONFIG.minC, 24);
  assert.equal(TGMS_CONFIG.meanC, 27);
});

test('reflects cooler Amihan conditions during November-December sterility window', () => {
  const sepClim = calculateSolanaClimatology('2026-09-20');
  const decClim = calculateSolanaClimatology('2026-12-05');

  // Solana in late September is warm (>27°C mean, >24°C min)
  assert.ok(sepClim.dailyMeanC >= 27.5);
  assert.ok(sepClim.minimumC >= 24.0);

  // Solana in early December is cool (<27°C mean, <24°C min)
  assert.ok(decClim.dailyMeanC < 25.0);
  assert.ok(decClim.minimumC < 22.0);
});

test('computes TGMS risk metrics highlighting thermal threshold breaches in sensitive window', () => {
  const series = build125DayTemperatureSeries('2026-09-20');
  const metrics = computeTgmsRiskMetrics(series);

  assert.equal(metrics.totalWindowDays, 29);
  assert.ok(metrics.daysBelowMin > 15, 'December Amihan conditions trigger substantial days below 24C min');
  assert.ok(metrics.daysBelowMean > 15, 'Amihan daily mean drops below 27C threshold');
  assert.equal(metrics.riskLevel, 'critical');
});

test('incorporates user field observations into temperature series', () => {
  const observations = [
    {
      date: '2026-11-25', // Day 66
      minTemperature: 25.2,
      meanTemperature: 28.1,
      maxTemperature: 31.0
    }
  ];

  const series = build125DayTemperatureSeries('2026-09-20', null, observations);
  const day66 = series.find((d) => d.date === '2026-11-25');
  assert.ok(day66);
  assert.equal(day66.source, 'observed');
  assert.equal(day66.minTemp, 25.2);
  assert.equal(day66.meanTemp, 28.1);
  assert.equal(day66.minBreached, false);
  assert.equal(day66.meanBreached, false);
});
