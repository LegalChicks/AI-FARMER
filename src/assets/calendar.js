export const DEFAULT_CONFIG = Object.freeze({
  farmName: 'Lanna Production Block',
  municipality: 'Lanna, Solana, Cagayan',
  seedDate: '2026-09-20',
  pStagger: 5,
  rowRatio: '8:2',
  sLot: 'PRUP TG102 · record lot ID',
  pLot: 'TG102M · record lot ID'
});

export const PHASES = Object.freeze([
  { id: 'nursery', label: 'Nursery & land readiness', start: 0, end: 17 },
  { id: 'establishment', label: 'Transplant establishment', start: 18, end: 32 },
  { id: 'tillering', label: 'Early tillering', start: 33, end: 53 },
  { id: 'pi', label: 'PI diagnosis', start: 54, end: 59 },
  { id: 'sterility', label: 'Critical sterility audit', start: 60, end: 84 },
  { id: 'anthesis', label: 'Heading / anthesis', start: 85, end: 102 },
  { id: 'filling', label: 'Filling / integrity', start: 103, end: 115 },
  { id: 'harvest', label: 'Maturity / harvest control', start: 116, end: 124 }
]);

const DAY_MS = 86_400_000;

export function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) throw new TypeError(`Invalid ISO date: ${value}`);
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new TypeError(`Invalid calendar date: ${value}`);
  }
  return date;
}

