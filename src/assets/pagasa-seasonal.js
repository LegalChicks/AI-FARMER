/**
 * DOST-PAGASA Seasonal Climate Prediction Integration
 * Source: https://www.pagasa.dost.gov.ph/climate/climate-prediction/seasonal-forecast
 * Issuing Agency: DOST-PAGASA Climatology and Agrometeorology Division (CAD) / CLIMPS
 * Focus Area: Solana / Tuguegarao Synoptic Station, Cagayan Valley (Region II)
 * Target System: Mestiso 20 (M20) Hybrid Rice Seed Production Cycle (Sep 2026 – Feb 2027)
 */

export function classifyPagasaDryWetDay(rainMm) {
  if (!Number.isFinite(rainMm)) return { type: 'unknown', label: 'Indeterminate', threshold: 'N/A' };
  return rainMm >= 1.0
    ? { type: 'wet', label: 'PAGASA Wet Day', threshold: '≥ 1.0 mm' }
    : { type: 'dry', label: 'PAGASA Dry Day', threshold: '< 1.0 mm' };
}

export function getPagasaSeasonalAdvisory(cropDay, dateStr, pagasaData) {
  if (!pagasaData?.monthlyTemperature || !pagasaData?.monthlyRainfall) return null;
  const monthCode = dateStr ? dateStr.slice(0, 7) : null;
  const tempEntry = pagasaData.monthlyTemperature.find((item) => item.monthCode === monthCode || (item.month && item.month.toLowerCase().includes(getMonthName(monthCode))));
  const rainEntry = pagasaData.monthlyRainfall.find((item) => item.monthCode === monthCode || (item.month && item.month.toLowerCase().includes(getMonthName(monthCode))));

  const advisories = [];

  // 1. Amihan Cold Incursion during TGMS Sterility Audit (D60-D88)
  if (cropDay >= 60 && cropDay <= 88) {
    advisories.push({
      category: 'PAGASA-SEASONAL',
      severity: 'high',
      title: 'PAGASA SEASONAL ALERT: Amihan cold surges predicted during sensitive window',
      summary: 'DOST-PAGASA seasonal temperature forecast projects night minimums of 19.8–23.8°C for Cagayan Valley during Nov–Dec.',
      action: 'Maintain 5–7 cm paddy water depth at night to buffer panicle meristem; test pollen sterility with 1% I2-KI iodine solution daily.',
      sourceUrl: 'https://www.pagasa.dost.gov.ph/climate/climate-prediction/seasonal-forecast'
    });
  }

  // 2. High Tropical Cyclone & Heavy Monsoon Rain Risk in Early Stages
  if (cropDay >= 0 && cropDay <= 45 && rainEntry && rainEntry.condition === 'Above Normal') {
    advisories.push({
      category: 'PAGASA-CLIMATE',
      severity: 'moderate',
      title: `PAGASA SEASONAL ALERT: ${rainEntry.condition} rainfall projected (${rainEntry.percentOfNormal}% of normal)`,
      summary: `DOST-PAGASA outlook indicates ${rainEntry.forecastRainMm} mm (normal: ${rainEntry.climatologicalNormalMm} mm) with ${rainEntry.wetDaysCount} wet days.`,
      action: 'Keep drainage ditches clear; avoid fertilizer application immediately before heavy convective rain events.',
      sourceUrl: 'https://www.pagasa.dost.gov.ph/climate/climate-prediction/seasonal-forecast'
    });
  }

  return advisories;
}

function getMonthName(monthCode) {
  if (!monthCode) return '';
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const num = parseInt(monthCode.split('-')[1], 10);
  return months[num - 1] || '';
}

