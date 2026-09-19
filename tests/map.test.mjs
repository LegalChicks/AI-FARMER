import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FARM_COORDINATE,
  REGIONAL_HOTSPOTS,
  CAGAYAN_VALLEY_GEOJSON,
  haversineDistanceKm,
  calculateBearing,
  getRelativePositionToLanna,
  filterHotspots,
  isHotspotAlertActive
} from '../src/assets/regional-map.js';

test('defines Lanna farm coordinate accurately at Solana Cagayan', () => {
  assert.equal(FARM_COORDINATE.latitude, 17.6934);
  assert.equal(FARM_COORDINATE.longitude, 121.7010);
  assert.equal(FARM_COORDINATE.municipality, 'Solana');
  assert.equal(FARM_COORDINATE.province, 'Cagayan');
  assert.ok(FARM_COORDINATE.name.includes('Lanna'));
  assert.ok(FARM_COORDINATE.cropRole.includes('Mestiso 20') || FARM_COORDINATE.cropRole.includes('M20'));
});

test('defines critical regional weather hotspots affecting M20 production cycle', () => {
  assert.ok(REGIONAL_HOTSPOTS.length >= 5);

  const coldHotspot = REGIONAL_HOTSPOTS.find((h) => h.id === 'cordillera-cold-drainage');
  assert.ok(coldHotspot, 'Must include Cordillera cold drainage hotspot');
  assert.equal(coldHotspot.category, 'thermal');
  assert.ok(coldHotspot.criticalPhase.includes('Sterility'));
  assert.ok(coldHotspot.threshold.includes('24'));

  const windHotspot = REGIONAL_HOTSPOTS.find((h) => h.id === 'alcala-river-wind-funnel');
  assert.ok(windHotspot, 'Must include river wind funnel hotspot');
  assert.equal(windHotspot.category, 'wind');
  assert.ok(windHotspot.criticalPhase.includes('GA₃') || windHotspot.criticalPhase.includes('Spray'));

  const rainHotspot = REGIONAL_HOTSPOTS.find((h) => h.id === 'sierra-madre-rain-squall');
  assert.ok(rainHotspot, 'Must include anthesis rain squall hotspot');
  assert.equal(rainHotspot.category, 'rain');
  assert.ok(rainHotspot.criticalPhase.includes('Anthesis'));

  const heatHotspot = REGIONAL_HOTSPOTS.find((h) => h.id === 'tuguegarao-valley-heat-dome');
  assert.ok(heatHotspot, 'Must include valley heat dome hotspot');
  assert.equal(heatHotspot.category, 'thermal');
  assert.ok(heatHotspot.threshold.includes('36.5'));
});

test('calculates accurate Haversine distance and bearing relative to Lanna farm', () => {
  // Tuguegarao is ~9.5-11 km SSE of Lanna
  const tugDist = haversineDistanceKm(FARM_COORDINATE.latitude, FARM_COORDINATE.longitude, 17.61, 121.73);
  assert.ok(tugDist >= 8 && tugDist <= 13, `Expected ~9.5-11 km, got ${tugDist}`);
  const tugBearing = calculateBearing(FARM_COORDINATE.latitude, FARM_COORDINATE.longitude, 17.61, 121.73);
  assert.ok(['S', 'SSE', 'SE'].includes(tugBearing), `Expected SSE, got ${tugBearing}`);

  const rel = getRelativePositionToLanna(17.61, 121.73);
  assert.equal(rel.distanceKm, tugDist);
  assert.equal(rel.bearing, tugBearing);
  assert.ok(rel.label.includes('km'));
});

test('filters hotspots by functional agronomic category', () => {
  const all = filterHotspots(REGIONAL_HOTSPOTS, 'all');
  assert.equal(all.length, REGIONAL_HOTSPOTS.length);

  const thermal = filterHotspots(REGIONAL_HOTSPOTS, 'thermal');
  assert.ok(thermal.length >= 2);
  assert.ok(thermal.every((h) => h.category === 'thermal'));

  const wind = filterHotspots(REGIONAL_HOTSPOTS, 'wind');
  assert.ok(wind.length >= 1);
  assert.ok(wind.every((h) => h.category === 'wind'));

  const rain = filterHotspots(REGIONAL_HOTSPOTS, 'rain');
  assert.ok(rain.length >= 1);
  assert.ok(rain.every((h) => h.category === 'rain'));
});

test('identifies active hotspot alerts matching simulated or live weather thresholds', () => {
  const coldHotspot = REGIONAL_HOTSPOTS.find((h) => h.id === 'cordillera-cold-drainage');
  const windHotspot = REGIONAL_HOTSPOTS.find((h) => h.id === 'alcala-river-wind-funnel');
  const rainHotspot = REGIONAL_HOTSPOTS.find((h) => h.id === 'sierra-madre-rain-squall');
  const heatHotspot = REGIONAL_HOTSPOTS.find((h) => h.id === 'tuguegarao-valley-heat-dome');

  // Simulator condition tests
  assert.equal(isHotspotAlertActive(coldHotspot, 'sim-tgms-cold'), true);
  assert.equal(isHotspotAlertActive(windHotspot, 'sim-tgms-cold'), false);

  assert.equal(isHotspotAlertActive(windHotspot, 'sim-wind-gust'), true);
  assert.equal(isHotspotAlertActive(rainHotspot, 'sim-wind-gust'), false);

  assert.equal(isHotspotAlertActive(rainHotspot, 'sim-anthesis-rain'), true);
  assert.equal(isHotspotAlertActive(heatHotspot, 'sim-anthesis-rain'), false);

  assert.equal(isHotspotAlertActive(heatHotspot, 'sim-heat-stress'), true);

  // Live alerts matching category
  const liveColdAlert = [{ category: 'TGMS', title: 'Sub-24C Sterility risk' }];
  assert.equal(isHotspotAlertActive(coldHotspot, 'live', liveColdAlert), true);
  assert.equal(isHotspotAlertActive(windHotspot, 'live', liveColdAlert), false);
});

test('provides valid GeoJSON features for Cagayan Valley topography and river paths', () => {
  assert.equal(CAGAYAN_VALLEY_GEOJSON.type, 'FeatureCollection');
  assert.ok(Array.isArray(CAGAYAN_VALLEY_GEOJSON.features));
  assert.ok(CAGAYAN_VALLEY_GEOJSON.features.length >= 5);

  const mainRiver = CAGAYAN_VALLEY_GEOJSON.features.find((f) => f.properties.kind === 'river-main');
  assert.ok(mainRiver, 'Must define main Cagayan River path');
  assert.equal(mainRiver.geometry.type, 'LineString');
  assert.ok(mainRiver.geometry.coordinates.length >= 8);

  const basin = CAGAYAN_VALLEY_GEOJSON.features.find((f) => f.properties.kind === 'valley');
  assert.ok(basin, 'Must define Cagayan valley lowland polygon');
  assert.equal(basin.geometry.type, 'Polygon');
});
