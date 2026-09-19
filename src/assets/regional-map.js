/**
 * Lingan-Agronomist Mestiso 20 Operations
 * D3.js Regional Weather Hotspots & Farm Coordinate Map
 *
 * Visualizes the Solana (Lanna) farm coordinate in the Cagayan River basin,
 * alongside regional meteorological hotspots that impact Mestiso 20
 * two-line hybrid seed production across its 125-day phenological cycle.
 */

export const FARM_COORDINATE = Object.freeze({
  id: 'lanna-farm',
  name: 'Lanna Seed Farm (Field Base)',
  barangay: 'Lanna',
  municipality: 'Solana',
  province: 'Cagayan',
  latitude: 17.6934,
  longitude: 121.7010,
  elevationM: 22,
  label: 'Lanna Farm (17.6934° N, 121.7010° E)',
  cropRole: 'M20 PRUP TG102 × TG102M Seed Production Block (8:2 S:P)',
  details: 'Primary 8:2 row-ratio seed production field with automated irrigation intake, canopy microclimate station, and field telemetry logger.'
});

export const REGIONAL_HOTSPOTS = Object.freeze([
  {
    id: 'cordillera-cold-drainage',
    name: 'Cordillera Katabatic Cold Drainage',
    shortName: 'Cordillera Cold Drainage',
    category: 'thermal',
    type: 'cold',
    coordinates: [121.46, 17.65],
    latitude: 17.65,
    longitude: 121.46,
    criticalPhase: 'D60–D88 TGMS Sterility Induction',
    threshold: 'Canopy Tmin < 24.0°C',
    hazard: 'Nighttime cold air drainage descending the Chico River valley into Solana lowlands, risking male sterility reversion in female S-line.',
    mitigation: 'Maintain 10–15 cm warm floodwater buffer at sunset to insulate the rice canopy; verify bagged check panicles.',
    simKey: 'sim-tgms-cold',
    severity: 'critical',
    color: '#0284c7'
  },
  {
    id: 'amihan-monsoon-corridor',
    name: 'Sierra Madre / Baggao Amihan Gap',
    shortName: 'Baggao Amihan Gap',
    category: 'thermal',
    type: 'cloud-cold',
    coordinates: [121.88, 17.92],
    latitude: 17.92,
    longitude: 121.88,
    criticalPhase: 'D60–D90 Tillering to Heading',
    threshold: 'Solar rad < 12 MJ/m², prolonged cloud cover',
    hazard: 'Northeast monsoon marine surge penetrates through northern mountain saddle, causing prolonged low light and suppressing panicle temperatures.',
    mitigation: 'Monitor tillering rates and heading synchrony; delay foliar nitrogen if cloud cover exceeds 4 consecutive days.',
    simKey: 'sim-tgms-cold',
    severity: 'high',
    color: '#6366f1'
  },
  {
    id: 'tuguegarao-valley-heat-dome',
    name: 'Tuguegarao / Solana Thermal Trough',
    shortName: 'Valley Heat Trough',
    category: 'thermal',
    type: 'heat',
    coordinates: [121.73, 17.61],
    latitude: 17.61,
    longitude: 121.73,
    criticalPhase: 'D85–D105 Flowering & Grain Fill',
    threshold: 'Daylight Tmax ≥ 36.5°C',
    hazard: 'Alluvial valley basin traps intense radiant heat, causing afternoon spike temperatures that desiccate floret anthers and reduce pollen viability.',
    mitigation: 'Execute supplementary pollination (rope pulling) before 10:30 AM before peak heat; maintain continuous paddy circulation.',
    simKey: 'sim-heat-stress',
    severity: 'high',
    color: '#ea580c'
  },
  {
    id: 'alcala-river-wind-funnel',
    name: 'Babuyan Channel / Alcala Wind Corridor',
    shortName: 'River Wind Corridor',
    category: 'wind',
    type: 'wind',
    coordinates: [121.66, 17.98],
    latitude: 17.98,
    longitude: 121.66,
    criticalPhase: 'D80–D100 GA₃ Spraying & Pollination',
    threshold: 'Sustained wind > 15 km/h, Gusts > 25 km/h',
    hazard: 'Topographic funneling down the Cagayan River channel accelerates northerly winds, causing severe foliar spray drift and panicle entanglement.',
    mitigation: 'Halt all boom and knapsack chemical applications; adjust rope pulling angle with the wind; postpone second GA₃ split.',
    simKey: 'sim-wind-gust',
    severity: 'critical',
    color: '#0f766e'
  },
  {
    id: 'sierra-madre-rain-squall',
    name: 'Eastern Sierra Madre Convective Squall Line',
    shortName: 'Sierra Rain Squalls',
    category: 'rain',
    type: 'rain',
    coordinates: [121.96, 17.68],
    latitude: 17.68,
    longitude: 121.96,
    criticalPhase: 'D85–D95 Peak Anthesis (9:00–11:30 AM)',
    threshold: 'Precipitation > 1.0 mm/h during flowering',
    hazard: 'Orographic morning showers drift west across the ridge into the Solana plain, washing shedding pollen grains off S-line stigmas.',
    mitigation: 'Immediately stop rope pulling; wait 30 minutes after rain ceases and inspect glume opening before resuming passes.',
    simKey: 'sim-anthesis-rain',
    severity: 'critical',
    color: '#be123c'
  },
  {
    id: 'upper-cagayan-basin-runoff',
    name: 'Upper Cagayan / Magat River Basin Hydrology',
    shortName: 'Upper Basin Hydrology',
    category: 'rain',
    type: 'flood',
    coordinates: [121.66, 17.34],
    latitude: 17.34,
    longitude: 121.66,
    criticalPhase: 'D110–D124 Ripening & Seed Harvest',
    threshold: 'Paddy water depth > 20 cm in harvest window',
    hazard: 'Heavy precipitation in upstream Isabela/Nueva Vizcaya watershed elevates Cagayan River stage, hindering paddy drainage before harvest.',
    mitigation: 'Open perimeter drainage flumes; deploy mobile dewatering pumps; prioritize early harvest of highest-purity seed blocks.',
    simKey: null,
    severity: 'moderate',
    color: '#475569'
  }
]);

