import {
  DEFAULT_CONFIG,
  PHASES,
  addUtcDays,
  buildCalendar,
  calculateTemperatureStatus,
  calendarToCsv,
  formatCalendarDate,
  parseIsoDate,
  toIsoDate
} from './calendar.js';
import {
  cropDayForDate,
  cropPhaseForDay,
  evaluateCurrentWeatherAlerts,
  generateAgronomicAdvisories,
  threeDayRainTotal
} from './weather-core.js';
import {
  applicationGateStatus,
  applicationsToCsv,
  calculateFertilizerProduct,
  calculateGa3Mix,
  scheduleWithDates,
  validateNitrogenPlan
} from './chemical-core.js';
import {
  build125DayTemperatureSeries,
  computeTgmsRiskMetrics,
  renderTemperatureD3Chart
} from './temperature-chart.js';
import {
  FARM_COORDINATE,
  REGIONAL_HOTSPOTS,
  renderRegionalD3Map
} from './regional-map.js';
import {
  classifyPagasaDryWetDay,
  getPagasaSeasonalAdvisory,
  renderPagasaSeasonalForecast
} from './pagasa-seasonal.js';

const STORAGE = Object.freeze({
  config: 'lingan-agronomist.v1.config',
  completed: 'lingan-agronomist.v1.completed',
  observations: 'lingan-agronomist.v1.observations',
  weatherHistory: 'lingan-agronomist.v1.weather-history',
  nutrientPlan: 'lingan-agronomist.v1.nutrient-plan',
  applications: 'lingan-agronomist.v1.applications'
});

const $ = (id) => document.getElementById(id);
const readJson = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const persistedConfig = readJson(STORAGE.config, {});
let config = { ...DEFAULT_CONFIG, ...persistedConfig };
let completed = readJson(STORAGE.completed, {});
let observations = readJson(STORAGE.observations, []);
let weatherHistory = readJson(STORAGE.weatherHistory, []);
let nutrientPlan = readJson(STORAGE.nutrientPlan, {});
let applications = readJson(STORAGE.applications, []);
let calendar = buildCalendar(config);
let weatherData = null;
let filterTimer;

const elements = {
  calendarBody: $('calendar-body'),
  calendarEmpty: $('calendar-empty'),
  resultsCount: $('results-count'),
  query: $('search-operations'),
  line: $('line-filter'),
  phase: $('phase-filter'),
  critical: $('critical-filter'),
  settingsDialog: $('settings-dialog'),
  settingsForm: $('settings-form'),
  observationDialog: $('observation-dialog'),
  observationForm: $('observation-form'),
  observationList: $('observation-list'),
  observationEmpty: $('observation-empty'),
  nutrientPlanForm: $('nutrient-plan-form'),
  fertilizerCalculator: $('fertilizer-calculator'),
  ga3Calculator: $('ga3-calculator'),
  chemicalScheduleBody: $('chemical-schedule-body'),
  applicationDialog: $('application-dialog'),
  applicationForm: $('application-form'),
  applicationList: $('application-list'),
  applicationEmpty: $('application-empty'),
  announcer: $('live-announcer'),
  scrollFrame: $('calendar-scroll')
};

function announce(message) {
  elements.announcer.textContent = '';
  window.setTimeout(() => { elements.announcer.textContent = message; }, 40);
}

function localTodayAsUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function formatUpper(date) {
  return formatCalendarDate(date).toUpperCase();
}

function formatShort(date) {
  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit', month: 'short', timeZone: 'UTC'
  }).format(date).toUpperCase();
}

function lineClass(line) {
  if (line === 'S-line') return 'line-s';
  if (line === 'P-line') return 'line-p';
  return 'line-both';
}

function phaseColor(phaseId) {
  return ({
    nursery: '#718096',
    establishment: '#3b7a57',
    tillering: '#2f855a',
    pi: '#d97706',
    sterility: '#c66a0a',
    anthesis: '#16805b',
    filling: '#46766a',
    harvest: '#755f3b'
  })[phaseId];
}

function windowClass(windowName) {
  return windowName === 'normal' ? '' : `window-${windowName}`;
}

function dateRange(startDay, endDay) {
  const base = parseIsoDate(config.seedDate);
  return `${formatShort(addUtcDays(base, startDay))}–${formatShort(addUtcDays(base, endDay))}`;
}

function renderMetadata() {
  const seedDate = parseIsoDate(config.seedDate);
  const pDate = addUtcDays(seedDate, Number(config.pStagger));
  $('meta-location').textContent = config.municipality;
  $('meta-stagger').textContent = `P-line +${config.pStagger} days`;
  $('meta-ratio').textContent = `${config.rowRatio.replace(':', ' S : ')} P`;
  $('decision-seed-date').textContent = new Intl.DateTimeFormat('en-PH', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  }).format(seedDate);
  $('metric-s-date').textContent = formatUpper(seedDate);
  $('metric-p-date').textContent = formatUpper(pDate);
  $('metric-p-note').textContent = `TG102M · Day ${config.pStagger}`;
  $('metric-sterility').textContent = dateRange(60, 88);
  $('metric-heading').textContent = dateRange(85, 102);
  $('plan-fingerprint').textContent = `PLAN · ${config.seedDate} · P+${config.pStagger} · ${config.rowRatio}`;
}

function renderClock() {
  const today = localTodayAsUtc();
  const seedDate = parseIsoDate(config.seedDate);
  const day = Math.floor((today - seedDate) / 86_400_000);
  const offset = $('today-offset');
  const task = $('today-task');
  if (day < 0) {
    offset.textContent = `D${day} · ${Math.abs(day)} day${day === -1 ? '' : 's'} to sowing`;
    task.textContent = 'Use this lead time for lot verification, nursery preparation, isolation mapping, and logger calibration.';
  } else if (day > 124) {
    offset.textContent = `D+${day} · calendar closed`;
    task.textContent = 'Preserve harvest, drying, laboratory, and certification records. Start a new plan for a new crop.';
  } else {
    offset.textContent = `D${day} · ${formatCalendarDate(today)}`;
    task.textContent = calendar[day].task;
  }

  const count = Object.values(completed).filter(Boolean).length;
  $('completion-count').textContent = `${count} of 125`;
  $('completion-meter').style.width = `${Math.min(100, count / 125 * 100)}%`;
}

function renderPhaseRail() {
  const rail = $('phase-rail');
  rail.textContent = '';
  const todayDay = Math.floor((localTodayAsUtc() - parseIsoDate(config.seedDate)) / 86_400_000);
  for (const phase of PHASES) {
    const item = document.createElement('li');
    item.className = 'phase-item';
    if (todayDay >= phase.start && todayDay <= phase.end) item.classList.add('phase-active');
    item.style.setProperty('--phase-color', phaseColor(phase.id));
    const dayLabel = document.createElement('span');
    dayLabel.textContent = `D${phase.start}–D${phase.end}`;
    const title = document.createElement('strong');
    title.textContent = phase.label;
    const range = document.createElement('time');
    range.dateTime = `${toIsoDate(addUtcDays(parseIsoDate(config.seedDate), phase.start))}/${toIsoDate(addUtcDays(parseIsoDate(config.seedDate), phase.end))}`;
    range.textContent = dateRange(phase.start, phase.end);
    item.append(dayLabel, title, range);
    rail.append(item);
  }
}

