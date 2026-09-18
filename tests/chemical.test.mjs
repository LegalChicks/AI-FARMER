import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHEMICAL_OPERATIONS,
  applicationGateStatus,
  applicationsToCsv,
  calculateFertilizerProduct,
  calculateGa3Mix,
  scheduleWithDates,
  validateNitrogenPlan
} from '../src/assets/chemical-core.js';

test('chemical schedule maps M20 control gates to the configured Day 0', () => {
  const schedule = scheduleWithDates('2026-09-20');
  assert.equal(schedule.length, CHEMICAL_OPERATIONS.length);
  assert.equal(schedule.find((item) => item.code === 'N-1 / BASAL').date, '2026-10-08');
  assert.equal(schedule.find((item) => item.code === 'N-4 / PI').date, '2026-11-13');
  assert.equal(schedule.find((item) => item.code === 'GA3-S1').date, '2026-12-14');
  assert.equal(schedule.find((item) => item.code === 'PHI-AUDIT').date, '2027-01-08');
});

test('nitrogen plan requires four splits totalling 100 percent', () => {
  const valid = validateNitrogenPlan({ targetN: 120, split1: 25, split2: 25, split3: 25, split4: 25 });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.allocations, [30, 30, 30, 30]);
  const invalid = validateNitrogenPlan({ targetN: 150, split1: 30, split2: 30, split3: 30, split4: 20 });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(' '), /110\.0%/);
});

test('fertilizer conversion uses guaranteed nutrient analysis and treated area', () => {
  const result = calculateFertilizerProduct({ nutrientKgHa: 30, nutrientPercent: 46, areaHa: 2, bagKg: 50 });
  assert.ok(result);
  assert.equal(Number(result.productKgHa.toFixed(2)), 65.22);
  assert.equal(Number(result.productKg.toFixed(2)), 130.43);
  assert.equal(Number(result.bags.toFixed(2)), 2.61);
});

test('GA3 calculator converts active ingredient, formulation, area, carrier, and split', () => {
  const result = calculateGa3Mix({ activeRateGHa: 50, productConcentrationPercent: 20, areaHa: 1.6, waterLHa: 200, splitPercent: 60 });
  assert.ok(result);
  assert.equal(result.activeTotalG, 80);
  assert.equal(result.productTotalG, 400);
  assert.equal(result.splitProductG, 240);
  assert.equal(result.splitWaterL, 192);
});

test('completed application gate requires all eight release checks', () => {
  const record = {
    diagnosisConfirmed: true,
    registrationVerified: true,
    labelVerified: true,
    approvalVerified: true,
    calibrationVerified: true,
    weatherVerified: true,
    ppeVerified: true,
    intervalsRecorded: false
  };
  assert.deepEqual(applicationGateStatus(record), { ready: false, missing: ['intervalsRecorded'] });
  record.intervalsRecorded = true;
  assert.equal(applicationGateStatus(record).ready, true);
});

test('application export protects comma and quote fields', () => {
  const csv = applicationsToCsv([{ date: '2026-10-08', status: 'Completed', productName: 'Grade "A", lot 7' }]);
  assert.match(csv, /"Grade ""A"", lot 7"/);
});
