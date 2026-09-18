import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  buildCalendar,
  calculateTemperatureStatus,
  toIsoDate
} from '../src/assets/calendar.js';

test('builds one complete operation for every day from D0 through D124', () => {
  const calendar = buildCalendar(DEFAULT_CONFIG);
  assert.equal(calendar.length, 125);
  assert.equal(calendar[0].day, 0);
  assert.equal(calendar.at(-1).day, 124);
  for (const operation of calendar) {
    assert.ok(operation.date instanceof Date);
    assert.ok(operation.phase);
    assert.ok(operation.task);
    assert.ok(operation.line);
    assert.ok(operation.risk);
  }
});

test('preserves the documented five-day M20 stagger', () => {
  const calendar = buildCalendar(DEFAULT_CONFIG);
  assert.equal(toIsoDate(calendar[0].date), '2026-09-20');
  assert.equal(toIsoDate(calendar[5].date), '2026-09-25');
  assert.match(calendar[5].task, /TG102M P1/i);
  assert.equal(calendar[5].line, 'P-line');
});

test('maps the modelled critical windows to exact dates', () => {
  const calendar = buildCalendar(DEFAULT_CONFIG);
  assert.equal(toIsoDate(calendar[60].date), '2026-11-19');
  assert.equal(toIsoDate(calendar[88].date), '2026-12-17');
  assert.equal(toIsoDate(calendar[124].date), '2027-01-22');
  assert.equal(calendar[85].window, 'overlap');
  assert.equal(calendar[89].window, 'anthesis');
});

test('regenerates calendar dates and P-line events after an authorized plan edit', () => {
  const custom = { ...DEFAULT_CONFIG, seedDate: '2026-09-22', pStagger: 7 };
  const calendar = buildCalendar(custom);
  assert.equal(toIsoDate(calendar[0].date), '2026-09-22');
  assert.match(calendar[7].task, /TG102M P1/i);
  assert.equal(calendar[7].line, 'Both');
});

test('flags TGMS thermal exceptions against published guardrails', () => {
  assert.equal(calculateTemperatureStatus({ minTemperature: 23.9, meanTemperature: 27.4 }), 'exception');
  assert.equal(calculateTemperatureStatus({ minTemperature: 24.2, meanTemperature: 26.9 }), 'exception');
  assert.equal(calculateTemperatureStatus({ minTemperature: 24.2, meanTemperature: 27.1 }), 'within-guardrail');
  assert.equal(calculateTemperatureStatus({ minTemperature: '', meanTemperature: '' }), 'incomplete');
});