function createCalendarRow(operation) {
  const row = document.createElement('tr');
  row.dataset.day = String(operation.day);
  row.dataset.phase = operation.phaseId;
  row.dataset.line = operation.line;
  row.dataset.critical = String(operation.critical);
  row.dataset.search = `${operation.day} ${toIsoDate(operation.date)} ${operation.phase} ${operation.task} ${operation.line} ${operation.risk}`.toLocaleLowerCase();
  const specialWindow = windowClass(operation.window);
  if (specialWindow) row.classList.add(specialWindow);
  if (completed[`day-${operation.day}`]) row.classList.add('row-complete');

  const doneCell = document.createElement('td');
  doneCell.className = 'done-cell';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'done-checkbox';
  checkbox.checked = Boolean(completed[`day-${operation.day}`]);
  checkbox.dataset.completionDay = String(operation.day);
  checkbox.setAttribute('aria-label', `Mark Day ${operation.day}, ${operation.phase}, complete`);
  doneCell.append(checkbox);

  const dateCell = document.createElement('td');
  dateCell.className = 'date-cell';
  const day = document.createElement('strong');
  day.textContent = `D${operation.day}`;
  const time = document.createElement('time');
  time.dateTime = toIsoDate(operation.date);
  time.textContent = formatCalendarDate(operation.date);
  dateCell.append(day, time);

  const phaseCell = document.createElement('td');
  phaseCell.className = 'phase-cell';
  const phase = document.createElement('span');
  phase.className = 'phase-chip';
  phase.textContent = operation.phase;
  phaseCell.append(phase);

  const taskCell = document.createElement('td');
  taskCell.className = 'task-cell';
  const task = document.createElement('span');
  task.className = 'task-text';
  task.textContent = operation.task;
  const evidence = document.createElement('span');
  evidence.className = 'evidence-tag';
  evidence.textContent = operation.evidence;
  taskCell.append(task, evidence);

  const lineCell = document.createElement('td');
  lineCell.className = 'line-cell';
  const line = document.createElement('span');
  line.className = `line-badge ${lineClass(operation.line)}`;
  line.textContent = operation.line.toUpperCase();
  lineCell.append(line);

  const riskCell = document.createElement('td');
  riskCell.className = 'risk-cell';
  riskCell.textContent = operation.risk;
  row.append(doneCell, dateCell, phaseCell, taskCell, lineCell, riskCell);
  return row;
}

function renderCalendar() {
  elements.calendarBody.textContent = '';
  const fragment = document.createDocumentFragment();
  for (const operation of calendar) fragment.append(createCalendarRow(operation));
  elements.calendarBody.append(fragment);
  applyFilters();
}

function filterLineMatches(operationLine, filterLine) {
  if (filterLine === 'all') return true;
  if (filterLine === 'Both') return operationLine === 'Both';
  return operationLine === filterLine || operationLine === 'Both';
}

function applyFilters() {
  const query = elements.query.value.trim().toLocaleLowerCase();
  const line = elements.line.value;
  const phase = elements.phase.value;
  const criticalOnly = elements.critical.checked;
  let visible = 0;
  for (const row of elements.calendarBody.rows) {
    const matches = (!query || row.dataset.search.includes(query))
      && filterLineMatches(row.dataset.line, line)
      && (phase === 'all' || row.dataset.phase === phase)
      && (!criticalOnly || row.dataset.critical === 'true');
    row.hidden = !matches;
    if (matches) visible += 1;
  }
  elements.resultsCount.textContent = `Showing ${visible} of 125 daily operation${visible === 1 ? '' : 's'}.`;
  elements.calendarEmpty.hidden = visible !== 0;
}

function queueFilters() {
  window.clearTimeout(filterTimer);
  filterTimer = window.setTimeout(applyFilters, 120);
}

function populatePhaseFilter() {
  for (const phase of PHASES) {
    const option = document.createElement('option');
    option.value = phase.id;
    option.textContent = phase.label;
    elements.phase.append(option);
  }
}

function renderNitrogenPlan() {
  if (Object.keys(nutrientPlan).length) setFormValues(elements.nutrientPlanForm, nutrientPlan);
  const validation = validateNitrogenPlan(nutrientPlan);
  const status = $('n-plan-status');
  const lock = $('protocol-lock-state');
  status.className = `mono mini-status ${validation.valid && nutrientPlan.approvalReference ? 'is-valid' : 'is-invalid'}`;
  status.textContent = validation.valid && nutrientPlan.approvalReference ? 'VALIDATED · APPROVAL RECORDED' : 'INCOMPLETE / LOCKED';
  lock.textContent = validation.valid && nutrientPlan.approvalReference
    ? 'N PLAN ENTERED · PRODUCT AND FIELD GATES STILL APPLY'
    : 'RATES LOCKED · APPROVED VALUES REQUIRED';
  const container = $('n-allocation-results');
  container.textContent = '';
  if (!validation.valid || !nutrientPlan.approvalReference) {
    const list = document.createElement('ul');
    list.className = 'plan-errors';
    const messages = [...validation.errors];
    if (!nutrientPlan.approvalReference) messages.push('Record the signed approval or protocol reference.');
    for (const message of messages) {
      const item = document.createElement('li');
      item.textContent = message;
      list.append(item);
    }
    container.append(list);
    return;
  }
  const gates = [
    ['N1 · D18', 'Basal / S transplant'],
    ['N2 · D30', 'Early tillering'],
    ['N3 · D40', 'Active tillering'],
    ['N4 · D54', 'Confirmed PI']
  ];
  validation.allocations.forEach((allocation, index) => {
    const card = document.createElement('div');
    card.className = 'allocation-card';
    const label = document.createElement('span');
    label.textContent = gates[index][0];
    const value = document.createElement('strong');
    value.textContent = `${allocation.toFixed(1)} kg N/ha`;
    const note = document.createElement('small');
    note.textContent = gates[index][1];
    card.append(label, value, note);
    container.append(card);
  });
}

function renderChemicalSchedule() {
  elements.chemicalScheduleBody.textContent = '';
  for (const operation of scheduleWithDates(config.seedDate)) {
    const row = document.createElement('tr');
    const dateCell = document.createElement('td');
    dateCell.className = 'chemical-day';
    dateCell.textContent = `D${operation.day} · ${operation.date}`;
    const gateCell = document.createElement('td');
    gateCell.className = 'chemical-gate';
    const code = document.createElement('strong');
    code.textContent = operation.code;
    const category = document.createElement('span');
    category.textContent = operation.category;
    gateCell.append(code, category);
    const executionCell = document.createElement('td');
    executionCell.className = 'chemical-execution';
    const trigger = document.createElement('strong');
    trigger.textContent = operation.trigger;
    const action = document.createElement('span');
    action.textContent = operation.action;
    executionCell.append(trigger, action);
    const targetCell = document.createElement('td');
    targetCell.className = 'chemical-target';
    targetCell.textContent = operation.line;
    const restraintCell = document.createElement('td');
    restraintCell.className = 'chemical-restraint';
    restraintCell.textContent = operation.restraint;
    row.append(dateCell, gateCell, executionCell, targetCell, restraintCell);
    elements.chemicalScheduleBody.append(row);
  }
}