/**
 * Calculates great-circle distance between two coordinates in kilometers using Haversine formula.
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Calculates 16-point compass bearing from origin to target.
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const compass = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(brng / 22.5) % 16;
  return compass[index];
}

/**
 * Returns distance and bearing label relative to Lanna Farm.
 */
export function getRelativePositionToLanna(lat, lon) {
  const dist = haversineDistanceKm(FARM_COORDINATE.latitude, FARM_COORDINATE.longitude, lat, lon);
  const bearing = calculateBearing(FARM_COORDINATE.latitude, FARM_COORDINATE.longitude, lat, lon);
  return {
    distanceKm: dist,
    bearing,
    label: `${dist} km ${bearing}`
  };
}

/**
 * Filters hotspots by category ('all', 'thermal', 'wind', 'rain').
 */
export function filterHotspots(hotspots, category) {
  if (!category || category === 'all') return [...hotspots];
  return hotspots.filter((h) => h.category === category);
}

/**
 * Evaluates whether a hotspot is currently active based on simulator key or live condition.
 */
export function isHotspotAlertActive(hotspot, alertMode, liveAlerts = []) {
  if (alertMode && alertMode !== 'live') {
    return hotspot.simKey === alertMode;
  }
  if (Array.isArray(liveAlerts) && liveAlerts.length > 0) {
    if (hotspot.category === 'thermal' && liveAlerts.some((a) => a.category === 'TGMS' || a.category === 'Temperature')) {
      return true;
    }
    if (hotspot.category === 'wind' && liveAlerts.some((a) => a.category === 'Wind' || a.category === 'Spray')) {
      return true;
    }
    if (hotspot.category === 'rain' && liveAlerts.some((a) => a.category === 'Rain' || a.category === 'Precipitation')) {
      return true;
    }
  }
  return false;
}

/**
 * Geographic features for Cagayan Valley / Northern Luzon basin.
 * GeoJSON representation for D3 projections.
 */
