import { addUtcDays, parseIsoDate, toIsoDate } from './calendar.js';

export const CHEMICAL_OPERATIONS = Object.freeze([
  {
    day: 7,
    code: 'NURSERY-1',
    category: 'Nutrient diagnosis',
    line: 'Both nurseries',
    trigger: '7–10 DAS seedling color, vigor, water status, and nursery-bed diagnosis',
    action: 'Inspect each nursery separately. Apply a nursery fertilizer only when the approved M20 nursery sheet or diagnosed deficiency calls for it; record product grade, nutrient contribution, bed area, and actual mass.',
    restraint: 'Do not copy a general hybrid nursery rate into the M20 production record without breeder or production-supervisor approval.'
  },
  {
    day: 14,
    code: 'PLAN-LOCK',
    category: 'Nutrient plan',
    line: 'Both',
    trigger: 'MOET/soil result, field area, yield target, fertilizer grades, and approved M20 protocol are complete',
    action: 'Lock the seasonal nutrient budget and four nitrogen allocations. Reconcile every product contribution so total N stays within the approved target and P₂O₅, K₂O, S, and Zn follow the field diagnosis.',
    restraint: 'No product purchase or field rate is final while soil/MOET results, field area, or split allocations are missing.'
  },
  {
    day: 18,
    code: 'N-1 / BASAL',
    category: 'Fertilizer',
    line: 'S-line',
    trigger: 'S transplanting; level field, stable shallow water, approved basal allocation',
    action: 'Apply the approved basal products uniformly to the mapped S area. Basal P, K, S, or Zn is included only when required by the field diagnosis. Record nutrient kilograms per hectare and actual product kilograms.',
    restraint: 'Keep fertilizer out of reserved P lanes and waterways. Do not use one gross field-area rate for unequal S and P treated areas.'
  },
  {
    day: 23,
    code: 'N-1P / BASAL',
    category: 'Fertilizer',
    line: 'P-line',
    trigger: 'P1 transplanting; P stand and basal allocation approved',
    action: 'Apply the approved P-line basal allocation to the actual P-row area. Keep a separate record from S because the planted area and developmental objective differ.',
    restraint: 'Do not multiply the S-line product total across the whole field; calculate the P-row treated area separately.'
  },
  {
    day: 26,
    code: 'WEED-SNAIL',
    category: 'Pest decision gate',
    line: 'Both',
    trigger: 'Mapped weed or golden apple snail pressure after establishment',
    action: 'Use water, hand removal, mechanical control, and field sanitation first where effective. If a chemical is justified, select a currently FPA-registered product whose label names rice, the target, crop stage, method, and rate; record the registration and expiry.',
    restraint: 'No routine tank mix and no product selected only by active ingredient. The exact current product label controls rate, PPE, re-entry interval, and restrictions.'
  },
  {
    day: 30,
    code: 'N-2',
    category: 'Fertilizer',
    line: 'Both',
    trigger: 'Established crop, early tillering counts, color/LCC or approved diagnosis, and synchronized parental development',
    action: 'Apply only the approved second N allocation. Calculate S and P product masses from their actual treated areas; record water condition, crop color, tiller count, product grade, and nutrient contribution.',
    restraint: 'Hold or reduce the scheduled allocation when the crop is dark green, lodged, diseased, water-stressed, or when extra N would widen the S:P developmental gap.'
  },
  {
    day: 40,
    code: 'N-3',
    category: 'Fertilizer',
    line: 'Both',
    trigger: 'Active tillering audit: leaf number, tiller count, plant height, color/LCC, water, pest status, and S:P gap',
    action: 'Release the third N allocation only after the synchronization sheet and nutrient diagnosis support it. Apply the approved P or K correction only if the diagnostic plan assigned it to this gate.',
    restraint: 'Do not use urea or DAP as an automatic flowering accelerator. A synchronization correction needs a written supervisor decision and a marked comparison strip.'
  },
  {
    day: 50,
    code: 'PI-SAMPLE',
    category: 'Nutrient diagnosis',
    line: 'Both',
    trigger: 'First panicle-initiation dissection and final-leaf assessment',
    action: 'Dissect tagged S and P tillers, photograph primordia, and update the heading forecast. Review the remaining N and K budget but do not apply the final split until PI and synchrony are confirmed.',
    restraint: 'Calendar day alone cannot release the PI fertilizer split.'
  },
  {
    day: 54,
    code: 'N-4 / PI',
    category: 'Fertilizer',
    line: 'Both',
    trigger: 'PI confirmed in the target line, final allocation approved, adequate water, and no lodging/disease constraint',
    action: 'Apply the approved fourth and final N allocation and any diagnosis-based PI K allocation. Reconcile cumulative nutrient totals immediately after application.',
    restraint: 'No further blanket N after the final approved split. Late N can delay heading, increase lodging and disease pressure, and impair synchronization.'
  },
  {
    day: 60,
    code: 'SPRAY-LOCK',
    category: 'Chemical restraint',
    line: 'S-line',
    trigger: 'Start of conservative TGMS sterility-audit window',
    action: 'Review every proposed pesticide or foliar input against diagnosis, FPA registration, label, forecast, and sterility evidence collection. Preserve untreated/bagged controls and complete logger records.',
    restraint: 'Avoid nonessential foliar products during the sterility audit; never allow a spray to obscure pollen, bagged-control, or temperature evidence.'
  },
  {
    day: 70,
    code: 'GA3-LOCK',
    category: 'GA₃ preparation',
    line: 'Both',
    trigger: 'Approved M20 GA₃ sheet, current product label, calibrated sprayer, measured treated areas, and trained crew',
    action: 'Enter the approved active-ingredient rate, formulation concentration, water volume, and split percentages. Calculate product mass for S and P separately; prepare clean measuring and mixing equipment and a test calibration.',
    restraint: 'The public M20 sources establish timing and qualitative response, but not a current commercial rate. Keep all rate fields blank until the signed protocol is entered.'
  },
  {
    day: 78,
    code: 'GA3-STAGE',
    category: 'GA₃ stage watch',
    line: 'S-line',
    trigger: 'Daily observed heading count begins at boot/first emergence',
    action: 'Count emerged panicles from fixed S sample hills morning and afternoon. Prepare spray only when the approved heading threshold is reached; PhilRice research reports best timing at 20–30% heading.',
    restraint: 'Do not spray on a predicted date. A general older manual’s 15–20% trigger is supporting context, not the current M20 contract instruction.'
  },
  {
    day: 85,
    code: 'GA3-S1',
    category: 'GA₃ decision window',
    line: 'S-line',
    trigger: 'Observed approved heading percentage, dry foliage, acceptable wind, and label-compliant rain-free interval',
    action: 'If every gate passes, apply approved S-line GA₃ split 1 using the calculator amount and calibrated carrier volume. Record heading %, product, batch, active rate, product mass, water volume, weather, operator, start/end time, and treated area.',
    restraint: 'Hold for wet panicles, rain, excessive wind, missing approval, unverified product concentration, or failed calibration.'
  },
  {
    day: 86,
    code: 'GA3-S2',
    category: 'GA₃ decision window',
    line: 'S-line',
    trigger: 'Split 1 recorded; next approved heading/exsertion trigger reached; label and weather gates pass',
    action: 'Apply split 2 only when the approved protocol calls for it. Recalculate for the remaining treated area and formulation; do not assume the first tank volume or remainder is correct.',
    restraint: 'Never apply a second split merely because 24 hours elapsed.'
  },
  {
    day: 87,
    code: 'ANTHESIS-HOLD',
    category: 'Chemical restraint',
    line: 'Both',
    trigger: 'First active flowering and pollen supplementation',
    action: 'Prioritize dry-panicle pollen operations and record flowering. Any emergency pesticide decision requires target confirmation, a current rice label, supervisor approval, and timing that protects pollen work and re-entry.',
    restraint: 'No routine insecticide, fungicide, foliar fertilizer, or incompatible tank mix during active anthesis.'
  },
  {
    day: 103,
    code: 'POST-FLOWER-IPM',
    category: 'Pest decision gate',
    line: 'Both',
    trigger: 'Post-flowering scouting confirms a treatable pest or disease and economic/operational justification',
    action: 'If treatment is justified, verify current FPA registration and the rice/target label, rotate mode of action, calculate only the mapped treated area, and record REI and PHI before application.',
    restraint: 'Protect seed-lot integrity and pollination records; never treat from symptoms alone without diagnosis.'
  },
  {
    day: 110,
    code: 'PHI-AUDIT',
    category: 'Residue and harvest gate',
    line: 'Both',
    trigger: 'Every chemical ledger entry reconciled against expected harvest',
    action: 'Calculate the earliest label-compliant harvest date from each product’s PHI. Flag any application whose PHI extends beyond the current harvest plan and preserve invoices, labels, and lot/batch records.',
    restraint: 'Harvest timing cannot precede the longest applicable PHI.'
  },
  {
    day: 115,
    code: 'CHEM-CLOSE',
    category: 'Chemical closure',
    line: 'Both',
    trigger: 'Pre-harvest review',
    action: 'Close routine chemical work. Allow only an approved emergency action whose label, PHI, seed-quality effect, and harvest-date change have been documented.',
    restraint: 'A late rescue spray without a compliant harvest interval can make the lot ineligible for the planned harvest date.'
  }
]);

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function scheduleWithDates(seedDate, operations = CHEMICAL_OPERATIONS) {
  const base = parseIsoDate(seedDate);
  return operations.map((operation) => ({
    ...operation,
    date: toIsoDate(addUtcDays(base, operation.day))
  }));
}