function saveNutrientPlan(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(elements.nutrientPlanForm));
  nutrientPlan = values;
  const validation = validateNitrogenPlan(values);
  if (!validation.valid || !values.approvalReference.trim()) {
    renderNitrogenPlan();
    announce('Nutrient plan remains locked. Complete the highlighted approval and allocation requirements.');
    return;
  }
  writeJson(STORAGE.nutrientPlan, nutrientPlan);
  renderNitrogenPlan();
  announce('Approved four-gate nitrogen allocation saved.');
}

function calculateFertilizer(event) {
  event.preventDefault();
  if (!elements.fertilizerCalculator.reportValidity()) return;
  const values = Object.fromEntries(new FormData(elements.fertilizerCalculator));
  const result = calculateFertilizerProduct(values);
  const output = $('fertilizer-result');
  if (!result) {
    output.innerHTML = '<strong>Check inputs</strong><span>Enter positive area and product analysis values.</span>';
    return;
  }
  const bagText = result.bags === null ? 'bag count not calculated' : `${result.bags.toFixed(2)} entered-size bags`;
  output.innerHTML = `<strong>Calculated product requirement</strong><span>${result.productKgHa.toFixed(2)} kg product/ha · ${result.productKg.toFixed(2)} kg for the treated area · ${bagText}</span>`;
}

function calculateGa3(event) {
  event.preventDefault();
  if (!elements.ga3Calculator.reportValidity()) return;
  const values = Object.fromEntries(new FormData(elements.ga3Calculator));
  const result = calculateGa3Mix(values);
  const output = $('ga3-result');
  if (!result || !values.approvalReference.trim()) {
    output.innerHTML = '<strong>Calculation locked</strong><span>Enter a signed protocol reference and valid positive values.</span>';
    return;
  }
  output.innerHTML = `<strong>${values.line} · this split</strong><span>${result.splitActiveG.toFixed(2)} g active ingredient = ${result.splitProductG.toFixed(2)} g of the entered formulation in ${result.splitWaterL.toFixed(1)} L calibrated carrier. Full-area totals: ${result.productTotalG.toFixed(2)} g product and ${result.totalWaterL.toFixed(1)} L carrier.</span>`;
}

function openApplication() {
  elements.applicationForm.reset();
  $('application-date').value = suggestedObservationDate();
  $('application-error').hidden = true;
  elements.applicationDialog.showModal();
  window.setTimeout(() => $('application-date').focus(), 0);
}

function applicationRecordFromForm() {
  const data = new FormData(elements.applicationForm);
  const values = Object.fromEntries(data);
  const gates = ['diagnosisConfirmed', 'registrationVerified', 'labelVerified', 'approvalVerified', 'calibrationVerified', 'weatherVerified', 'ppeVerified', 'intervalsRecorded'];
  for (const gate of gates) values[gate] = data.has(gate);
  return {
    id: globalThis.crypto?.randomUUID?.() || `application-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...values,
    areaHa: Number(values.areaHa),
    waterVolumeL: values.waterVolumeL === '' ? '' : Number(values.waterVolumeL)
  };
}

function saveApplication(event) {
  if (event.submitter?.value !== 'save') return;
  event.preventDefault();
  const error = $('application-error');
  error.hidden = true;
  if (!elements.applicationForm.reportValidity()) return;
  const record = applicationRecordFromForm();
  const gate = applicationGateStatus(record);
  if (record.status === 'Completed' && !gate.ready) {
    error.hidden = false;
    error.textContent = `Completed status is blocked. ${gate.missing.length} of 8 release gates remain unchecked. Save as Draft or Hold, or complete the verified gates.`;
    return;
  }
  applications.push(record);
  writeJson(STORAGE.applications, applications);
  renderApplications();
  elements.applicationDialog.close('save');
  announce(`${record.status} application record saved.`);
}

function renderApplications() {
  elements.applicationList.textContent = '';
  const latest = [...applications].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
  elements.applicationEmpty.hidden = latest.length > 0;
  for (const record of latest) {
    const card = document.createElement('article');
    card.className = `application-card${record.status === 'Hold' ? ' is-hold' : ''}`;
    const head = document.createElement('div');
    head.className = 'application-card-head';
    const identity = document.createElement('div');
    const date = document.createElement('p');
    date.className = 'record-date';
    date.textContent = `${record.date} · ${record.category}`;
    const title = document.createElement('h4');
    title.textContent = `${record.productName} · ${record.line}`;
    identity.append(date, title);
    const status = document.createElement('span');
    status.className = `application-status status-${record.status.toLowerCase()}`;
    status.textContent = record.status;
    head.append(identity, status);
    const facts = document.createElement('div');
    facts.className = 'application-facts';
    for (const fact of [`Applied ${record.appliedRate}`, `Area ${record.areaHa} ha`, `REI ${record.rei}`, `PHI ${record.phi}`]) {
      const item = document.createElement('span');
      item.textContent = fact;
      facts.append(item);
    }
    const trigger = document.createElement('p');
    trigger.textContent = `Trigger: ${record.trigger}`;
    const approval = document.createElement('p');
    approval.textContent = `Operator: ${record.operator} · Supervisor: ${record.supervisor || 'not entered'}`;
    const remove = document.createElement('button');
    remove.className = 'delete-record no-print';
    remove.type = 'button';
    remove.dataset.deleteApplication = record.id;
    remove.textContent = 'Delete this application record';
    card.append(head, facts, trigger, approval, remove);
    elements.applicationList.append(card);
  }
}

function deleteApplication(id) {
  applications = applications.filter((record) => record.id !== id);
  writeJson(STORAGE.applications, applications);
  renderApplications();
  announce('Application record deleted.');
}

function renderAll() {
  calendar = buildCalendar(config);
  renderMetadata();
  renderClock();
  renderPhaseRail();
  renderCalendar();
  renderObservations();
  renderNitrogenPlan();
  renderChemicalSchedule();
  renderApplications();
  renderTemperatureTrendChart();
  if (weatherData) renderWeather();
}

function formatWeatherTimestamp(value) {
  if (!value) return 'Unavailable';
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value) ? `${value}+08:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value.replace('T', ' ');
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila'
  }).format(date);
}

function formatWeatherDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC'
  }).format(date);
}