export const CAGAYAN_VALLEY_GEOJSON = Object.freeze({
  type: 'FeatureCollection',
  features: [
    // Cagayan Valley Lowland Alluvial Plain
    {
      type: 'Feature',
      properties: { name: 'Cagayan Alluvial Basin', kind: 'valley' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [121.36, 18.32],
          [121.52, 18.30],
          [121.72, 18.25],
          [121.84, 18.05],
          [121.82, 17.80],
          [121.86, 17.55],
          [121.82, 17.30],
          [121.55, 17.30],
          [121.50, 17.50],
          [121.46, 17.75],
          [121.38, 18.00],
          [121.36, 18.32]
        ]]
      }
    },
    // Western Highlands (Cordillera Central Range)
    {
      type: 'Feature',
      properties: { name: 'Cordillera Central Range', kind: 'mountain-west' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [121.18, 18.35],
          [121.36, 18.32],
          [121.38, 18.00],
          [121.46, 17.75],
          [121.50, 17.50],
          [121.55, 17.30],
          [121.18, 17.30],
          [121.18, 18.35]
        ]]
      }
    },
    // Eastern Highlands (Sierra Madre Mountain Range)
    {
      type: 'Feature',
      properties: { name: 'Sierra Madre Range', kind: 'mountain-east' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [121.84, 18.05],
          [122.18, 18.35],
          [122.20, 17.30],
          [121.82, 17.30],
          [121.86, 17.55],
          [121.82, 17.80],
          [121.84, 18.05]
        ]]
      }
    },
    // Babuyan Channel / Coastal Sea (Northern Edge)
    {
      type: 'Feature',
      properties: { name: 'Babuyan Channel', kind: 'water-sea' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [121.18, 18.35],
          [122.20, 18.35],
          [122.20, 18.42],
          [121.18, 18.42],
          [121.18, 18.35]
        ]]
      }
    },
    // Cagayan River (Rio Grande de Cagayan) Main Course
    {
      type: 'Feature',
      properties: { name: 'Cagayan River', kind: 'river-main' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [121.72, 17.30],
          [121.75, 17.42],
          [121.74, 17.55],
          [121.725, 17.62], // Tuguegarao
          [121.712, 17.68], // Near Solana
          [121.715, 17.75],
          [121.70, 17.84],  // Amulung
          [121.66, 17.92],  // Alcala
          [121.65, 18.06],  // Gattaran
          [121.67, 18.20],  // Lal-lo
          [121.68, 18.28],  // Camalaniugan
          [121.64, 18.36]   // Aparri estuary
        ]
      }
    },
    // Chico River (Kalinga to Solana confluence)
    {
      type: 'Feature',
      properties: { name: 'Chico River', kind: 'river-tributary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [121.32, 17.48],
          [121.44, 17.58],
          [121.56, 17.65],
          [121.695, 17.69] // Confluence with Cagayan River at Solana
        ]
      }
    },
    // Pinacanauan River (Sierra Madre to Tuguegarao)
    {
      type: 'Feature',
      properties: { name: 'Pinacanauan River', kind: 'river-tributary' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [121.92, 17.80],
          [121.84, 17.70],
          [121.73, 17.625]
        ]
      }
    }
  ]
});

/**
 * Renders the D3 regional map inside the target container.
 *
 * @param {HTMLElement|string} container - Container element or ID
 * @param {Array} hotspots - Array of hotspot objects
 * @param {Object} options - Configuration options (activeCategory, alertMode, liveAlerts, onSelectHotspot)
 */