export function validateNitrogenPlan(plan) {
  const target = finitePositive(plan.targetN);
  const splits = [plan.split1, plan.split2, plan.split3, plan.split4].map(finiteNonNegative);
  const errors = [];
  if (target === null) errors.push('Enter an approved seasonal N target.');
  else if (target < 120 || target > 150) errors.push('The entered N target is outside the published 120–150 kg N/ha M20 evidence envelope; attach the approving protocol.');
  if (splits.some((value) => value === null)) errors.push('Enter all four split percentages.');
  const splitTotal = splits.every((value) => value !== null) ? splits.reduce((sum, value) => sum + value, 0) : null;
  if (splitTotal !== null && Math.abs(splitTotal - 100) > 0.01) errors.push(`Four N splits total ${splitTotal.toFixed(1)}%; they must total 100%.`);
  return {
    valid: errors.length === 0,
    errors,
    splitTotal,
    allocations: target !== null && splits.every((value) => value !== null)
      ? splits.map((percent) => target * percent / 100)
      : []
  };
}

export function calculateFertilizerProduct({ nutrientKgHa, nutrientPercent, areaHa, bagKg }) {
  const nutrient = finiteNonNegative(nutrientKgHa);
  const percent = finitePositive(nutrientPercent);
  const area = finitePositive(areaHa);
  const bag = finitePositive(bagKg);
  if (nutrient === null || percent === null || percent > 100 || area === null) return null;
  const productKgHa = nutrient / (percent / 100);
  const productKg = productKgHa * area;
  return {
    productKgHa,
    productKg,
    bags: bag === null ? null : productKg / bag
  };
}