function temperature(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}°C` : '—';
}

function measurement(value, unit, digits = 1) {
  return Number.isFinite(value) ? `${value.toFixed(digits)} ${unit}` : '—';
}

function recordWeatherSnapshot(data) {
  if (!data?.generatedAt || weatherHistory.some((entry) => entry.generatedAt === data.generatedAt)) return;
  const present = data.presentDay?.consensus || {};
  weatherHistory.unshift({
    generatedAt: data.generatedAt,
    currentC: data.current?.primaryTemperatureC,
    daylightMeanC: present.daylightMeanC,
    nightMeanC: present.nightMeanC,
    sourceCount: present.sourceCount
  });
  weatherHistory = weatherHistory.slice(0, 30);
  writeJson(STORAGE.weatherHistory, weatherHistory);
}

function renderWeatherHistory() {
  const container = $('weather-history');
  container.textContent = '';
  if (!weatherHistory.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No forecast refresh has been recorded on this device.';
    container.append(empty);
    return;
  }
  for (const entry of weatherHistory.slice(0, 10)) {
    const row = document.createElement('div');
    row.className = 'weather-history-row';
    const values = [
      formatWeatherTimestamp(entry.generatedAt),
      `Now ${temperature(entry.currentC)}`,
      `Day ${temperature(entry.daylightMeanC)}`,
      `Night ${temperature(entry.nightMeanC)} · ${entry.sourceCount || 0}/3`
    ];
    for (const value of values) {
      const span = document.createElement('span');
      span.textContent = value;
      row.append(span);
    }
    container.append(row);
  }
}

function renderProviders() {
  const container = $('weather-providers');
  container.textContent = '';
  for (const [index, provider] of weatherData.providers.entries()) {
    const card = document.createElement('article');
    card.className = 'provider-card';
    const marker = document.createElement('span');
    marker.className = 'provider-index';
    marker.textContent = String(index + 1).padStart(2, '0');
    const copy = document.createElement('div');
    const name = document.createElement('strong');
    const link = document.createElement('a');
    link.href = provider.documentation;
    link.textContent = provider.name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    name.append(link);
    const model = document.createElement('small');
    model.textContent = `${provider.model} · ${provider.forecastHorizon}`;
    const update = document.createElement('small');
    update.textContent = `Issued ${formatWeatherTimestamp(provider.updatedAt)} · ${provider.status}`;
    copy.append(name, model, update);
    card.append(marker, copy);
    container.append(card);
  }
}

function adviceClass(severity) {
  return ['critical', 'high', 'moderate', 'routine'].includes(severity) ? severity : 'routine';
}

function renderWeatherTable() {
  const body = $('weather-forecast-body');
  body.textContent = '';
  for (let index = 0; index < weatherData.daily.length; index += 1) {
    const day = weatherData.daily[index];
    const cropDay = cropDayForDate(config.seedDate, day.date);
    const operation = cropDay >= 0 && cropDay < calendar.length ? calendar[cropDay] : null;
    const advisories = generateAgronomicAdvisories(day, cropDay, threeDayRainTotal(weatherData.daily, index));
    const primary = advisories[0];
    const row = document.createElement('tr');
    row.className = `weather-${adviceClass(primary.severity)}`;

    const dateCell = document.createElement('td');
    dateCell.className = 'weather-date';
    const dateLabel = document.createElement('strong');
    dateLabel.textContent = formatWeatherDate(day.date);
    const dateValue = document.createElement('time');
    dateValue.dateTime = day.date;
    dateValue.textContent = cropDay < 0 ? `D${cropDay} · PRE-SOW` : cropDay <= 124 ? `D${cropDay}` : `D+${cropDay}`;
    dateCell.append(dateLabel, dateValue);

    const sourcesCell = document.createElement('td');
    const sources = document.createElement('span');
    sources.className = `source-count confidence-${day.consensus.confidence}`;
    sources.textContent = `${day.consensus.sourceCount}/3 ${day.consensus.confidence}`;
    sources.title = day.sources.map((source) => `${source.sourceId}: day ${temperature(source.daylightMeanC)}, night ${temperature(source.nightMeanC)}`).join('\n');

    const dryWet = classifyPagasaDryWetDay(day.consensus.rainMm);
    const pagasaBadge = document.createElement('span');
    pagasaBadge.className = `pagasa-day-pill pill-pagasa-${dryWet.type}`;
    pagasaBadge.textContent = `${dryWet.label} (${dryWet.threshold})`;
    pagasaBadge.title = `DOST-PAGASA Rice Agronomy: ${dryWet.label} (${dryWet.threshold})`;
    sourcesCell.append(sources, pagasaBadge);

    const dayCell = document.createElement('td');
    dayCell.className = 'weather-temperature';
    const dayMean = document.createElement('strong');
    dayMean.textContent = temperature(day.consensus.daylightMeanC);
    const dayRange = document.createElement('small');
    dayRange.textContent = `${temperature(day.consensus.minimumC)}–${temperature(day.consensus.maximumC)}`;
    dayCell.append(dayMean, dayRange);

    const nightCell = document.createElement('td');
    nightCell.className = 'weather-temperature';
    const nightMean = document.createElement('strong');
    nightMean.textContent = temperature(day.consensus.nightMeanC);
    const dailyMean = document.createElement('small');
    dailyMean.textContent = `24 h mean ${temperature(day.consensus.dailyMeanC)}`;
    nightCell.append(nightMean, dailyMean);

    const exposureCell = document.createElement('td');
    exposureCell.textContent = `${measurement(day.consensus.rainMm, 'mm')} · ${measurement(day.consensus.windMaximumKmh, 'km/h')}`;

    const operationCell = document.createElement('td');
    operationCell.className = 'operation-cell';
    const phase = document.createElement('strong');
    phase.textContent = cropPhaseForDay(cropDay);
    const operationText = document.createElement('span');
    operationText.textContent = operation?.task || (cropDay < 0 ? 'Prepare seed lots, drainage, isolation map, and logger.' : 'Outside the active D0–D124 calendar.');
    operationCell.append(phase, operationText);

    const decisionCell = document.createElement('td');
    const decision = document.createElement('span');
    decision.className = `decision-chip decision-${adviceClass(primary.severity)}`;
    decision.textContent = primary.category;
    const decisionText = document.createElement('p');
    decisionText.className = 'microcopy';
    decisionText.textContent = primary.title;
    decisionCell.append(decision, decisionText);
    row.append(dateCell, sourcesCell, dayCell, nightCell, exposureCell, operationCell, decisionCell);
    body.append(row);
  }
}

let weatherAlertMode = 'live';

function getActiveWeatherPayloadAndCropDay() {
  const currentDateStr = weatherData.current?.time ? weatherData.current.time.slice(0, 10) : toIsoDate(localTodayAsUtc());
  const actualCropDay = cropDayForDate(config.seedDate, currentDateStr);

  if (weatherAlertMode === 'sim-tgms-cold') {
    return {
      cropDay: 65,
      payload: {
        current: {
          time: `${currentDateStr}T06:00:00+08:00`,
          primarySourceId: 'canopy-logger',
          primaryTemperatureC: 22.4,
          consensusTemperatureC: 22.4,
          consensusWindKmh: 6,
          sources: [
            { sourceId: 'logger-sensor', time: `${currentDateStr}T06:00:00+08:00`, temperatureC: 22.4, humidityPct: 88, windKmh: 6, gustKmh: 12, precipitationMm: 0 },
            { sourceId: 'open-meteo', time: `${currentDateStr}T06:00:00+08:00`, temperatureC: 22.8, humidityPct: 85, windKmh: 7, gustKmh: 14, precipitationMm: 0 }
          ]
        },
        presentDay: {
          consensus: { dailyMeanC: 25.8, nightMeanC: 22.4, daylightMeanC: 29.2, rainMm: 0 }
        }
      }
    };
  }

  if (weatherAlertMode === 'sim-wind-gust') {
    return {
      cropDay: actualCropDay < 0 ? 88 : actualCropDay,
      payload: {
        current: {
          time: `${currentDateStr}T09:30:00+08:00`,
          primarySourceId: 'open-meteo',
          primaryTemperatureC: 28.5,
          consensusTemperatureC: 28.5,
          consensusWindKmh: 22.0,
          sources: [
            { sourceId: 'open-meteo', time: `${currentDateStr}T09:30:00+08:00`, temperatureC: 28.5, humidityPct: 75, windKmh: 22.0, gustKmh: 28.4, precipitationMm: 0 }
          ]
        },
        presentDay: {
          consensus: { dailyMeanC: 28.0, nightMeanC: 24.5, daylightMeanC: 31.5, rainMm: 0 }
        }
      }
    };
  }

  if (weatherAlertMode === 'sim-anthesis-rain') {
    return {
      cropDay: 90,
      payload: {
        current: {
          time: `${currentDateStr}T10:15:00+08:00`,
          primarySourceId: 'open-meteo',
          primaryTemperatureC: 26.2,
          consensusTemperatureC: 26.2,
          consensusWindKmh: 14,
          sources: [
            { sourceId: 'open-meteo', time: `${currentDateStr}T10:15:00+08:00`, temperatureC: 26.2, humidityPct: 95, windKmh: 14, gustKmh: 22, precipitationMm: 14.2 }
          ]
        },
        presentDay: {
          consensus: { dailyMeanC: 26.8, nightMeanC: 24.0, daylightMeanC: 29.6, rainMm: 35.0 }
        }
      }
    };
  }

  if (weatherAlertMode === 'sim-heat-stress') {
    return {
      cropDay: 88,
      payload: {
        current: {
          time: `${currentDateStr}T12:00:00+08:00`,
          primarySourceId: 'open-meteo',
          primaryTemperatureC: 36.8,
          consensusTemperatureC: 36.8,
          consensusWindKmh: 9,
          sources: [
            { sourceId: 'open-meteo', time: `${currentDateStr}T12:00:00+08:00`, temperatureC: 36.8, humidityPct: 58, windKmh: 9, gustKmh: 18, precipitationMm: 0 }
          ]
        },
        presentDay: {
          consensus: { dailyMeanC: 32.5, nightMeanC: 26.5, daylightMeanC: 38.5, rainMm: 0 }
        }
      }
    };
  }

  return {
    cropDay: actualCropDay,
    payload: weatherData
  };
}

function renderWeatherAlerts() {
  const list = $('weather-alert-list');
  const countBadge = $('weather-alert-count');
  list.textContent = '';
  if (!weatherData) return;

  const { payload, cropDay: currentCropDay } = getActiveWeatherPayloadAndCropDay();
  const currentAlerts = evaluateCurrentWeatherAlerts(payload, currentCropDay);

  const seasonalAdvisories = getPagasaSeasonalAdvisory(
    currentCropDay,
    weatherData.current?.time ? weatherData.current.time.slice(0, 10) : toIsoDate(localTodayAsUtc()),
    weatherData.pagasaSeasonalForecast
  );
  if (seasonalAdvisories && seasonalAdvisories.length) {
    for (const adv of seasonalAdvisories) {
      currentAlerts.push({
        isCurrent: true,
        severity: adv.severity,
        category: adv.category,
        title: adv.title,
        warning: adv.summary,
        restraint: 'Factor DOST-PAGASA seasonal climate prediction into water depth and field activity scheduling.',
        remedial: adv.action,
        measured: 'DOST-PAGASA CAD Outlook',
        threshold: 'Seasonal Risk Threshold',
        time: weatherData.current?.time || new Date().toISOString(),
        cropDay: currentCropDay,
        affectedActivities: ['water management', 'sterility audit', 'field drainage']
      });
    }
  }

  const forecastAlerts = [];
  if (Array.isArray(weatherData.daily)) {
    for (let index = 0; index < weatherData.daily.length; index += 1) {
      const day = weatherData.daily[index];
      const cropDay = cropDayForDate(config.seedDate, day.date);
      const advisories = generateAgronomicAdvisories(day, cropDay, threeDayRainTotal(weatherData.daily, index));
      for (const item of advisories) {
        if (item.severity !== 'routine') forecastAlerts.push({ ...item, date: day.date, cropDay, isCurrent: false });
      }
    }
  }

  const rank = { critical: 0, high: 1, moderate: 2, routine: 3 };
  forecastAlerts.sort((a, b) => rank[a.severity] - rank[b.severity] || a.date.localeCompare(b.date));

  const totalAlerts = currentAlerts.length + forecastAlerts.length;
  countBadge.textContent = String(totalAlerts);

  const hasCritical = currentAlerts.some((a) => a.severity === 'critical') || forecastAlerts.some((a) => a.severity === 'critical');
  const hasHigh = currentAlerts.some((a) => a.severity === 'high') || forecastAlerts.some((a) => a.severity === 'high');

  countBadge.classList.toggle('alert-count-critical', hasCritical);
  countBadge.classList.toggle('alert-count-warning', !hasCritical && hasHigh);

  // Status Banner
  const banner = document.createElement('div');
  const currentPhase = cropPhaseForDay(currentCropDay);
  if (currentAlerts.length > 0) {
    banner.className = 'current-alert-banner alert-banner-active';
    banner.setAttribute('role', 'alert');
    const pulse = document.createElement('span');
    pulse.className = 'alert-pulsing';
    pulse.setAttribute('aria-hidden', 'true');
    const content = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = `AUTOMATED WEATHER WARNING: ${currentAlerts.length} CRITICAL THRESHOLD ALERT${currentAlerts.length > 1 ? 'S' : ''}`;
    const desc = document.createElement('p');
    desc.textContent = `Live conditions breach critical crop threshold for D${currentCropDay} (${currentPhase}). Action required.`;
    content.append(heading, desc);
    banner.append(pulse, content);
  } else {
    banner.className = 'current-alert-banner alert-banner-safe';
    const check = document.createElement('span');
    check.className = 'signal signal-green';
    check.setAttribute('aria-hidden', 'true');
    const content = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = 'AUTOMATED SCAN: NORMAL';
    const desc = document.createElement('p');
    desc.textContent = `All current observations are within safe crop guardrails for D${currentCropDay} (${currentPhase}).`;
    content.append(heading, desc);
    banner.append(check, content);
  }
  list.append(banner);

  // Render Current Alerts
  if (currentAlerts.length > 0) {
    for (const item of currentAlerts) {
      const card = document.createElement('article');
      card.className = `weather-alert severity-${item.severity} is-current`;
      
      const head = document.createElement('div');
      head.className = 'weather-alert-head';
      const date = document.createElement('span');
      date.className = 'weather-alert-date';
      const livePill = document.createElement('span');
      livePill.className = 'live-pill';
      livePill.textContent = 'LIVE ALERT';
      date.append(livePill, document.createTextNode(`${item.cropDay < 0 ? `D${item.cropDay}` : `D${item.cropDay}`} · ${formatWeatherTimestamp(item.time)}`));
      
      const badge = document.createElement('span');
      badge.className = `decision-chip decision-${item.severity}`;
      badge.textContent = `${item.severity.toUpperCase()} · ${item.category}`;
      head.append(date, badge);

      const title = document.createElement('h4');
      title.textContent = item.title;
      card.append(head, title);

      if (item.measured && item.threshold) {
        const metricRow = document.createElement('div');
        metricRow.className = 'threshold-metric-row';
        const measuredTag = document.createElement('span');
        measuredTag.className = 'threshold-tag';
        measuredTag.innerHTML = `Measured: <strong>${item.measured}</strong>`;
        const limitTag = document.createElement('span');
        limitTag.className = 'threshold-tag threshold-limit';
        limitTag.innerHTML = `Critical limit: <strong>${item.threshold}</strong>`;
        metricRow.append(measuredTag, limitTag);
        card.append(metricRow);
      }

      const warning = document.createElement('p');
      warning.textContent = item.warning;

      const restraint = document.createElement('p');
      const restraintLabel = document.createElement('strong');
      restraintLabel.textContent = 'Restraint: ';
      restraint.append(restraintLabel, document.createTextNode(item.restraint));

      const remedial = document.createElement('p');
      const remedialLabel = document.createElement('strong');
      remedialLabel.textContent = 'Remedial: ';
      remedial.append(remedialLabel, document.createTextNode(item.remedial));

      card.append(warning, restraint, remedial);

      if (Array.isArray(item.affectedActivities) && item.affectedActivities.length) {
        const chips = document.createElement('div');
        chips.className = 'affected-chips';
        const label = document.createElement('span');
        label.textContent = 'Restricted operations:';
        chips.append(label);
        for (const act of item.affectedActivities) {
          const chip = document.createElement('span');
          chip.className = 'affected-chip';
          chip.textContent = act;
          chips.append(chip);
        }
        card.append(chips);
      }

      list.append(card);
    }
  }

  // Render Forecast Alerts
  if (forecastAlerts.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'alert-section-divider';
    const divText = document.createElement('span');
    divText.textContent = `Upcoming Forecast Warnings (${forecastAlerts.length})`;
    divider.append(divText);
    list.append(divider);

    const displayed = forecastAlerts.slice(0, 10);
    for (const item of displayed) {
      const card = document.createElement('article');
      card.className = `weather-alert severity-${item.severity}`;
      const head = document.createElement('div');
      head.className = 'weather-alert-head';
      const date = document.createElement('span');
      date.className = 'weather-alert-date';
      date.textContent = `${formatWeatherDate(item.date)} · ${item.cropDay < 0 ? `D${item.cropDay}` : `D${item.cropDay}`}`;
      const badge = document.createElement('span');
      badge.className = `decision-chip decision-${item.severity}`;
      badge.textContent = `${item.severity} · ${item.category}`;
      head.append(date, badge);
      const title = document.createElement('h4');
      title.textContent = item.title;
      const warning = document.createElement('p');
      warning.textContent = item.warning;
      const restraint = document.createElement('p');
      const restraintLabel = document.createElement('strong');
      restraintLabel.textContent = 'Restraint: ';
      restraint.append(restraintLabel, document.createTextNode(item.restraint));
      const remedial = document.createElement('p');
      const remedialLabel = document.createElement('strong');
      remedialLabel.textContent = 'Remedial: ';
      remedial.append(remedialLabel, document.createTextNode(item.remedial));
      card.append(head, title, warning, restraint, remedial);
      list.append(card);
    }
  } else if (currentAlerts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No configured weather threshold is crossed. Continue field observations.';
    list.append(empty);
  }

  renderRegionalMap();
}

let mapActiveCategory = 'all';
let selectedMapHotspot = null;

function renderActiveHotspotBanner(hotspot) {
  const banner = $('active-hotspot-banner');
  if (!banner) return;
  if (!hotspot) {
    banner.hidden = true;
    banner.textContent = '';
    return;
  }
  banner.hidden = false;
  banner.innerHTML = `
    <strong>${hotspot.name}</strong> · <span class="mono">${hotspot.threshold}</span><br>
    <span>${hotspot.hazard}</span>
    <em>Mitigation: ${hotspot.mitigation}</em>
  `;
}

function renderRegionalMap() {
  const container = $('regional-d3-map');
  if (!container || !weatherData) return;

  const { payload, cropDay: currentCropDay } = getActiveWeatherPayloadAndCropDay();
  const currentAlerts = evaluateCurrentWeatherAlerts(payload, currentCropDay);

  renderRegionalD3Map(container, REGIONAL_HOTSPOTS, {
    activeCategory: mapActiveCategory,
    alertMode: weatherAlertMode,
    liveAlerts: weatherAlertMode === 'live' ? currentAlerts : [],
    selectedHotspotId: selectedMapHotspot?.id || null,
    onSelectHotspot: (hotspot) => {
      selectedMapHotspot = hotspot;
      renderActiveHotspotBanner(hotspot);
      announce(`Selected hotspot ${hotspot.name}: ${hotspot.hazard}`);
      renderRegionalMap();
    }
  });
}

function renderTemperatureTrendChart() {
  const chartContainer = $('temperature-d3-chart');
  if (!chartContainer) return;
  const series = build125DayTemperatureSeries(config.seedDate, weatherData, observations);
  const currentCropDay = cropDayForDate(config.seedDate, toIsoDate(localTodayAsUtc()));
  const metrics = computeTgmsRiskMetrics(series);

  const strip = $('chart-metrics-strip');
  if (strip) {
    strip.textContent = '';
    const items = [
      {
        label: 'Sterility Window',
        value: metrics.riskLevel === 'critical' ? 'High Thermal Risk' : metrics.riskLevel === 'moderate' ? 'Moderate Risk' : 'Within Guardrails',
        class: metrics.riskLevel === 'critical' ? 'badge-danger' : metrics.riskLevel === 'moderate' ? 'badge-warning' : 'badge-safe'
      },
      {
        label: 'Sub-24°C Exposure (D60–D88)',
        value: `${metrics.daysBelowMin} of ${metrics.totalWindowDays} days`,
        class: metrics.daysBelowMin > 0 ? 'badge-danger' : 'badge-safe'
      },
      {
        label: 'Sub-27°C Mean (D60–D88)',
        value: `${metrics.daysBelowMean} of ${metrics.totalWindowDays} days`,
        class: metrics.daysBelowMean > 0 ? 'badge-warning' : 'badge-safe'
      },
      {
        label: 'Window Min Trajectory',
        value: `${metrics.minInWindow.toFixed(1)}°C`,
        class: metrics.minInWindow < 24 ? 'badge-danger' : 'badge-safe'
      }
    ];

    for (const item of items) {
      const chip = document.createElement('div');
      chip.className = `chart-metric-chip ${item.class}`;
      const lbl = document.createElement('span');
      lbl.className = 'chip-label';
      lbl.textContent = item.label;
      const val = document.createElement('strong');
      val.className = 'chip-val mono';
      val.textContent = item.value;
      chip.append(lbl, val);
      strip.append(chip);
    }
  }

  renderTemperatureD3Chart(chartContainer, series, currentCropDay);
}

function renderWeather() {
  const present = weatherData.presentDay?.consensus || {};
  $('weather-current').textContent = temperature(weatherData.current?.primaryTemperatureC);
  $('weather-current-time').textContent = `Primary ${weatherData.current?.primarySourceId || 'source'} · ${formatWeatherTimestamp(weatherData.current?.time)}`;
  $('weather-day-mean').textContent = temperature(present.daylightMeanC);
  $('weather-night-mean').textContent = temperature(present.nightMeanC);
  $('weather-agreement').textContent = `${present.sourceCount || 0}/3 · ${(present.confidence || 'low').toUpperCase()}`;
  $('weather-spread').textContent = `${temperature(present.temperatureSpreadC)} inter-model spread`;
  $('weather-next-refresh').textContent = formatWeatherTimestamp(weatherData.nextRefreshDueAt);
  $('weather-generated').textContent = `FULL REFRESH · ${formatWeatherTimestamp(weatherData.generatedAt)}`;
  const freshness = $('weather-freshness');
  const stale = Date.now() > new Date(weatherData.nextRefreshDueAt).getTime();
  freshness.className = `weather-freshness${stale ? ' is-stale' : ''}`;
  freshness.textContent = stale ? 'Forecast older than 48 h' : 'Three-source record current';
  renderProviders();
  renderPagasaSeasonalForecast($('pagasa-seasonal-container'), weatherData.pagasaSeasonalForecast);
  renderTemperatureTrendChart();
  renderWeatherTable();
  renderWeatherAlerts();
  renderWeatherHistory();
}

async function loadWeather(force = false) {
  const button = $('refresh-weather');
  const error = $('weather-error');
  button.disabled = true;
  button.textContent = 'Checking forecast…';
  error.hidden = true;
  try {
    const suffix = force ? `?v=${Date.now()}` : '';
    const response = await fetch(`./data/weather.json${suffix}`, { cache: force ? 'no-store' : 'default' });
    if (!response.ok) throw new Error(`Weather record returned HTTP ${response.status}.`);
    const data = await response.json();
    if (data.schema !== 'lingan-agronomist-weather/v1') throw new Error('Weather record schema is not supported.');
    weatherData = data;
    recordWeatherSnapshot(data);
    renderWeather();
    if (force) announce('Latest published three-provider forecast loaded.');
  } catch (loadError) {
    error.hidden = false;
    error.textContent = `Weather intelligence is unavailable: ${loadError.message} Use the field logger and local PAGASA advisories until the next successful refresh.`;
    const freshness = $('weather-freshness');
    freshness.className = 'weather-freshness is-error';
    freshness.textContent = 'Forecast unavailable';
  } finally {
    button.disabled = false;
    button.textContent = 'Check latest published forecast';
  }
}

function setFormValues(form, values) {
  for (const [name, value] of Object.entries(values)) {
    const control = form.elements.namedItem(name);
    if (control) control.value = value ?? '';
  }
}

function openSettings() {
  setFormValues(elements.settingsForm, config);
  elements.settingsDialog.showModal();
  window.setTimeout(() => $('farm-name').focus(), 0);
}

function saveSettings(event) {
  if (event.submitter?.value !== 'save') return;
  event.preventDefault();
  if (!elements.settingsForm.reportValidity()) return;
  const values = Object.fromEntries(new FormData(elements.settingsForm));
  config = {
    ...config,
    ...values,
    pStagger: Number(values.pStagger)
  };
  const stored = writeJson(STORAGE.config, config);
  renderAll();
  elements.settingsDialog.close('save');
  announce(stored ? 'Plan saved and calendar regenerated.' : 'Calendar regenerated, but browser storage is unavailable.');
}

function suggestedObservationDate() {
  const today = localTodayAsUtc();
  const seed = parseIsoDate(config.seedDate);
  const end = addUtcDays(seed, 124);
  if (today < seed) return config.seedDate;
  if (today > end) return toIsoDate(end);
  return toIsoDate(today);
}

function openObservation() {
  elements.observationForm.reset();
  $('observation-date').value = suggestedObservationDate();
  elements.observationDialog.showModal();
  window.setTimeout(() => $('observation-date').focus(), 0);
}

function normalizeOptionalNumber(value) {
  return value === '' ? '' : Number(value);
}

function saveObservation(event) {
  if (event.submitter?.value !== 'save') return;
  event.preventDefault();
  if (!elements.observationForm.reportValidity()) return;
  const values = Object.fromEntries(new FormData(elements.observationForm));
  const observation = {
    id: globalThis.crypto?.randomUUID?.() || `observation-${Date.now()}`,
    createdAt: new Date().toISOString(),
    date: values.date,
    line: values.line,
    minTemperature: normalizeOptionalNumber(values.minTemperature),
    meanTemperature: normalizeOptionalNumber(values.meanTemperature),
    rainfall: normalizeOptionalNumber(values.rainfall),
    waterDepth: normalizeOptionalNumber(values.waterDepth),
    notes: values.notes.trim()
  };
  observations.push(observation);
  const stored = writeJson(STORAGE.observations, observations);
  renderObservations();
  elements.observationDialog.close('save');
  announce(stored ? 'Field observation saved.' : 'Observation is visible for this session, but browser storage is unavailable.');
}

function displayMeasurement(value, unit) {
  return value === '' || value === undefined ? `— ${unit}` : `${Number(value).toFixed(1)} ${unit}`;
}

function thermalLabel(status) {
  if (status === 'exception') return ['Thermal exception', 'thermal-exception'];
  if (status === 'within-guardrail') return ['Within guardrail', 'thermal-within'];
  return ['Thermal incomplete', 'thermal-incomplete'];
}

function renderObservations() {
  elements.observationList.textContent = '';
  const latest = [...observations].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)).slice(0, 9);
  elements.observationEmpty.hidden = latest.length > 0;
  for (const observation of latest) {
    const card = document.createElement('article');
    card.className = 'record-card';
    const head = document.createElement('div');
    head.className = 'record-head';
    const identity = document.createElement('div');
    const date = document.createElement('p');
    date.className = 'record-date';
    date.textContent = observation.date;
    const line = document.createElement('p');
    line.className = 'record-line';
    line.textContent = observation.line;
    identity.append(date, line);
    const status = calculateTemperatureStatus(observation);
    const [statusText, statusClass] = thermalLabel(status);
    const badge = document.createElement('span');
    badge.className = `thermal-badge ${statusClass}`;
    badge.textContent = statusText;
    head.append(identity, badge);

    const stats = document.createElement('div');
    stats.className = 'record-stats';
    const values = [
      `Tmin ${displayMeasurement(observation.minTemperature, '°C')}`,
      `Tmean ${displayMeasurement(observation.meanTemperature, '°C')}`,
      `Rain ${displayMeasurement(observation.rainfall, 'mm')}`,
      `Water ${displayMeasurement(observation.waterDepth, 'cm')}`
    ];
    for (const value of values) {
      const item = document.createElement('span');
      item.textContent = value;
      stats.append(item);
    }
    const notes = document.createElement('p');
    notes.className = 'record-notes';
    notes.textContent = observation.notes;
    const remove = document.createElement('button');
    remove.className = 'delete-record no-print';
    remove.type = 'button';
    remove.dataset.deleteObservation = observation.id;
    remove.textContent = 'Delete this observation';
    card.append(head, stats, notes, remove);
    elements.observationList.append(card);
  }
  renderTemperatureTrendChart();
}

function deleteObservation(id) {
  observations = observations.filter((observation) => observation.id !== id);
  writeJson(STORAGE.observations, observations);
  renderObservations();
  announce('Field observation deleted.');
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCalendar() {
  downloadFile(`mestiso-20-calendar-${config.seedDate}.csv`, `\uFEFF${calendarToCsv(calendar, completed)}`, 'text/csv;charset=utf-8');
  announce('Calendar CSV exported.');
}

function exportRecords() {
  const exportData = {
    schema: 'lingan-agronomist-field-records/v1',
    exportedAt: new Date().toISOString(),
    config,
    completed,
    observations,
    nutrientPlan,
    applications,
    weatherHistory,
    latestWeatherRecord: weatherData
  };
  downloadFile(`mestiso-20-field-records-${config.seedDate}.json`, JSON.stringify(exportData, null, 2), 'application/json');
  announce('Field-record backup exported.');
}

function exportApplications() {
  downloadFile(`mestiso-20-input-ledger-${config.seedDate}.csv`, `\uFEFF${applicationsToCsv(applications)}`, 'text/csv;charset=utf-8');
  announce('Fertilizer and chemical application ledger exported.');
}

function updateScrollHints() {
  const frame = elements.scrollFrame;
  const maxScroll = frame.scrollWidth - frame.clientWidth;
  frame.classList.toggle('can-scroll-left', frame.scrollLeft > 4);
  frame.classList.toggle('can-scroll-right', maxScroll - frame.scrollLeft > 4);
}

populatePhaseFilter();
renderAll();
updateScrollHints();
loadWeather();

$('open-settings').addEventListener('click', openSettings);
$('open-observation').addEventListener('click', openObservation);
$('open-observation-secondary').addEventListener('click', openObservation);
$('open-application').addEventListener('click', openApplication);
$('open-application-secondary').addEventListener('click', openApplication);
$('jump-calendar').addEventListener('click', () => $('calendar').scrollIntoView({ behavior: 'smooth', block: 'start' }));
$('print-dashboard').addEventListener('click', () => window.print());
$('export-calendar').addEventListener('click', exportCalendar);
$('export-records').addEventListener('click', exportRecords);
$('export-applications').addEventListener('click', exportApplications);
$('refresh-weather').addEventListener('click', () => loadWeather(true));
$('restore-defaults').addEventListener('click', () => {
  setFormValues(elements.settingsForm, DEFAULT_CONFIG);
  announce('Research baseline loaded into the settings form. Save to apply it.');
});

elements.settingsForm.addEventListener('submit', saveSettings);
elements.observationForm.addEventListener('submit', saveObservation);
elements.applicationForm.addEventListener('submit', saveApplication);
elements.nutrientPlanForm.addEventListener('submit', saveNutrientPlan);
elements.fertilizerCalculator.addEventListener('submit', calculateFertilizer);
elements.ga3Calculator.addEventListener('submit', calculateGa3);
elements.query.addEventListener('input', queueFilters);
elements.line.addEventListener('change', applyFilters);
elements.phase.addEventListener('change', applyFilters);
elements.critical.addEventListener('change', applyFilters);
$('calendar-filters').addEventListener('reset', () => window.setTimeout(applyFilters, 0));

elements.calendarBody.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-completion-day]');
  if (!checkbox) return;
  const key = `day-${checkbox.dataset.completionDay}`;
  completed[key] = checkbox.checked;
  if (!checkbox.checked) delete completed[key];
  writeJson(STORAGE.completed, completed);
  checkbox.closest('tr').classList.toggle('row-complete', checkbox.checked);
  renderClock();
  announce(`Day ${checkbox.dataset.completionDay} marked ${checkbox.checked ? 'complete' : 'not complete'}.`);
});

elements.observationList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-observation]');
  if (button) deleteObservation(button.dataset.deleteObservation);
});

elements.applicationList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-application]');
  if (button) deleteApplication(button.dataset.deleteApplication);
});

elements.scrollFrame.addEventListener('scroll', updateScrollHints, { passive: true });
window.addEventListener('resize', updateScrollHints, { passive: true });

const alertModeControl = $('weather-alert-mode');
if (alertModeControl) {
  alertModeControl.addEventListener('change', (event) => {
    weatherAlertMode = event.target.value;
    renderWeatherAlerts();
    renderRegionalMap();
    announce(`Threshold monitor updated to ${event.target.options[event.target.selectedIndex].text}.`);
  });
}

const mapFilterRow = document.querySelector('.map-filter-row');
if (mapFilterRow) {
  mapFilterRow.addEventListener('click', (event) => {
    const button = event.target.closest('[data-map-filter]');
    if (!button) return;
    mapFilterRow.querySelectorAll('.map-filter-btn').forEach((btn) => btn.classList.remove('is-active'));
    button.classList.add('is-active');
    mapActiveCategory = button.dataset.mapFilter;
    renderRegionalMap();
    announce(`Regional map filtered to ${button.textContent}.`);
  });
}

window.setInterval(() => {
  if (weatherData) renderWeatherAlerts();
}, 60_000);

let chartResizeTimer;
window.addEventListener('resize', () => {
  window.clearTimeout(chartResizeTimer);
  chartResizeTimer = window.setTimeout(() => {
    renderTemperatureTrendChart();
    renderRegionalMap();
  }, 150);
});

