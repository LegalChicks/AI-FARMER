import {
  addUtcDays,
  formatCalendarDate,
  parseIsoDate,
  toIsoDate
} from './calendar.js';
import {
  WEATHER_THRESHOLDS,
  cropPhaseForDay,
  round
} from './weather-core.js';

export const TGMS_CONFIG = Object.freeze({
  minC: WEATHER_THRESHOLDS.tgmsMinimumC ?? 24,
  meanC: WEATHER_THRESHOLDS.tgmsDailyMeanC ?? 27,
  windowStart: 60,
  windowEnd: 88
});

// PAGASA 30-Year Climatological Normals for Solana / Tuguegarao Station (1991–2020)
// Month midpoints: Day-of-year and seasonal temperature trajectory
const SOLANA_MONTHLY_NORMALS = [
  { month: 1, dayOfYear: 15, mean: 23.8, min: 19.8, max: 27.9 }, // Jan (Peak cool Amihan)
  { month: 2, dayOfYear: 46, mean: 25.1, min: 20.3, max: 30.2 }, // Feb
  { month: 3, dayOfYear: 74, mean: 27.2, min: 21.8, max: 32.8 }, // Mar
  { month: 4, dayOfYear: 105, mean: 29.4, min: 23.9, max: 35.2 }, // Apr
  { month: 5, dayOfYear: 135, mean: 29.9, min: 24.9, max: 35.8 }, // May
  { month: 6, dayOfYear: 166, mean: 29.7, min: 25.1, max: 35.2 }, // Jun
  { month: 7, dayOfYear: 196, mean: 28.9, min: 24.7, max: 33.9 }, // Jul
  { month: 8, dayOfYear: 227, mean: 28.5, min: 24.6, max: 33.4 }, // Aug
  { month: 9, dayOfYear: 258, mean: 28.3, min: 24.4, max: 33.0 }, // Sep (Warm late wet season)
  { month: 10, dayOfYear: 288, mean: 27.2, min: 23.4, max: 31.4 }, // Oct (Autumn cooling)
  { month: 11, dayOfYear: 319, mean: 25.4, min: 21.8, max: 29.2 }, // Nov (Amihan onset / cold drops)
  { month: 12, dayOfYear: 349, mean: 24.0, min: 20.6, max: 27.6 }  // Dec (Cool season / sterility hazard)
];

function getDayOfYear(date) {
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.floor((date - startOfYear) / 86_400_000) + 1;
}

export function calculateSolanaClimatology(date) {
  const d = typeof date === 'string' ? parseIsoDate(date) : date;
  const dayOfYear = getDayOfYear(d);

  // Periodic linear interpolation across year boundaries
  let prev = SOLANA_MONTHLY_NORMALS.at(-1);
  let next = SOLANA_MONTHLY_NORMALS[0];

  for (let i = 0; i < SOLANA_MONTHLY_NORMALS.length; i += 1) {
    if (dayOfYear <= SOLANA_MONTHLY_NORMALS[i].dayOfYear) {
      next = SOLANA_MONTHLY_NORMALS[i];
      prev = i === 0 ? SOLANA_MONTHLY_NORMALS.at(-1) : SOLANA_MONTHLY_NORMALS[i - 1];
      break;
    }
    if (i === SOLANA_MONTHLY_NORMALS.length - 1) {
      prev = SOLANA_MONTHLY_NORMALS[i];
      next = SOLANA_MONTHLY_NORMALS[0];
    }
  }

  let span = next.dayOfYear - prev.dayOfYear;
  let offset = dayOfYear - prev.dayOfYear;
  if (span <= 0) {
    span += 365;
    if (offset < 0) offset += 365;
  }
  const ratio = Math.max(0, Math.min(1, offset / span));

  const mean = round(prev.mean + ratio * (next.mean - prev.mean), 1);
  const min = round(prev.min + ratio * (next.min - prev.min), 1);
  const max = round(prev.max + ratio * (next.max - prev.max), 1);

  return { dailyMeanC: mean, minimumC: min, maximumC: max };
}