export function calculateGa3Mix({ activeRateGHa, productConcentrationPercent, areaHa, waterLHa, splitPercent }) {
  const activeRate = finitePositive(activeRateGHa);
  const concentration = finitePositive(productConcentrationPercent);
  const area = finitePositive(areaHa);
  const water = finitePositive(waterLHa);
  const split = finitePositive(splitPercent);
  if ([activeRate, concentration, area, water, split].some((value) => value === null) || concentration > 100 || split > 100) return null;
  const activeTotalG = activeRate * area;
  const productTotalG = activeTotalG / (concentration / 100);
  return {
    activeTotalG,
    productTotalG,
    splitActiveG: activeTotalG * split / 100,
    splitProductG: productTotalG * split / 100,
    splitWaterL: water * area * split / 100,
    totalWaterL: water * area
  };
}

export function applicationGateStatus(record) {
  const required = ['diagnosisConfirmed', 'registrationVerified', 'labelVerified', 'approvalVerified', 'calibrationVerified', 'weatherVerified', 'ppeVerified', 'intervalsRecorded'];
  const missing = required.filter((name) => !record[name]);
  return {
    ready: missing.length === 0,
    missing
  };
}

export function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function applicationsToCsv(records) {
  const fields = [
    'date', 'status', 'category', 'line', 'trigger', 'productName', 'activeIngredient', 'formulation',
    'registrationNumber', 'registrationExpiry', 'cropTarget', 'labelRate', 'appliedRate', 'areaHa',
    'waterVolumeL', 'rei', 'phi', 'operator', 'supervisor', 'weather', 'ppe', 'notes'
  ];
  const header = fields.map((field) => field.replace(/([A-Z])/g, ' $1').replace(/^./, (character) => character.toUpperCase()));
  const rows = [header, ...records.map((record) => fields.map((field) => record[field] ?? ''))];
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}