export function renderPagasaSeasonalForecast(container, pagasaData, activeTab = 'rainfall') {
  if (!container) return;
  if (!pagasaData) {
    container.innerHTML = `
      <div class="pagasa-card-fallback">
        <p>DOST-PAGASA Seasonal Climate Forecast is loading or unavailable. Consult official advisories at <a href="https://www.pagasa.dost.gov.ph/climate/climate-prediction/seasonal-forecast" target="_blank" rel="noopener noreferrer">PAGASA Seasonal Climate Prediction</a>.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="pagasa-forecast-card" id="pagasa-forecast-card">
      <div class="pagasa-card-header">
        <div class="pagasa-brand-block">
          <div class="pagasa-crest" aria-hidden="true">
            <svg viewBox="0 0 40 40" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="18" fill="#1e3a8a" stroke="#fbbf24" stroke-width="2"/>
              <path d="M20 6L23 15L32 16L25 22L28 31L20 26L12 31L15 22L8 16L17 15L20 6Z" fill="#fbbf24" opacity="0.9"/>
              <circle cx="20" cy="20" r="6" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.5"/>
              <path d="M14 26C16 23 24 23 26 26" stroke="#93c5fd" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <div class="pagasa-kicker-row">
              <span class="pagasa-badge mono">Official Climate Product</span>
              <span class="pagasa-sub-badge mono">DOST-PAGASA CAD / CLIMPS</span>
            </div>
            <h3 class="pagasa-title">DOST-PAGASA Seasonal Climate Forecast</h3>
            <p class="pagasa-subtitle">Climatology &amp; Agrometeorology Division · Cagayan Valley Synoptic Climatology (Sep 2026 – Feb 2027)</p>
          </div>
        </div>
        <div class="pagasa-actions-block no-print">
          <a class="pagasa-official-link" href="https://www.pagasa.dost.gov.ph/climate/climate-prediction/seasonal-forecast" target="_blank" rel="noopener noreferrer" title="Opens the official DOST-PAGASA Seasonal Forecast website in a new window">
            <span>Official PAGASA Portal</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </div>
      </div>

      <!-- Quick Climate Drivers & Key Indicators -->
      <div class="pagasa-overview-grid" aria-label="DOST-PAGASA Seasonal Summary Indicators">
        <div class="pagasa-kpi-box">
          <span class="kpi-label">Climate Driver / ENSO</span>
          <strong class="kpi-value text-amber">${pagasaData.ensoStatus?.state || 'ENSO-Neutral / La Niña Alert'}</strong>
          <small class="kpi-desc">60–70% La Niña probability late 2026</small>
        </div>
        <div class="pagasa-kpi-box">
          <span class="kpi-label">Cagayan Seasonal Rainfall</span>
          <strong class="kpi-value text-forest">Near to Above Normal</strong>
          <small class="kpi-desc">85% to 132% of 30-year normal</small>
        </div>
        <div class="pagasa-kpi-box">
          <span class="kpi-label">Amihan Sterility Threat</span>
          <strong class="kpi-value text-danger">Nov–Dec Cooling</strong>
          <small class="kpi-desc">Min temps 19.8–23.8°C (D60–D88 risk)</small>
        </div>
        <div class="pagasa-kpi-box">
          <span class="kpi-label">Rice Dry / Wet Days Ratio</span>
          <strong class="kpi-value text-slate">113 Dry / 68 Wet</strong>
          <small class="kpi-desc">&lt;1mm vs &ge;1mm rain days across cycle</small>
        </div>
        <div class="pagasa-kpi-box">
          <span class="kpi-label">Tropical Cyclones (PAR)</span>
          <strong class="kpi-value text-blue">7–11 Cyclones</strong>
          <small class="kpi-desc">Peak threat during Sep–Oct</small>
        </div>
      </div>

      <!-- Interactive Tab Controls -->
      <div class="pagasa-tab-bar no-print" role="tablist" aria-label="PAGASA Seasonal Forecast Products">
        <button type="button" role="tab" class="pagasa-tab-btn ${activeTab === 'rainfall' ? 'is-active' : ''}" id="tab-pagasa-rainfall" aria-selected="${activeTab === 'rainfall'}" aria-controls="panel-pagasa-rainfall" data-pagasa-tab="rainfall">
          <span class="tab-icon">🌧️</span> Rainfall Outlook
        </button>
        <button type="button" role="tab" class="pagasa-tab-btn ${activeTab === 'temperature' ? 'is-active' : ''}" id="tab-pagasa-temperature" aria-selected="${activeTab === 'temperature'}" aria-controls="panel-pagasa-temperature" data-pagasa-tab="temperature">
          <span class="tab-icon">🌡️</span> Temperature &amp; TGMS Risk
        </button>
        <button type="button" role="tab" class="pagasa-tab-btn ${activeTab === 'drywet' ? 'is-active' : ''}" id="tab-pagasa-drywet" aria-selected="${activeTab === 'drywet'}" aria-controls="panel-pagasa-drywet" data-pagasa-tab="drywet">
          <span class="tab-icon">🌾</span> Rice Dry / Wet Days
        </button>
        <button type="button" role="tab" class="pagasa-tab-btn ${activeTab === 'cyclones' ? 'is-active' : ''}" id="tab-pagasa-cyclones" aria-selected="${activeTab === 'cyclones'}" aria-controls="panel-pagasa-cyclones" data-pagasa-tab="cyclones">
          <span class="tab-icon">🌀</span> Tropical Cyclones
        </button>
        <button type="button" role="tab" class="pagasa-tab-btn ${activeTab === 'bulletins' ? 'is-active' : ''}" id="tab-pagasa-bulletins" aria-selected="${activeTab === 'bulletins'}" aria-controls="panel-pagasa-bulletins" data-pagasa-tab="bulletins">
          <span class="tab-icon">📑</span> Official Bulletins &amp; PDFs
        </button>
      </div>

      <!-- Tab Content Panels -->
      <div class="pagasa-tab-content">
        <!-- Panel 1: Rainfall -->
        <div role="tabpanel" id="panel-pagasa-rainfall" aria-labelledby="tab-pagasa-rainfall" class="pagasa-tab-panel ${activeTab === 'rainfall' ? 'is-active' : ''}">
          <div class="panel-header-note">
            <p><strong>PAGASA Probabilistic Rainfall Forecast:</strong> Regional projection for Cagayan Province relative to 30-year climatological normal (1991–2020). Probabilities indicate likelihood of Above Normal (&gt;120%), Near Normal (81–120%), or Below Normal (&le;80%) precipitation.</p>
          </div>
          <div class="pagasa-monthly-grid">
            ${(pagasaData.monthlyRainfall || []).map((m) => `
              <div class="pagasa-month-card">
                <div class="month-card-header">
                  <div>
                    <strong class="month-name">${m.month}</strong>
                    <span class="crop-stage-pill">${m.cropStage}</span>
                  </div>
                  <span class="rainfall-condition-pill condition-${getConditionClass(m.condition)}">${m.condition} (${m.percentOfNormal}%)</span>
                </div>
                <div class="rainfall-bar-comparison">
                  <div class="rainfall-stat-row">
                    <span>Forecast: <strong>${m.forecastRainMm} mm</strong></span>
                    <span class="text-muted">Normal: ${m.climatologicalNormalMm} mm</span>
                  </div>
                  <div class="rainfall-meter-track" title="Forecast: ${m.forecastRainMm} mm / Normal: ${m.climatologicalNormalMm} mm">
                    <div class="rainfall-meter-bar bar-forecast" style="width: ${Math.min(100, (m.forecastRainMm / 350) * 100)}%;"></div>
                    <div class="rainfall-meter-marker" style="left: ${Math.min(100, (m.climatologicalNormalMm / 350) * 100)}%;" title="Climatological Normal: ${m.climatologicalNormalMm} mm"></div>
                  </div>
                </div>
                <div class="probabilistic-split-strip">
                  <span class="prob-segment prob-above" style="flex: ${m.probabilistic?.aboveNormalPct || 33}" title="Above Normal: ${m.probabilistic?.aboveNormalPct}%">A: ${m.probabilistic?.aboveNormalPct}%</span>
                  <span class="prob-segment prob-near" style="flex: ${m.probabilistic?.nearNormalPct || 33}" title="Near Normal: ${m.probabilistic?.nearNormalPct}%">N: ${m.probabilistic?.nearNormalPct}%</span>
                  <span class="prob-segment prob-below" style="flex: ${m.probabilistic?.belowNormalPct || 34}" title="Below Normal: ${m.probabilistic?.belowNormalPct}%">B: ${m.probabilistic?.belowNormalPct}%</span>
                </div>
                <p class="agronomic-note"><strong>Agronomic Action:</strong> ${m.agronomicGuidance}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Panel 2: Temperature & TGMS Risk -->
        <div role="tabpanel" id="panel-pagasa-temperature" aria-labelledby="tab-pagasa-temperature" class="pagasa-tab-panel ${activeTab === 'temperature' ? 'is-active' : ''}">
          <div class="panel-header-note note-warning">
            <p><strong>TGMS Sterility Vulnerability Warning:</strong> PRUP TG102 requires night temperatures &ge; 24.0°C and daily mean &ge; 27.0°C during the D60–D88 sensitive window (Nov 19 – Dec 17, 2026). PAGASA climatology projects Amihan monsoon cool nights dropping into 19.8–23.8°C range in November and December.</p>
          </div>
          <div class="pagasa-table-wrapper">
            <table class="pagasa-data-table">
              <caption>DOST-PAGASA Monthly Temperature Forecast &amp; Mestiso 20 TGMS Critical Evaluation</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Day Max (°C)</th>
                  <th scope="col">Night Min (°C)</th>
                  <th scope="col">Monthly Mean</th>
                  <th scope="col">TGMS Sterility Risk</th>
                  <th scope="col">Operational Field Safeguards</th>
                </tr>
              </thead>
              <tbody>
                ${(pagasaData.monthlyTemperature || []).map((t) => `
                  <tr class="tgms-row-${t.tgmsRiskLevel || 'safe'}">
                    <td><strong>${t.month}</strong></td>
                    <td class="mono">${t.maxRangeC}</td>
                    <td class="mono font-bold ${t.tgmsRiskLevel === 'critical' ? 'text-danger' : ''}">${t.minRangeC}</td>
                    <td class="mono">${t.meanC}°C</td>
                    <td>
                      <span class="tgms-risk-badge badge-${t.tgmsRiskLevel || 'safe'}">${t.tgmsRisk}</span>
                    </td>
                    <td class="microcopy">${t.notes}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Panel 3: Rice Dry / Wet Days -->
        <div role="tabpanel" id="panel-pagasa-drywet" aria-labelledby="tab-pagasa-drywet" class="pagasa-tab-panel ${activeTab === 'drywet' ? 'is-active' : ''}">
          <div class="panel-header-note">
            <p><strong>PAGASA Agro-Climatic Rice Production Metric:</strong> Quoting PAGASA CAD: <em>“Tailored climate information for agricultural risk management applications. Dry Day: &lt; 1.0 mm of rain; Wet Day: &ge; 1.0 mm of rain. Critical for spray timing, pollination shaking, and sun-drying of harvested seed lots.”</em></p>
          </div>
          <div class="drywet-card-grid">
            ${(pagasaData.dryWetDaysForecast || []).map((d) => `
              <div class="drywet-card">
                <div class="drywet-head">
                  <strong>${d.month}</strong>
                  <span class="mono">${d.totalDays} days</span>
                </div>
                <div class="drywet-bar-container">
                  <div class="drywet-bar bar-dry" style="width: ${d.dryDayRatioPct}%;" title="Dry days: ${d.dryDaysCount} (${d.dryDayRatioPct}%)">
                    ${d.dryDaysCount} Dry
                  </div>
                  <div class="drywet-bar bar-wet" style="width: ${d.wetDayRatioPct}%;" title="Wet days: ${d.wetDaysCount} (${d.wetDayRatioPct}%)">
                    ${d.wetDaysCount} Wet
                  </div>
                </div>
                <div class="drywet-legend-sub">
                  <span class="sub-item"><span class="dot dot-dry"></span>&lt; 1 mm: ${d.dryDayRatioPct}%</span>
                  <span class="sub-item"><span class="dot dot-wet"></span>&ge; 1 mm: ${d.wetDayRatioPct}%</span>
                </div>
                <p class="drywet-guidance"><strong>Rice Operation Window:</strong> ${d.riceAgriGuidance}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Panel 4: Tropical Cyclones -->
        <div role="tabpanel" id="panel-pagasa-cyclones" aria-labelledby="tab-pagasa-cyclones" class="pagasa-tab-panel ${activeTab === 'cyclones' ? 'is-active' : ''}">
          <div class="panel-header-note">
            <p><strong>PAGASA Tropical Cyclone Frequency &amp; Track Climatology:</strong> Expected number of tropical cyclones entering or developing within the Philippine Area of Responsibility (PAR) and evaluated landfall threat to Cagayan Province / Region II.</p>
          </div>
          <div class="cyclone-cards-grid">
            ${(pagasaData.tropicalCycloneOutlook || []).map((c) => `
              <div class="cyclone-card threat-${c.threatLevel || 'low'}">
                <div class="cyclone-card-head">
                  <strong>${c.month}</strong>
                  <span class="threat-pill threat-${c.threatLevel || 'low'}">Cagayan Threat: ${c.cagayanThreat}</span>
                </div>
                <div class="cyclone-stat">
                  <span class="cyclone-icon" aria-hidden="true">🌀</span>
                  <span class="cyclone-range mono">${c.expectedParRange}</span>
                </div>
                <p class="cyclone-track"><strong>Climatological Track:</strong> ${c.tracks}</p>
                <p class="cyclone-precaution"><strong>Farm Precaution:</strong> ${c.precaution}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Panel 5: Bulletins & Publications -->
        <div role="tabpanel" id="panel-pagasa-bulletins" aria-labelledby="tab-pagasa-bulletins" class="pagasa-tab-panel ${activeTab === 'bulletins' ? 'is-active' : ''}">
          <div class="panel-header-note">
            <p><strong>Official DOST-PAGASA Publications &amp; Direct Resources:</strong> Direct reference documents, seasonal climate outlook bulletins, probabilistic maps, and national climate forum presentations issued by CAD/CLIMPS.</p>
          </div>
          <div class="bulletins-grid">
            ${(pagasaData.bulletins || []).map((b) => `
              <div class="bulletin-card">
                <div class="bulletin-top">
                  <span class="bulletin-type mono">${b.type}</span>
                  <span class="bulletin-badge mono">${b.badge}</span>
                </div>
                <h4 class="bulletin-title">${b.title}</h4>
                <p class="bulletin-desc">${b.description}</p>
                <div class="bulletin-action">
                  <a href="${b.url}" target="_blank" rel="noopener noreferrer" class="bulletin-link">
                    <span>View on DOST-PAGASA</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="pagasa-citation-box">
            <p class="mono text-xs">
              Citation: DOST-PAGASA (2026). Seasonal Climate Forecast &amp; Climatology and Agrometeorology Division (CAD) Agro-Climatic Advisory. Philippine Atmospheric, Geophysical and Astronomical Services Administration, Quezon City, Philippines. Retrieved from <a href="https://www.pagasa.dost.gov.ph/climate/climate-prediction/seasonal-forecast" target="_blank" rel="noopener noreferrer">https://www.pagasa.dost.gov.ph/climate/climate-prediction/seasonal-forecast</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  attachPagasaTabListeners(container, pagasaData);
}

function getConditionClass(condition) {
  if (/above/i.test(condition)) return 'above';
  if (/below/i.test(condition)) return 'below';
  return 'near';
}

function attachPagasaTabListeners(container, pagasaData) {
  const tabs = container.querySelectorAll('[data-pagasa-tab]');
  tabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const selected = tab.getAttribute('data-pagasa-tab');
      renderPagasaSeasonalForecast(container, pagasaData, selected);
    });
  });
}