export function build125DayTemperatureSeries(seedDateStr, weatherData = null, observations = []) {
  const seed = parseIsoDate(seedDateStr);
  const obsMap = new Map();
  if (Array.isArray(observations)) {
    for (const obs of observations) {
      if (obs?.date) obsMap.set(obs.date, obs);
    }
  }

  const forecastMap = new Map();
  if (weatherData && Array.isArray(weatherData.daily)) {
    for (const f of weatherData.daily) {
      if (f?.date && f.consensus) {
        forecastMap.set(f.date, f.consensus);
      }
    }
  }

  const series = [];

  for (let day = 0; day < 125; day += 1) {
    const dateObj = addUtcDays(seed, day);
    const dateStr = toIsoDate(dateObj);
    const phase = cropPhaseForDay(day);
    const inTgmsWindow = day >= TGMS_CONFIG.windowStart && day <= TGMS_CONFIG.windowEnd;

    let source = 'climatology';
    let meanTemp = null;
    let minTemp = null;
    let maxTemp = null;

    const recorded = obsMap.get(dateStr);
    const forecast = forecastMap.get(dateStr);

    if (recorded && (Number.isFinite(Number(recorded.meanTemperature)) || Number.isFinite(Number(recorded.minTemperature)))) {
      source = 'observed';
      meanTemp = Number.isFinite(Number(recorded.meanTemperature)) ? Number(recorded.meanTemperature) : null;
      minTemp = Number.isFinite(Number(recorded.minTemperature)) ? Number(recorded.minTemperature) : null;
      maxTemp = Number.isFinite(Number(recorded.maxTemperature)) ? Number(recorded.maxTemperature) : null;
    } else if (forecast && Number.isFinite(forecast.dailyMeanC)) {
      source = 'forecast';
      meanTemp = forecast.dailyMeanC;
      minTemp = forecast.minimumC ?? forecast.nightMeanC;
      maxTemp = forecast.maximumC ?? forecast.daylightMeanC;
    }

    const baseline = calculateSolanaClimatology(dateObj);
    if (!Number.isFinite(meanTemp)) meanTemp = baseline.dailyMeanC;
    if (!Number.isFinite(minTemp)) minTemp = baseline.minimumC;
    if (!Number.isFinite(maxTemp)) maxTemp = baseline.maximumC;

    const minBreached = minTemp < TGMS_CONFIG.minC;
    const meanBreached = meanTemp < TGMS_CONFIG.meanC;

    series.push({
      day,
      date: dateStr,
      dateObj,
      formattedDate: formatCalendarDate(dateObj),
      shortDate: new Intl.DateTimeFormat('en-PH', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(dateObj),
      phase,
      inTgmsWindow,
      source,
      meanTemp: round(meanTemp, 1),
      minTemp: round(minTemp, 1),
      maxTemp: round(maxTemp, 1),
      minBreached,
      meanBreached,
      tgmsRisk: inTgmsWindow && (minBreached || meanBreached)
    });
  }

  return series;
}

export function computeTgmsRiskMetrics(series) {
  const windowItems = series.filter((d) => d.inTgmsWindow);
  const daysBelowMin = windowItems.filter((d) => d.minBreached).length;
  const daysBelowMean = windowItems.filter((d) => d.meanBreached).length;
  const totalWindowDays = windowItems.length;

  const minInWindow = Math.min(...windowItems.map((d) => d.minTemp));
  const avgMeanInWindow = round(windowItems.reduce((acc, d) => acc + d.meanTemp, 0) / (totalWindowDays || 1), 1);

  const forecastDaysCount = series.filter((d) => d.source === 'forecast').length;
  const observedDaysCount = series.filter((d) => d.source === 'observed').length;

  let riskLevel = 'low';
  if (daysBelowMin > 15 || daysBelowMean > 15) {
    riskLevel = 'critical';
  } else if (daysBelowMin > 0 || daysBelowMean > 0) {
    riskLevel = 'moderate';
  }

  return {
    totalWindowDays,
    daysBelowMin,
    daysBelowMean,
    minInWindow,
    avgMeanInWindow,
    forecastDaysCount,
    observedDaysCount,
    riskLevel
  };
}

function getD3() {
  if (typeof globalThis !== 'undefined' && globalThis.d3) return globalThis.d3;
  if (typeof window !== 'undefined' && window.d3) return window.d3;
  return null;
}

export function renderTemperatureD3Chart(containerId, series, currentCropDay = null) {
  const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
  if (!container) return;

  const d3 = getD3();
  if (!d3) {
    container.innerHTML = '<p class="muted">D3 visualization library is loading...</p>';
    return;
  }

  container.textContent = '';

  const containerWidth = container.clientWidth || 880;
  const width = Math.max(containerWidth, 680);
  const height = 340;
  const margin = { top: 30, right: 110, bottom: 48, left: 48 };

  const svg = d3.create('svg')
    .attr('id', 'tgms-chart-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('role', 'img')
    .attr('aria-label', '125-day daily temperature trends vs 24°C and 27°C TGMS sterility thresholds chart')
    .style('width', '100%')
    .style('height', 'auto')
    .style('display', 'block')
    .style('font-family', 'inherit');

  // Scales
  const xScale = d3.scaleLinear()
    .domain([0, 124])
    .range([margin.left, width - margin.right]);

  const allTemps = series.flatMap((d) => [d.minTemp, d.maxTemp, d.meanTemp]).filter(Number.isFinite);
  const minY = Math.min(17, Math.floor(Math.min(...allTemps, 23) - 1));
  const maxY = Math.max(36, Math.ceil(Math.max(...allTemps, 28) + 1));

  const yScale = d3.scaleLinear()
    .domain([minY, maxY])
    .range([height - margin.bottom, margin.top]);

  // Background bands
  // 1. Critical Sterility Audit Window (D60–D88)
  const xStart = xScale(TGMS_CONFIG.windowStart);
  const xEnd = xScale(TGMS_CONFIG.windowEnd);
  svg.append('rect')
    .attr('x', xStart)
    .attr('y', margin.top)
    .attr('width', Math.max(0, xEnd - xStart))
    .attr('height', height - margin.top - margin.bottom)
    .attr('fill', '#fff1f2')
    .attr('opacity', 0.85);

  svg.append('line')
    .attr('x1', xStart).attr('x2', xStart)
    .attr('y1', margin.top).attr('y2', height - margin.bottom)
    .attr('stroke', '#fda4af')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4,3');

  svg.append('line')
    .attr('x1', xEnd).attr('x2', xEnd)
    .attr('y1', margin.top).attr('y2', height - margin.bottom)
    .attr('stroke', '#fda4af')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '4,3');

  svg.append('text')
    .attr('x', (xStart + xEnd) / 2)
    .attr('y', margin.top - 10)
    .attr('text-anchor', 'middle')
    .attr('fill', '#9f1239')
    .attr('font-size', '10px')
    .attr('font-weight', '700')
    .text('CRITICAL STERILITY WINDOW (D60–D88)');

  // Horizontal Grid lines
  const yTicks = [18, 20, 22, 24, 26, 27, 28, 30, 32, 34, 36].filter((t) => t >= minY && t <= maxY);
  svg.append('g')
    .attr('class', 'chart-grid')
    .selectAll('line')
    .data(yTicks)
    .join('line')
    .attr('x1', margin.left)
    .attr('x2', width - margin.right)
    .attr('y1', (d) => yScale(d))
    .attr('y2', (d) => yScale(d))
    .attr('stroke', (d) => (d === 24 || d === 27 ? 'transparent' : '#e2e8f0'))
    .attr('stroke-dasharray', (d) => (d % 4 === 0 ? 'none' : '2,2'))
    .attr('stroke-width', 1);

  // Temperature Envelope Shading (Min to Max)
  const areaGenerator = d3.area()
    .x((d) => xScale(d.day))
    .y0((d) => yScale(d.minTemp))
    .y1((d) => yScale(d.maxTemp))
    .curve(d3.curveMonotoneX);

  svg.append('path')
    .datum(series)
    .attr('fill', '#e0f2fe')
    .attr('opacity', 0.55)
    .attr('d', areaGenerator);

  // Lines
  const maxLine = d3.line()
    .x((d) => xScale(d.day))
    .y((d) => yScale(d.maxTemp))
    .curve(d3.curveMonotoneX);

  const meanLine = d3.line()
    .x((d) => xScale(d.day))
    .y((d) => yScale(d.meanTemp))
    .curve(d3.curveMonotoneX);

  const minLine = d3.line()
    .x((d) => xScale(d.day))
    .y((d) => yScale(d.minTemp))
    .curve(d3.curveMonotoneX);

  // Max line (subtle orange dashed)
  svg.append('path')
    .datum(series)
    .attr('fill', 'none')
    .attr('stroke', '#ea580c')
    .attr('stroke-width', 1.4)
    .attr('stroke-dasharray', '4,3')
    .attr('opacity', 0.75)
    .attr('d', maxLine);

  // Min line (solid teal)
  svg.append('path')
    .datum(series)
    .attr('fill', 'none')
    .attr('stroke', '#0d9488')
    .attr('stroke-width', 2)
    .attr('d', minLine);

  // Mean line (solid royal blue)
  svg.append('path')
    .datum(series)
    .attr('fill', 'none')
    .attr('stroke', '#1d4ed8')
    .attr('stroke-width', 2.6)
    .attr('d', meanLine);

  // THRESHOLD LINES & BADGES
  // 1. 27°C Mean Threshold
  const y27 = yScale(27);
  svg.append('line')
    .attr('x1', margin.left)
    .attr('x2', width - margin.right)
    .attr('y1', y27)
    .attr('y2', y27)
    .attr('stroke', '#d97706')
    .attr('stroke-width', 1.8)
    .attr('stroke-dasharray', '6,4');

  const badge27 = svg.append('g')
    .attr('transform', `translate(${width - margin.right + 6}, ${y27})`);
  badge27.append('rect')
    .attr('x', 0)
    .attr('y', -10)
    .attr('width', 94)
    .attr('height', 20)
    .attr('rx', 3)
    .attr('fill', '#fef3c7')
    .attr('stroke', '#d97706')
    .attr('stroke-width', 1);
  badge27.append('text')
    .attr('x', 47)
    .attr('y', 4)
    .attr('text-anchor', 'middle')
    .attr('fill', '#92400e')
    .attr('font-size', '9.5px')
    .attr('font-weight', '750')
    .text('27°C Mean Limit');

  // 2. 24°C Minimum Sterility Threshold
  const y24 = yScale(24);
  svg.append('line')
    .attr('x1', margin.left)
    .attr('x2', width - margin.right)
    .attr('y1', y24)
    .attr('y2', y24)
    .attr('stroke', '#dc2626')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '6,4');

  const badge24 = svg.append('g')
    .attr('transform', `translate(${width - margin.right + 6}, ${y24})`);
  badge24.append('rect')
    .attr('x', 0)
    .attr('y', -10)
    .attr('width', 94)
    .attr('height', 20)
    .attr('rx', 3)
    .attr('fill', '#fee2e2')
    .attr('stroke', '#dc2626')
    .attr('stroke-width', 1);
  badge24.append('text')
    .attr('x', 47)
    .attr('y', 4)
    .attr('text-anchor', 'middle')
    .attr('fill', '#991b1b')
    .attr('font-size', '9.5px')
    .attr('font-weight', '750')
    .text('24°C Min Sterility');

  // Observed points
  const observedPoints = series.filter((d) => d.source === 'observed');
  if (observedPoints.length > 0) {
    svg.selectAll('.obs-circle')
      .data(observedPoints)
      .join('circle')
      .attr('class', 'obs-circle')
      .attr('cx', (d) => xScale(d.day))
      .attr('cy', (d) => yScale(d.meanTemp))
      .attr('r', 4.5)
      .attr('fill', '#f59e0b')
      .attr('stroke', '#78350f')
      .attr('stroke-width', 1.5);
  }

  // Today marker if in range
  if (Number.isFinite(currentCropDay) && currentCropDay >= 0 && currentCropDay <= 124) {
    const xToday = xScale(currentCropDay);
    svg.append('line')
      .attr('x1', xToday).attr('x2', xToday)
      .attr('y1', margin.top).attr('y2', height - margin.bottom)
      .attr('stroke', '#166534')
      .attr('stroke-width', 1.6)
      .attr('stroke-dasharray', '3,3');

    const todayBadge = svg.append('g')
      .attr('transform', `translate(${xToday}, ${height - margin.bottom + 14})`);
    todayBadge.append('rect')
      .attr('x', -24)
      .attr('y', -10)
      .attr('width', 48)
      .attr('height', 16)
      .attr('rx', 3)
      .attr('fill', '#dcfce7')
      .attr('stroke', '#16a34a')
      .attr('stroke-width', 1);
    todayBadge.append('text')
      .attr('x', 0)
      .attr('y', 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#14532d')
      .attr('font-size', '8.5px')
      .attr('font-weight', '800')
      .text(`D${currentCropDay} NOW`);
  }

  // Axes
  // X Axis Ticks (D0, D20, D40, D60, D80, D100, D120, D124)
  const keyDays = [0, 20, 40, 60, 80, 100, 120, 124];
  const xAxisGroup = svg.append('g')
    .attr('transform', `translate(0, ${height - margin.bottom})`);

  xAxisGroup.append('line')
    .attr('x1', margin.left)
    .attr('x2', width - margin.right)
    .attr('y1', 0).attr('y2', 0)
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', 1);

  for (const day of keyDays) {
    const item = series[day];
    if (!item) continue;
    const x = xScale(day);
    const tickG = xAxisGroup.append('g')
      .attr('transform', `translate(${x}, 0)`);

    tickG.append('line')
      .attr('y1', 0).attr('y2', 5)
      .attr('stroke', '#64748b');

    tickG.append('text')
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('fill', day === 60 || day === 88 ? '#9f1239' : '#1e293b')
      .attr('font-size', '10px')
      .attr('font-weight', day === 60 ? '800' : '650')
      .text(`D${day}`);

    tickG.append('text')
      .attr('y', 27)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', '8.5px')
      .text(item.shortDate);
  }

  // Y Axis
  const yAxisGroup = svg.append('g')
    .attr('transform', `translate(${margin.left}, 0)`);

  yAxisGroup.append('line')
    .attr('x1', 0).attr('x2', 0)
    .attr('y1', margin.top).attr('y2', height - margin.bottom)
    .attr('stroke', '#94a3b8');

  for (const t of [18, 20, 24, 27, 30, 34]) {
    if (t < minY || t > maxY) continue;
    const y = yScale(t);
    const yTick = yAxisGroup.append('g')
      .attr('transform', `translate(0, ${y})`);

    yTick.append('line')
      .attr('x1', -4).attr('x2', 0)
      .attr('stroke', '#64748b');

    yTick.append('text')
      .attr('x', -8)
      .attr('y', 3.5)
      .attr('text-anchor', 'end')
      .attr('fill', t === 24 ? '#b91c1c' : t === 27 ? '#b45309' : '#334155')
      .attr('font-size', '10px')
      .attr('font-weight', t === 24 || t === 27 ? '800' : '500')
      .text(`${t}°C`);
  }

  // INTERACTIVE CROSSHAIR & TOOLTIP
  const crosshairGroup = svg.append('g')
    .attr('class', 'chart-crosshair')
    .style('display', 'none');

  const crosshairLine = crosshairGroup.append('line')
    .attr('y1', margin.top)
    .attr('y2', height - margin.bottom)
    .attr('stroke', '#0f172a')
    .attr('stroke-width', 1.2)
    .attr('stroke-dasharray', '3,3');

  const meanFocus = crosshairGroup.append('circle')
    .attr('r', 5)
    .attr('fill', '#1d4ed8')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 2);

  const minFocus = crosshairGroup.append('circle')
    .attr('r', 5)
    .attr('fill', '#0d9488')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 2);

  const tooltipElement = document.getElementById('chart-tooltip');

  // Overlay rect to capture pointer events
  svg.append('rect')
    .attr('class', 'chart-overlay')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', width - margin.left - margin.right)
    .attr('height', height - margin.top - margin.bottom)
    .attr('fill', 'transparent')
    .style('cursor', 'crosshair')
    .on('pointermove', function (event) {
      const [pointerX] = d3.pointer(event);
      const rawDay = xScale.invert(pointerX);
      const day = Math.max(0, Math.min(124, Math.round(rawDay)));
      const item = series[day];
      if (!item) return;

      const cx = xScale(day);
      const cyMean = yScale(item.meanTemp);
      const cyMin = yScale(item.minTemp);

      crosshairGroup.style('display', null);
      crosshairLine.attr('x1', cx).attr('x2', cx);
      meanFocus.attr('cx', cx).attr('cy', cyMean);
      minFocus.attr('cx', cx).attr('cy', cyMin);

      if (tooltipElement) {
        tooltipElement.hidden = false;
        tooltipElement.setAttribute('aria-hidden', 'false');

        const sourceLabel = item.source === 'observed'
          ? 'Canopy Field Observation'
          : item.source === 'forecast'
            ? '3-Provider Forecast Consensus'
            : 'Solana/Tuguegarao 30-Yr Normal';

        let tgmsVerdict = '';
        if (item.inTgmsWindow) {
          if (item.minTemp < 24.0) {
            tgmsVerdict = '<div class="tooltip-alert tooltip-alert-danger">🚨 Sub-24°C: S-line male sterility breach risk! Bagged controls &amp; supervisor review mandatory.</div>';
          } else if (item.meanTemp < 27.0) {
            tgmsVerdict = '<div class="tooltip-alert tooltip-alert-warning">⚠️ Sub-27°C Daily Mean: Borderline thermal threshold. Monitor logger minimums closely.</div>';
          } else {
            tgmsVerdict = '<div class="tooltip-alert tooltip-alert-safe">✅ Safe Sterility: Minimum &ge;24°C and Daily Mean &ge;27°C.</div>';
          }
        }

        tooltipElement.innerHTML = `
          <div class="tooltip-header">
            <strong>D${item.day} · ${item.formattedDate}</strong>
            <span class="tooltip-phase">${item.phase}</span>
          </div>
          <div class="tooltip-source">${sourceLabel}</div>
          <div class="tooltip-grid">
            <div><span>Daily Mean:</span> <strong>${item.meanTemp.toFixed(1)}°C</strong> ${item.meanTemp >= 27 ? '✓' : '<span class="text-danger">&lt; 27°C</span>'}</div>
            <div><span>Minimum (Night):</span> <strong>${item.minTemp.toFixed(1)}°C</strong> ${item.minTemp >= 24 ? '✓' : '<span class="text-danger">&lt; 24°C</span>'}</div>
            <div><span>Maximum (Day):</span> <strong>${item.maxTemp.toFixed(1)}°C</strong></div>
          </div>
          ${tgmsVerdict}
        `;

        // Position tooltip relative to container
        const bounds = container.getBoundingClientRect();
        const mouseX = event.clientX - bounds.left;
        const mouseY = event.clientY - bounds.top;

        const tipWidth = 240;
        const leftPos = mouseX + 15 + tipWidth > bounds.width ? mouseX - tipWidth - 15 : mouseX + 15;
        const topPos = Math.max(10, Math.min(mouseY - 30, bounds.height - 150));

        tooltipElement.style.left = `${Math.max(10, leftPos)}px`;
        tooltipElement.style.top = `${topPos}px`;
      }
    })
    .on('pointerleave', function () {
      crosshairGroup.style('display', 'none');
      if (tooltipElement) {
        tooltipElement.hidden = true;
        tooltipElement.setAttribute('aria-hidden', 'true');
      }
    });

  container.append(svg.node());
}