export function renderRegionalD3Map(container, hotspots = REGIONAL_HOTSPOTS, options = {}) {
  const d3 = globalThis.d3;
  if (!d3) return;

  const target = typeof container === 'string' ? document.getElementById(container) : container;
  if (!target) return;

  target.textContent = '';

  const {
    activeCategory = 'all',
    alertMode = 'live',
    liveAlerts = [],
    selectedHotspotId = null,
    onSelectHotspot = null
  } = options;

  const filteredHotspots = filterHotspots(hotspots, activeCategory);

  const containerRect = target.getBoundingClientRect();
  const width = Math.max(containerRect.width || 320, 300);
  const height = 230;

  // Setup D3 Mercator Projection centered on Solana / Cagayan Basin
  // Solana / Lanna: [121.7010, 17.6934]
  const projection = d3.geoMercator()
    .center([121.70, 17.78])
    .scale(width * 38)
    .translate([width / 2, height / 2]);

  const pathGenerator = d3.geoPath().projection(projection);

  const svg = d3.select(target)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Regional weather map showing Lanna Farm coordinate and crop hazard hotspots in Cagayan Valley')
    .style('overflow', 'hidden')
    .style('border-radius', '0.4rem')
    .style('background', '#f8fafc');

  // Defs for gradients, patterns, and filters
  const defs = svg.append('defs');

  // Pulse animation style for active alert hotspots
  const style = defs.append('style');
  style.text(`
    @keyframes map-beacon {
      0% { r: 6; opacity: 0.9; }
      50% { r: 16; opacity: 0.3; }
      100% { r: 24; opacity: 0; }
    }
    @keyframes hotspot-pulse {
      0% { r: 5; opacity: 0.85; }
      50% { r: 13; opacity: 0.35; }
      100% { r: 20; opacity: 0; }
    }
    .map-beacon-ring {
      animation: map-beacon 2s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
      transform-origin: center;
    }
    .hotspot-pulse-ring {
      animation: hotspot-pulse 1.8s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
      transform-origin: center;
    }
  `);

  // Subtle terrain pattern for mountain ranges
  const mountainPattern = defs.append('pattern')
    .attr('id', 'mountain-hatch')
    .attr('width', 8)
    .attr('height', 8)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('patternTransform', 'rotate(45)');
  mountainPattern.append('line')
    .attr('x1', 0).attr('y1', 0)
    .attr('x2', 0).attr('y2', 8)
    .attr('stroke', '#cbd5e1')
    .attr('stroke-width', 1.2);

  // Map layer groups
  const gBase = svg.append('g').attr('class', 'map-layer-base');
  const gRivers = svg.append('g').attr('class', 'map-layer-rivers');
  const gLabels = svg.append('g').attr('class', 'map-layer-terrain-labels');
  const gZones = svg.append('g').attr('class', 'map-layer-hazard-zones');
  const gHotspots = svg.append('g').attr('class', 'map-layer-hotspots');
  const gFarm = svg.append('g').attr('class', 'map-layer-farm');
  const gUi = svg.append('g').attr('class', 'map-layer-ui');

  // 1. Base Terrain Polygons
  for (const feature of CAGAYAN_VALLEY_GEOJSON.features) {
    if (feature.geometry.type === 'Polygon') {
      const isValley = feature.properties.kind === 'valley';
      const isWest = feature.properties.kind === 'mountain-west';
      const isEast = feature.properties.kind === 'mountain-east';
      const isSea = feature.properties.kind === 'water-sea';

      let fill = '#f1f5f9';
      let stroke = '#e2e8f0';

      if (isValley) {
        fill = '#f0fdf4'; // Light agricultural alluvial green tint
        stroke = '#bbf7d0';
      } else if (isWest || isEast) {
        fill = '#f8fafc';
        stroke = '#cbd5e1';
      } else if (isSea) {
        fill = '#e0f2fe';
        stroke = '#bae6fd';
      }

      const p = gBase.append('path')
        .datum(feature)
        .attr('d', pathGenerator)
        .attr('fill', fill)
        .attr('stroke', stroke)
        .attr('stroke-width', 1);

      if (isWest || isEast) {
        // Overlay texture for mountains
        gBase.append('path')
          .datum(feature)
          .attr('d', pathGenerator)
          .attr('fill', 'url(#mountain-hatch)')
          .attr('opacity', 0.45);
      }
    }
  }

  // 2. River paths
  for (const feature of CAGAYAN_VALLEY_GEOJSON.features) {
    if (feature.geometry.type === 'LineString') {
      const isMain = feature.properties.kind === 'river-main';
      gRivers.append('path')
        .datum(feature)
        .attr('d', pathGenerator)
        .attr('fill', 'none')
        .attr('stroke', '#60a5fa')
        .attr('stroke-width', isMain ? 2.5 : 1.6)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('opacity', 0.85);
    }
  }

  // 3. Topographic Water & Valley Labels
  const terrainLabels = [
    { text: 'CORDILLERA', x: 28, y: 45, angle: -15 },
    { text: 'CENTRAL', x: 34, y: 58, angle: -15 },
    { text: 'SIERRA MADRE', x: width - 75, y: 65, angle: 25 },
    { text: 'RIDGE', x: width - 60, y: 78, angle: 25 },
    { text: 'BABUYAN SEA', x: width / 2, y: 15, angle: 0 },
    { text: 'Cagayan River', x: width / 2 + 10, y: 175, angle: 0, river: true }
  ];

  for (const lbl of terrainLabels) {
    gLabels.append('text')
      .attr('x', lbl.x)
      .attr('y', lbl.y)
      .attr('transform', lbl.angle ? `rotate(${lbl.angle}, ${lbl.x}, ${lbl.y})` : null)
      .attr('fill', lbl.river ? '#3b82f6' : '#94a3b8')
      .attr('font-size', lbl.river ? '8px' : '7.5px')
      .attr('font-weight', lbl.river ? '600' : '800')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
      .attr('letter-spacing', '0.08em')
      .attr('text-anchor', 'middle')
      .attr('opacity', lbl.river ? 0.75 : 0.6)
      .text(lbl.text);
  }

  // Tooltip element selection
  const tooltip = d3.select('#map-tooltip');

  const showTooltip = (event, title, metaLines = [], statusPill = null) => {
    if (tooltip.empty()) return;

    let html = `
      <div class="map-tooltip-card">
        <div class="map-tooltip-head">
          <strong>${title}</strong>
          ${statusPill ? `<span class="map-tooltip-pill ${statusPill.cls}">${statusPill.text}</span>` : ''}
        </div>
        <div class="map-tooltip-body">
    `;

    for (const line of metaLines) {
      html += `
        <div class="map-tooltip-row">
          <span class="map-tooltip-label">${line.label}:</span>
          <span class="map-tooltip-val ${line.accent ? 'map-text-accent' : ''}">${line.value}</span>
        </div>
      `;
    }

    html += `</div></div>`;

    tooltip
      .html(html)
      .attr('hidden', null)
      .style('opacity', 1);

    // Compute relative positioning inside map container
    const containerNode = target.closest('.regional-map-container') || target;
    const box = containerNode.getBoundingClientRect();
    const mouseX = event.clientX - box.left;
    const mouseY = event.clientY - box.top;

    const left = Math.min(Math.max(mouseX + 12, 10), box.width - 240);
    const top = Math.min(Math.max(mouseY - 30, 10), box.height - 110);

    tooltip
      .style('left', `${left}px`)
      .style('top', `${top}px`);
  };

  const hideTooltip = () => {
    if (tooltip.empty()) return;
    tooltip.style('opacity', 0).attr('hidden', true);
  };

  // 4. Regional Hotspots Rendering
  for (const hotspot of filteredHotspots) {
    const [hx, hy] = projection(hotspot.coordinates);
    if (!hx || !hy) continue;

    const isActive = isHotspotAlertActive(hotspot, alertMode, liveAlerts);
    const isSelected = selectedHotspotId === hotspot.id;
    const rel = getRelativePositionToLanna(hotspot.latitude, hotspot.longitude);

    const gH = gHotspots.append('g')
      .attr('class', `map-hotspot-group ${isActive ? 'is-active' : ''} ${isSelected ? 'is-selected' : ''}`)
      .attr('tabindex', '0')
      .attr('role', 'button')
      .attr('aria-label', `${hotspot.name}: ${hotspot.hazard} (${rel.label})`)
      .style('cursor', 'pointer');

    // Risk perimeter radius circle
    gH.append('circle')
      .attr('cx', hx)
      .attr('cy', hy)
      .attr('r', isActive ? 16 : 11)
      .attr('fill', hotspot.color)
      .attr('fill-opacity', isActive ? 0.22 : 0.1)
      .attr('stroke', hotspot.color)
      .attr('stroke-width', isActive ? 1.5 : 1)
      .attr('stroke-dasharray', isActive ? '2,2' : 'none');

    // Pulsing halo if active
    if (isActive) {
      gH.append('circle')
        .attr('cx', hx)
        .attr('cy', hy)
        .attr('class', 'hotspot-pulse-ring')
        .attr('fill', 'none')
        .attr('stroke', hotspot.color)
        .attr('stroke-width', 2);
    }

    // Hotspot central marker point
    gH.append('circle')
      .attr('cx', hx)
      .attr('cy', hy)
      .attr('r', isActive ? 5.5 : 4)
      .attr('fill', hotspot.color)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5);

    // Hotspot short label
    gH.append('text')
      .attr('x', hx)
      .attr('y', hy + (hy > height - 30 ? -10 : 12))
      .attr('text-anchor', 'middle')
      .attr('fill', '#1e293b')
      .attr('font-size', '8px')
      .attr('font-weight', '700')
      .attr('font-family', 'system-ui, sans-serif')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2.5)
      .attr('paint-order', 'stroke')
      .text(hotspot.shortName);

    // Event handlers
    gH.on('mouseenter', (e) => {
      showTooltip(
        e,
        hotspot.name,
        [
          { label: 'Distance', value: `${rel.distanceKm} km ${rel.bearing} of Lanna` },
          { label: 'M20 Phase', value: hotspot.criticalPhase },
          { label: 'Threshold', value: hotspot.threshold, accent: true },
          { label: 'Risk & Hazard', value: hotspot.hazard },
          { label: 'Remedial Action', value: hotspot.mitigation }
        ],
        isActive
          ? { text: 'ACTIVE THREAT', cls: 'pill-danger' }
          : { text: hotspot.severity.toUpperCase(), cls: `pill-${hotspot.severity}` }
      );
    })
    .on('mousemove', (e) => {
      showTooltip(
        e,
        hotspot.name,
        [
          { label: 'Distance', value: `${rel.distanceKm} km ${rel.bearing} of Lanna` },
          { label: 'M20 Phase', value: hotspot.criticalPhase },
          { label: 'Threshold', value: hotspot.threshold, accent: true },
          { label: 'Risk & Hazard', value: hotspot.hazard },
          { label: 'Remedial Action', value: hotspot.mitigation }
        ],
        isActive
          ? { text: 'ACTIVE THREAT', cls: 'pill-danger' }
          : { text: hotspot.severity.toUpperCase(), cls: `pill-${hotspot.severity}` }
      );
    })
    .on('mouseleave', hideTooltip)
    .on('focus', (e) => {
      showTooltip(
        e,
        hotspot.name,
        [
          { label: 'Distance', value: `${rel.distanceKm} km ${rel.bearing} of Lanna` },
          { label: 'M20 Phase', value: hotspot.criticalPhase },
          { label: 'Threshold', value: hotspot.threshold, accent: true },
          { label: 'Risk & Hazard', value: hotspot.hazard },
          { label: 'Remedial Action', value: hotspot.mitigation }
        ],
        isActive
          ? { text: 'ACTIVE THREAT', cls: 'pill-danger' }
          : { text: hotspot.severity.toUpperCase(), cls: `pill-${hotspot.severity}` }
      );
    })
    .on('blur', hideTooltip)
    .on('click', () => {
      if (typeof onSelectHotspot === 'function') {
        onSelectHotspot(hotspot);
      }
    });
  }

  // 5. Lanna Farm Coordinate Base Marker
  const [fx, fy] = projection([FARM_COORDINATE.longitude, FARM_COORDINATE.latitude]);
  if (fx && fy) {
    const gF = gFarm.append('g')
      .attr('class', 'map-farm-base')
      .attr('tabindex', '0')
      .attr('role', 'button')
      .attr('aria-label', `${FARM_COORDINATE.name}: ${FARM_COORDINATE.label}`)
      .style('cursor', 'pointer');

    // Concentric pulsing radar beacon
    gF.append('circle')
      .attr('cx', fx)
      .attr('cy', fy)
      .attr('class', 'map-beacon-ring')
      .attr('fill', 'none')
      .attr('stroke', '#16a34a')
      .attr('stroke-width', 2.5);

    // Static radar boundary ring
    gF.append('circle')
      .attr('cx', fx)
      .attr('cy', fy)
      .attr('r', 12)
      .attr('fill', '#16a34a')
      .attr('fill-opacity', 0.18)
      .attr('stroke', '#15803d')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '3,2');

    // Diamond / Pin Base
    gF.append('circle')
      .attr('cx', fx)
      .attr('cy', fy)
      .attr('r', 5.5)
      .attr('fill', '#15803d')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    // Inner bright gold core
    gF.append('circle')
      .attr('cx', fx)
      .attr('cy', fy)
      .attr('r', 2)
      .attr('fill', '#facc15');

    // Distinctive label tag
    const farmLabelG = gF.append('g').attr('transform', `translate(${fx + 10}, ${fy - 6})`);
    
    farmLabelG.append('rect')
      .attr('x', -2)
      .attr('y', -10)
      .attr('width', 96)
      .attr('height', 17)
      .attr('rx', 3)
      .attr('fill', '#14532d')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.2);

    farmLabelG.append('text')
      .attr('x', 4)
      .attr('y', 2)
      .attr('fill', '#ffffff')
      .attr('font-size', '8.5px')
      .attr('font-weight', '800')
      .attr('font-family', 'system-ui, sans-serif')
      .text('LANNA FARM BASE');

    // Event handlers for Lanna Farm
    gF.on('mouseenter', (e) => {
      showTooltip(
        e,
        FARM_COORDINATE.name,
        [
          { label: 'Coordinates', value: '17.6934° N, 121.7010° E' },
          { label: 'Location', value: 'Barangay Lanna, Solana, Cagayan' },
          { label: 'Elevation', value: '22 m ASL (Alluvial Plain)' },
          { label: 'Crop Configuration', value: 'NSIC Rc204H (Mestiso 20) 8:2 row ratio' },
          { label: 'Canopy Monitoring', value: 'On-farm microclimate station & automated logger' }
        ],
        { text: 'FIELD BASE', cls: 'pill-safe' }
      );
    })
    .on('mousemove', (e) => {
      showTooltip(
        e,
        FARM_COORDINATE.name,
        [
          { label: 'Coordinates', value: '17.6934° N, 121.7010° E' },
          { label: 'Location', value: 'Barangay Lanna, Solana, Cagayan' },
          { label: 'Elevation', value: '22 m ASL (Alluvial Plain)' },
          { label: 'Crop Configuration', value: 'NSIC Rc204H (Mestiso 20) 8:2 row ratio' },
          { label: 'Canopy Monitoring', value: 'On-farm microclimate station & automated logger' }
        ],
        { text: 'FIELD BASE', cls: 'pill-safe' }
      );
    })
    .on('mouseleave', hideTooltip)
    .on('focus', (e) => {
      showTooltip(
        e,
        FARM_COORDINATE.name,
        [
          { label: 'Coordinates', value: '17.6934° N, 121.7010° E' },
          { label: 'Location', value: 'Barangay Lanna, Solana, Cagayan' },
          { label: 'Elevation', value: '22 m ASL (Alluvial Plain)' },
          { label: 'Crop Configuration', value: 'NSIC Rc204H (Mestiso 20) 8:2 row ratio' },
          { label: 'Canopy Monitoring', value: 'On-farm microclimate station & automated logger' }
        ],
        { text: 'FIELD BASE', cls: 'pill-safe' }
      );
    })
    .on('blur', hideTooltip);
  }

  // 6. Cardinal Compass & Distance Scale Overlay
  const compassX = 22;
  const compassY = height - 22;

  const gCompass = gUi.append('g').attr('transform', `translate(${compassX}, ${compassY})`);
  gCompass.append('circle')
    .attr('r', 10)
    .attr('fill', '#ffffff')
    .attr('stroke', '#cbd5e1')
    .attr('stroke-width', 1);

  // Compass North Arrow
  gCompass.append('path')
    .attr('d', 'M 0 -8 L 3 0 L 0 -1 L -3 0 Z')
    .attr('fill', '#dc2626');
  gCompass.append('path')
    .attr('d', 'M 0 8 L 3 0 L 0 1 L -3 0 Z')
    .attr('fill', '#94a3b8');
  gCompass.append('text')
    .attr('x', 0)
    .attr('y', -10)
    .attr('text-anchor', 'middle')
    .attr('font-size', '6.5px')
    .attr('font-weight', '900')
    .attr('fill', '#dc2626')
    .attr('font-family', 'ui-monospace, monospace')
    .text('N');

  // Scale bar: 20 km representation
  // 1 degree lat ≈ 111 km. 20 km is ~0.18 degrees.
  const p0 = projection([121.7, 17.35]);
  const p1 = projection([121.7, 17.53]); // ~20 km north
  const scaleLen = Math.abs(p0[1] - p1[1]);

  const gScale = gUi.append('g').attr('transform', `translate(${width - 65}, ${height - 14})`);
  gScale.append('line')
    .attr('x1', 0).attr('y1', 0)
    .attr('x2', scaleLen).attr('y2', 0)
    .attr('stroke', '#475569')
    .attr('stroke-width', 2);
  gScale.append('line')
    .attr('x1', 0).attr('y1', -3)
    .attr('x2', 0).attr('y2', 3)
    .attr('stroke', '#475569')
    .attr('stroke-width', 1.5);
  gScale.append('line')
    .attr('x1', scaleLen).attr('y1', -3)
    .attr('x2', scaleLen).attr('y2', 3)
    .attr('stroke', '#475569')
    .attr('stroke-width', 1.5);
  gScale.append('text')
    .attr('x', scaleLen / 2)
    .attr('y', -4)
    .attr('text-anchor', 'middle')
    .attr('font-size', '7px')
    .attr('font-weight', '750')
    .attr('fill', '#475569')
    .attr('font-family', 'ui-monospace, monospace')
    .text('20 km');
}