export function addUtcDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function formatCalendarDate(date) {
  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

export function getPhase(day) {
  return PHASES.find((phase) => day >= phase.start && day <= phase.end) || PHASES.at(-1);
}

function normalizeConfig(config) {
  const pStagger = Number(config.pStagger);
  return {
    ...DEFAULT_CONFIG,
    ...config,
    pStagger: Number.isInteger(pStagger) && pStagger >= 0 && pStagger <= 14 ? pStagger : DEFAULT_CONFIG.pStagger
  };
}

function mergeLine(current, incoming) {
  if (!current) return incoming;
  return current === incoming ? current : 'Both';
}

function buildKeyEvents(config) {
  const events = new Map();
  const add = (day, task, line, risk, evidence = 'operational') => {
    if (day < 0 || day > 124) return;
    const current = events.get(day);
    if (current) {
      current.task = `${current.task} ${task}`;
      current.line = mergeLine(current.line, line);
      current.risk = `${current.risk} ${risk}`;
      current.evidence = current.evidence === evidence ? evidence : 'mixed';
      return;
    }
    events.set(day, { task, line, risk, evidence });
  };

  add(0, 'Sow PRUP TG102 in a labelled S-line nursery. Record seed lot, germination test, seedbed area, and water source; install the field data logger.', 'S-line', 'Reference clock starts. F1 release still depends on the later thermal and sterility audit.', 'documented');
  add(1, `Check germination moisture and drainage. Complete the field map with ${config.rowRatio} S:P modules and establish isolation and control-plot records.`, 'Both', 'Watch for heavy rain, seed movement, and contaminated irrigation.', 'operational');
  add(7, 'Inspect both labelled nurseries for emergence, color, vigor, drainage, weeds, snails, insects, and disease. Release a nursery fertilizer or pesticide only from a recorded diagnosis and the approved M20 sheet/current product label.', 'Both', 'No automatic nursery chemical application; keep S and P nursery records separate.', 'site-dependent');
  add(14, `Prepare and level the production block; repair bunds and inlet/outlet structures; stake every ${config.rowRatio} S:P module and control plot. Lock the nutrient plan from MOET/soil evidence, exact treated area, fertilizer grades, and four approved N allocations.`, 'Both', 'No field product rate is final while the diagnostic result, area, product grade, or split allocation is missing.', 'site-dependent');
  add(18, 'Transplant PRUP TG102 at uniform seedling age. Apply only the approved S-area basal allocation; record each product grade, kg product, and kg N-P₂O₅-K₂O-S-Zn contributed. The documented M20 evidence supports a 120–150 kg N/ha seasonal envelope, not a universal product recipe.', 'S-line', 'Keep product out of P lanes and waterways. P, K, S, and Zn follow the block diagnosis.', 'documented');
  add(20, 'Count S-line establishment. Replant gaps only with traceable, same-age S seedlings; start the daily water-depth and pest record.', 'S-line', 'Remove volunteer rice and preserve lot identity.', 'operational');
  add(26, 'Map weeds and golden apple snail pressure. Use water, hand/mechanical control, and sanitation first. If chemical control is justified, use only a current FPA-registered rice/target product exactly according to its label and record the decision.', 'Both', 'No routine tank mix; current product label controls rate, PPE, re-entry, and restrictions.', 'site-dependent');
  add(30, 'Complete stand, tiller, crop-color/LCC, water, pest, and S:P synchrony audits. Release N split 2 only at its approved percentage; calculate S and P product masses from their actual treated areas and reconcile cumulative N.', 'Both', 'Hold or reduce the planned split if crop diagnosis or synchrony does not support it.', 'site-dependent');
  add(35, 'At active tillering, count tillers and emerged leaves separately in S and P sample hills; rogue clear off-types before canopy closure.', 'Both', 'Keep the same marked sample hills for weekly comparison.', 'operational');
  add(40, 'Complete the active-tillering audit and release N split 3 only when the approved plan, crop status, and S:P leaf/PI gap support it. Record any diagnosis-based P or K correction assigned to this gate.', 'Both', 'Do not use urea or DAP as an automatic flowering accelerator.', 'site-dependent');
  add(45, 'Drain briefly only when field access or root aeration is needed and irrigation return is reliable; restore shallow water after work. Continue threshold-based scouting.', 'Both', 'Do not impose water stress to force heading.', 'site-dependent');
  add(50, 'Start the formal synchronization sheet: final leaf count, tillers, plant height, developmental score, and first PI dissection sample for each parent. Review, but do not yet release, the final nutrient allocation.', 'Both', 'Calendar day alone cannot release the PI fertilizer split.', 'operational');
  add(54, 'Repeat primordial sampling. When PI, water, lodging/disease risk, and synchronization confirm the plan, apply approved N split 4 and any diagnosis-based PI K allocation; reconcile the final seasonal totals.', 'Both', 'No further blanket N after the final approved split.', 'site-dependent');
  add(57, 'Confirm PI and map the S/P developmental gap. Use only documented local remedials. Lock the logger protocol and bagged S-line control locations.', 'Both', 'This field measurement overrides calendar prediction.', 'operational');
  add(60, 'Begin the S-line temperature-sensitive sterility audit. Log canopy minimum/maximum temperature, daily mean, rain, and water depth; take baseline bagged S-line controls.', 'S-line', 'Critical guardrail: minimum ≥24°C and daily mean ≥27°C from PI through the next 2–3 weeks.', 'documented');
  add(63, 'Review logger completeness and inspect S panicle development. Maintain stable shallow water; avoid blanket N or growth-regulator applications.', 'S-line', 'Any cool exposure requires documented selfing-risk escalation.', 'operational');
  add(67, 'Perform the mid-window sterility audit; repeat S pollen or bagged-control observations under the approved laboratory/field protocol.', 'S-line', 'Visual appearance alone cannot establish sterility.', 'operational');
  add(70, 'Lock the GA₃ operation sheet: approved active rate, product concentration, S/P treated areas, water volume, split percentages, label, calibration, PPE, crew, and weather limits. Prepare clean rope and pollen-work paths.', 'Both', 'Public M20 sources do not establish a current commercial dose; keep the rate locked until the signed protocol is entered.', 'operational');
  add(74, 'Complete the second PI-to-post-PI audit. Update the S/P heading forecast from observed development.', 'Both', 'Cool Amihan nights can create TGMS fertility-reversion risk.', 'modelled');
  add(78, 'Scout flag-leaf and boot stage. Mark fixed S sample hills, count emerged panicles morning and afternoon, assess exertion, and verify every production-row identity.', 'S-line', 'GA₃ is stage-triggered. PhilRice research reports best timing at 20–30% heading; the signed current M20 protocol controls.', 'documented');
  add(82, 'Run the pre-heading quality gate: reconcile the S/P heading map, verify the approved GA₃ rate sheet, water-calibrate the sprayer, and prepare dry-panicle rope paths.', 'Both', 'Do not mix or spray while any rate, concentration, split, label, area, or calibration field is unresolved.', 'operational');
  add(85, 'Earliest modelled S heading: at the observed, approved heading threshold only, apply GA₃ split 1 using the calculated product mass and carrier volume. Record heading %, product batch, active rate, treated area, weather, operator, and time.', 'S-line', 'Hold for wet foliage, rain, excessive wind, missing approval, unverified concentration, or failed calibration.', 'site-dependent');
  add(86, 'Apply GA₃ split 2 only if split 1 is recorded and the next approved heading/exsertion trigger, label, and weather gates all pass. Recalculate the remaining treated area and formulation.', 'S-line', 'Never apply split 2 merely because 24 hours elapsed.', 'site-dependent');
  add(87, 'At observed flowering, remove dew from P panicles early. Begin rope pulling along P rows at about 08:00 and repeat toward the roughly 10:00 opening peak only when panicles are dry. Hold routine insecticide, fungicide, foliar fertilizer, and incompatible tank mixes during active anthesis.', 'Both', 'Pollen coverage must coincide with open S florets; emergency treatment requires diagnosis, current label, and supervisor approval.', 'documented');
  add(88, 'Continue pollen supplementation on every active flowering day. Record S and P flowering percentages and weather at each pass.', 'Both', 'The modelled S thermal window can still be active.', 'operational');
  add(91, 'Expected S flowering-peak scenario: execute morning rope passes and inspect pollen shed, stigma receptivity, and panicle exertion.', 'Both', 'Stop or reschedule while panicles are wet from dew or rain.', 'modelled');
  add(95, 'Confirm whether S flowering has ended and continue P monitoring. Read protected bagged S-line controls for selfing risk.', 'Both', 'Observed heading may extend to D102.', 'modelled');
  add(102, 'Latest modelled PRUP TG102 50% heading bound. Close pollen operations only when flowering counts confirm S completion; begin seed-set, purity, and threshold-based pest surveillance. Any treatment requires current FPA registration and the rice/target label.', 'Both', 'Late heading increases Amihan and low-temperature exposure; do not spray from symptoms alone.', 'modelled');
  add(106, 'Walk the block after anthesis. Maintain water for grain fill as required; assess lodging, disease, and off-types; protect each S seed-harvest lot identity.', 'Both', 'P-row grain must not enter the F1 seed stream.', 'operational');
  add(110, 'Audit early filling records and every chemical entry. Calculate the earliest label-compliant harvest date from each product PHI; flag any interval extending beyond the harvest plan.', 'S-line', 'Harvest cannot precede the longest applicable PHI; selfing evidence requires segregation and review.', 'operational');
  add(115, 'Close routine chemical work and prepare dedicated harvest bags, labels, moisture meter, drying surface, and lot flow. Stop irrigation only when crop stage and the approved harvest plan support it.', 'Both', 'Any emergency late treatment must document label, PHI, seed-quality impact, and revised harvest date.', 'site-dependent');
  add(120, 'Start maturity surveillance. Drain only for an approved harvest window; keep S and P harvest streams physically and administratively separate.', 'Both', 'Calendar date alone does not prove harvest maturity.', 'operational');
  add(124, 'Harvest S rows only at verified maturity. Label at cutting, threshing, and drying. Keep P rows outside F1 flow and submit required quality/purity samples.', 'S-line', 'Final F1 acceptance depends on field and laboratory evidence.', 'operational');

  const p1 = config.pStagger;
  add(p1, `Sow TG102M P1 exactly ${p1} day${p1 === 1 ? '' : 's'} after the S-line under the working plan. Keep the P seed lot physically separate.`, 'P-line', 'The documented M20 baseline is 5 days; any edited stagger requires an authorized biological decision.', p1 === 5 ? 'documented' : 'user-edited');
  add(p1 + 3, 'Sow a small, labelled TG102M P2 reserve nursery (maximum 20% of P seed) only for a leaf-count-confirmed late-pollen contingency. Hold it from the main block by default.', 'P-line', 'This is not an automatic production planting.', 'site-dependent');
  add(p1 + 6, 'Sow a small, labelled TG102M P3 reserve nursery (maximum 10% of P seed) as a contingency source only.', 'P-line', 'Uncontrolled additional male lots can damage synchrony.', 'site-dependent');
  add(p1 + 18, 'Transplant TG102M P1 into mapped P rows at uniform seedling age; label every P row and record stand count. Apply the approved P-area basal allocation separately from S and record product and nutrient totals for the actual P-row area.', 'P-line', 'P1 is the operative pollen source; do not copy the S product total to the smaller P area.', 'operational');
  add(p1 + 21, 'Inspect P2 reserve. Transplant only to a designated contingency strip when leaf count and PI evidence show P1 will be late and the supervisor approves it.', 'P-line', 'Do not insert unrecorded reserve plants into production rows.', 'site-dependent');
  add(p1 + 24, 'Inspect P3 reserve. Default action is to hold it outside the production block under seed-lot control.', 'P-line', 'Avoid unrecorded late pollen rows.', 'site-dependent');
  return events;
}

function defaultEvent(day) {
  if (day >= 60 && day <= 84) {
    return {
      task: 'Record S canopy minimum/maximum temperature, daily mean, rainfall, and water depth; maintain tagged controls and stable water.',
      line: 'S-line',
      risk: 'Sterility is evidence-based and cannot be assumed.',
      evidence: 'operational'
    };
  }
  if (day >= 85 && day <= 102) {
    return {
      task: 'Count heading by line. When open florets and dry panicles coincide, complete morning pollen supplementation and log each pass.',
      line: 'Both',
      risk: 'Anthesis work follows observed flowering, not a fixed date.',
      evidence: 'operational'
    };
  }
  if (day >= 103 && day <= 115) {
    return {
      task: 'Complete the field-integrity log for grain fill, water, disease, lodging, and off-types; retain row and lot identity.',
      line: 'Both',
      risk: 'Protect the S-row seed stream from P-row grain.',
      evidence: 'operational'
    };
  }
  if (day >= 116) {
    return {
      task: 'Record panicle maturity, weather, grain moisture, harvest-lot separation, and drying readiness.',
      line: 'Both',
      risk: 'Harvest only when crop evidence and weather are suitable.',
      evidence: 'operational'
    };
  }
  return {
    task: 'Record water depth, rainfall, stand condition, weeds, pests, diseases, and every intervention. Maintain S/P identity.',
    line: 'Both',
    risk: 'Escalate deviations before the next phenology gate.',
    evidence: 'operational'
  };
}

function windowForDay(day) {
  const sterility = day >= 60 && day <= 88;
  const anthesis = day >= 85 && day <= 102;
  if (sterility && anthesis) return 'overlap';
  if (sterility) return 'sterility';
  if (anthesis) return 'anthesis';
  return 'normal';
}

export function buildCalendar(inputConfig = DEFAULT_CONFIG) {
  const config = normalizeConfig(inputConfig);
  const seedDate = parseIsoDate(config.seedDate);
  const keyEvents = buildKeyEvents(config);
  return Array.from({ length: 125 }, (_, day) => {
    const event = keyEvents.get(day) || defaultEvent(day);
    const phase = getPhase(day);
    return {
      day,
      date: addUtcDays(seedDate, day),
      phase: phase.label,
      phaseId: phase.id,
      task: event.task,
      line: event.line,
      risk: event.risk,
      evidence: event.evidence,
      window: windowForDay(day),
      critical: day >= 54 && day <= 102
    };
  });
}

export function calculateTemperatureStatus(observation) {
  if (observation.minTemperature === '' || observation.minTemperature === null || observation.minTemperature === undefined
    || observation.meanTemperature === '' || observation.meanTemperature === null || observation.meanTemperature === undefined) {
    return 'incomplete';
  }
  const minimum = Number(observation.minTemperature);
  const mean = Number(observation.meanTemperature);
  if (!Number.isFinite(minimum) || !Number.isFinite(mean)) return 'incomplete';
  return minimum >= 24 && mean >= 27 ? 'within-guardrail' : 'exception';
}

export function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function calendarToCsv(calendar, completed = {}) {
  const rows = [['Day', 'Calendar Date', 'Growth Phase', 'Specific Task/Action', 'Target Line', 'Risk/Alert', 'Evidence', 'Complete']];
  for (const operation of calendar) {
    rows.push([
      `D${operation.day}`,
      toIsoDate(operation.date),
      operation.phase,
      operation.task,
      operation.line,
      operation.risk,
      operation.evidence,
      completed[`day-${operation.day}`] ? 'Yes' : 'No'
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}
