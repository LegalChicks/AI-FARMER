const DAY_MS = 86_400_000;

export const WEATHER_LOCATION = Object.freeze({
  name: 'Lanna, Solana, Cagayan',
  latitude: 17.6934,
  longitude: 121.7010,
  elevationM: 24,
  timezone: 'Asia/Manila',
  coordinateBasis: 'Barangay-center reference; replace with surveyed farm GPS when available.'
});

export const WEATHER_THRESHOLDS = Object.freeze({
  tgmsMinimumC: 24,
  tgmsDailyMeanC: 27,
  coldStressC: 20,
  heavyRainMm: 20,
  veryHeavyRainMm: 40,
  highRainProbabilityPct: 70,
  sprayWindKmh: 20,
  damagingGustKmh: 35,
  heatDaylightMeanC: 35,
  severeHeatC: 38,
  humidityMinPct: 50,
  humidityMaxPct: 92,
  providerSpreadC: 3,
  freshnessMaxHours: 48
});

export function round(value, digits = 1) {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

export function mean(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? finite.reduce((total, value) => total + value, 0) / finite.length : null;
}

export function minFinite(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.min(...finite) : null;
}

export function maxFinite(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.max(...finite) : null;
}

export function buildConsensus(sourceDays) {
  const valid = sourceDays.filter((day) => day && day.coverageComplete !== false && Number.isFinite(day.daylightMeanC) && Number.isFinite(day.nightMeanC));
  const daylightValues = valid.map((day) => day.daylightMeanC);
  const nightValues = valid.map((day) => day.nightMeanC);
  const rainValues = sourceDays.map((day) => day?.rainMm).filter(Number.isFinite);
  const daylightSpread = daylightValues.length ? Math.max(...daylightValues) - Math.min(...daylightValues) : null;
  const nightSpread = nightValues.length ? Math.max(...nightValues) - Math.min(...nightValues) : null;
  const spread = maxFinite([daylightSpread, nightSpread]);
  const sourceCount = valid.length;
  let confidence = 'low';
  if (sourceCount === 3 && spread <= 2) confidence = 'high';
  else if (sourceCount >= 2 && spread <= 3.5) confidence = 'moderate';
  return {
    sourceCount,
    confidence,
    daylightMeanC: round(mean(daylightValues)),
    nightMeanC: round(mean(nightValues)),
    dailyMeanC: round(mean(valid.map((day) => day.dailyMeanC))),
    minimumC: round(minFinite(valid.map((day) => day.minimumC))),
    maximumC: round(maxFinite(valid.map((day) => day.maximumC))),
    rainMm: round(mean(rainValues)),
    rainMaximumMm: round(maxFinite(rainValues)),
    rainProbabilityPct: round(maxFinite(sourceDays.map((day) => day?.rainProbabilityPct)), 0),
    windMaximumKmh: round(maxFinite(sourceDays.map((day) => day?.windMaximumKmh))),
    temperatureSpreadC: round(spread),
    rainSignalSources: sourceDays.filter((day) => day?.rainSignal).length
  };
}

export function cropDayForDate(seedDate, weatherDate) {
  const seed = new Date(`${seedDate}T00:00:00Z`);
  const date = new Date(`${weatherDate}T00:00:00Z`);
  return Math.round((date - seed) / DAY_MS);
}

export function cropPhaseForDay(day) {
  if (day < 0) return 'Pre-sowing readiness';
  if (day <= 17) return 'Nursery & land readiness';
  if (day <= 32) return 'Transplant establishment';
  if (day <= 53) return 'Early tillering';
  if (day <= 59) return 'PI diagnosis';
  if (day <= 84) return 'Critical sterility audit';
  if (day <= 102) return 'Heading / anthesis';
  if (day <= 115) return 'Filling / integrity';
  if (day <= 124) return 'Maturity / harvest control';
  return 'Post-calendar records';
}

function advice(severity, category, title, warning, restraint, remedial, affectedActivities) {
  return { severity, category, title, warning, restraint, remedial, affectedActivities };
}

export function generateAgronomicAdvisories(day, cropDay, threeDayRainMm = null) {
  const data = day?.consensus || day || {};
  const phase = cropPhaseForDay(cropDay);
  const advisories = [];
  const inSterilityWindow = cropDay >= 60 && cropDay <= 88;
  const inHeadingWindow = cropDay >= 85 && cropDay <= 102;
  const inNursery = cropDay >= 0 && cropDay <= 17;
  const inTransplant = cropDay >= 14 && cropDay <= 32;

  if (inSterilityWindow && Number.isFinite(data.nightMeanC) && data.nightMeanC < WEATHER_THRESHOLDS.tgmsMinimumC) {
    advisories.push(advice(
      'critical', 'TGMS', 'Night temperature below the TGMS guardrail',
      `Consensus night mean is ${data.nightMeanC.toFixed(1)}°C, below the 24°C operational guardrail. S-line fertility reversion and selfing risk increase.`,
      'Do not classify the block or seed lot as safely male-sterile from the calendar alone. Do not relax bagging, pollen checks, or lot segregation.',
      'Increase canopy-temperature review, inspect logger minima, expand tagged bagged S-line controls, schedule pollen-fertility assessment, and escalate the lot to the production supervisor.',
      ['S-line sterility audit', 'F1 purity release', 'bagged controls', 'pollen microscopy']
    ));
  }

  if (inSterilityWindow && Number.isFinite(data.dailyMeanC) && data.dailyMeanC < WEATHER_THRESHOLDS.tgmsDailyMeanC) {
    advisories.push(advice(
      'critical', 'TGMS', 'Daily mean below the TGMS guardrail',
      `Consensus daily mean is ${data.dailyMeanC.toFixed(1)}°C, below the 27°C operational guardrail during the sensitive window.`,
      'Do not assume complete male sterility or blend questionable harvest lots.',
      'Confirm with actual canopy data and fertility controls. Mark the exposure date against panicle stage and segregate affected sections for review.',
      ['TGMS sterility', 'seed-lot eligibility', 'harvest segregation']
    ));
  }

  const rainMaximum = Number.isFinite(data.rainMaximumMm) ? data.rainMaximumMm : data.rainMm;
  const highRain = (Number.isFinite(rainMaximum) && rainMaximum >= WEATHER_THRESHOLDS.heavyRainMm)
    || data.rainProbabilityPct >= WEATHER_THRESHOLDS.highRainProbabilityPct
    || data.rainSignalSources >= 2;
  if (highRain) {
    const severity = rainMaximum >= WEATHER_THRESHOLDS.veryHeavyRainMm ? 'critical' : 'high';
    let restraint = 'Suspend foliar sprays when rain can wash off the product; keep workers out during thunder or unsafe wind.';
    let remedial = 'Clear inlets and drains, secure seed and chemical stores, inspect bunds, and move spray work to a verified dry interval.';
    const activities = ['spraying', 'fertilizer placement', 'drainage', 'field access'];
    if (inHeadingWindow) {
      restraint += ' Do not apply GA3 before rain and do not rope-pull wet panicles.';
      remedial += ' Recount heading after the rain, remove dew only after panicles drain, and resume pollen supplementation during the next dry flowering window.';
      activities.push('GA3', 'rope pulling', 'supplementary pollination');
    } else if (inNursery) {
      restraint += ' Avoid sowing into a seedbed likely to erode or remain submerged.';
      remedial += ' Protect nursery drainage, prevent seed wash, and reschedule sowing only when the bed can retain seed position and aeration.';
      activities.push('nursery sowing', 'seedling establishment');
    } else if (inTransplant) {
      restraint += ' Delay transplanting when water depth or current prevents correct depth, spacing, and line identity.';
      remedial += ' Restore mapped rows after drainage and re-count gaps after water recedes.';
      activities.push('transplanting', 'gap filling', 'row identification');
    }
    advisories.push(advice(severity, 'RAIN', 'Heavy-rain or high-probability rain signal',
      `Provider consensus indicates ${data.rainProbabilityPct ?? 'unavailable'}% maximum rain probability, up to ${rainMaximum ?? 'unavailable'} mm, with ${data.rainSignalSources || 0} provider rain signals.`,
      restraint, remedial, activities));
  }

  if (Number.isFinite(data.windMaximumKmh) && data.windMaximumKmh >= WEATHER_THRESHOLDS.sprayWindKmh) {
    const severe = data.windMaximumKmh >= WEATHER_THRESHOLDS.damagingGustKmh;
    advisories.push(advice(
      severe ? 'critical' : 'high', 'WIND', severe ? 'Strong gust and lodging risk' : 'Spray-drift and pollen-dispersal risk',
      `Maximum forecast wind or gust is approximately ${data.windMaximumKmh.toFixed(1)} km/h.`,
      'Do not apply GA3, pesticide, or foliar nutrient when drift cannot be controlled. Stop rope pulling when gusts can damage panicles or move pollen outside the intended block.',
      'Move applications to a calmer, dry period; inspect lodging and row identity after strong wind; maintain isolation and document any external flowering-rice exposure.',
      ['GA3', 'crop protection sprays', 'rope pulling', 'lodging surveillance', 'genetic isolation']
    ));
  }

  if (Number.isFinite(data.daylightMeanC) && data.daylightMeanC >= WEATHER_THRESHOLDS.heatDaylightMeanC) {
    advisories.push(advice(
      'moderate', 'HEAT', 'High daylight mean temperature',
      `Consensus daylight mean is ${data.daylightMeanC.toFixed(1)}°C. Seedlings, recently transplanted hills, workers, and exposed flowering panicles may be stressed.`,
      'Avoid midday transplanting and nonessential foliar application. Do not drain a heat-stressed block without a stage-specific reason.',
      'Schedule labor early, maintain approved shallow water, verify inlet capacity, check seedbed moisture, and inspect panicle desiccation or poor exertion.',
      ['nursery', 'transplanting', 'irrigation', 'worker safety', 'flowering']
    ));
  }

  if (Number.isFinite(threeDayRainMm) && threeDayRainMm < 3 && cropDay >= 0 && cropDay <= 115) {
    advisories.push(advice(
      'moderate', 'DRY', 'Three-day low-rain signal',
      `Forecast mean rainfall totals less than 3 mm over three days during ${phase.toLowerCase()}.`,
      'Do not wait for visible wilting before securing irrigation. Avoid fertilizer placement without water control.',
      'Confirm canal or pump availability, repair leaks and bunds, maintain stage-appropriate shallow water, and prioritize nursery and recently transplanted areas.',
      ['irrigation', 'fertilizer timing', 'nursery moisture', 'crop establishment']
    ));
  }

  if (Number.isFinite(data.temperatureSpreadC) && data.temperatureSpreadC > WEATHER_THRESHOLDS.providerSpreadC) {
    advisories.push(advice(
      'moderate', 'UNCERTAINTY', 'Weather models disagree',
      `The temperature spread among providers is ${data.temperatureSpreadC.toFixed(1)}°C, above the 3°C agreement threshold.`,
      'Do not commit irreversible timing decisions to the consensus value alone.',
      'Check the next scheduled update, compare the individual providers, and rely on the field logger for sterility and spray-release decisions.',
      ['all temperature-sensitive operations', 'TGMS release', 'GA3 timing']
    ));
  }

  if (!advisories.length) {
    advisories.push(advice(
      'routine', 'MONITOR', 'No threshold warning from the current consensus',
      `No configured temperature, heavy-rain, strong-wind, or dry-window threshold is crossed for ${phase.toLowerCase()}.`,
      'Do not interpret a clear automated screen as proof of crop safety or TGMS sterility.',
      'Continue the daily field log, inspect local sky and water conditions, and follow the operation listed in the master calendar.',
      ['routine scouting', 'water records', 'phenology verification']
    ));
  }

  const severityOrder = { critical: 0, high: 1, moderate: 2, routine: 3 };
  return advisories.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export function threeDayRainTotal(days, startIndex) {
  const values = days.slice(startIndex, startIndex + 3)
    .map((day) => day?.consensus?.rainMm)
    .filter(Number.isFinite);
  return values.length ? round(values.reduce((total, value) => total + value, 0)) : null;
}

export function evaluateCurrentWeatherAlerts(weatherPayload, cropDay, options = {}) {
  if (!weatherPayload) return [];
  const current = weatherPayload.current || weatherPayload;
  const presentDay = weatherPayload.presentDay;
  const nextRefreshDueAt = weatherPayload.nextRefreshDueAt;
  const thresholds = { ...WEATHER_THRESHOLDS, ...options.customThresholds };
  const advisories = [];

  const currentTime = current.time || options.currentDate || new Date().toISOString();
  const currentDate = currentTime.slice(0, 10);
  const phase = cropPhaseForDay(cropDay);

  const sources = Array.isArray(current.sources) ? current.sources : [];
  const sourceTemps = sources.map((s) => s.temperatureC).filter(Number.isFinite);
  const sourceWinds = sources.map((s) => s.windKmh).filter(Number.isFinite);
  const sourceGusts = sources.map((s) => s.gustKmh).filter(Number.isFinite);
  const sourcePrecip = sources.map((s) => s.precipitationMm).filter(Number.isFinite);
  const sourceHumidities = sources.map((s) => s.humidityPct).filter(Number.isFinite);

  const currentTemp = Number.isFinite(current.consensusTemperatureC)
    ? current.consensusTemperatureC
    : (Number.isFinite(current.primaryTemperatureC) ? current.primaryTemperatureC : mean(sourceTemps));
  const minSourceTemp = minFinite(sourceTemps);
  const maxSourceTemp = maxFinite(sourceTemps);
  const tempSpread = (sourceTemps.length > 1 && maxSourceTemp !== null && minSourceTemp !== null)
    ? maxSourceTemp - minSourceTemp
    : null;

  const currentWind = Number.isFinite(current.consensusWindKmh)
    ? current.consensusWindKmh
    : maxFinite(sourceWinds);
  const maxGust = maxFinite(sourceGusts);
  const effectiveWind = maxFinite([currentWind, maxGust]);

  const maxPrecip = maxFinite(sourcePrecip) ?? (Number.isFinite(current.precipitationMm) ? current.precipitationMm : 0);
  const minHumidity = minFinite(sourceHumidities);
  const maxHumidity = maxFinite(sourceHumidities);

  const inSterilityWindow = cropDay >= 60 && cropDay <= 88;
  const inHeadingWindow = cropDay >= 85 && cropDay <= 102;
  const inNurseryOrTransplant = cropDay >= 0 && cropDay <= 32;

  // 1. Critical TGMS Sterility Assessment (D60-D88)
  if (inSterilityWindow && Number.isFinite(currentTemp) && currentTemp < thresholds.tgmsMinimumC) {
    advisories.push({
      isCurrent: true,
      severity: 'critical',
      category: 'TGMS',
      title: 'CURRENT ALERT: Temperature below TGMS sterility threshold (24°C)',
      warning: `Current observed temperature is ${currentTemp.toFixed(1)}°C, falling below the 24.0°C operational minimum during the critical sterility audit window (D${cropDay}). High risk of PRUP TG102 sterility breakdown and selfing.`,
      restraint: 'Do not certify male sterility or release F1 hybrid seed lots based on calendar prediction alone.',
      remedial: 'Inspect canopy temperature loggers immediately. Bag additional S-line panicles for sterility verification, conduct iodine pollen staining, and notify the production supervisor.',
      affectedActivities: ['S-line sterility audit', 'bagged controls', 'pollen microscopy', 'seed certification'],
      threshold: `< ${thresholds.tgmsMinimumC.toFixed(1)}°C`,
      measured: `${currentTemp.toFixed(1)}°C`,
      time: currentTime,
      cropDay,
      date: currentDate
    });
  } else if (inSterilityWindow && Number.isFinite(minSourceTemp) && minSourceTemp < thresholds.tgmsMinimumC && currentTemp >= thresholds.tgmsMinimumC) {
    advisories.push({
      isCurrent: true,
      severity: 'high',
      category: 'TGMS',
      title: 'CURRENT ALERT: Reporting provider detects sub-24°C temperature in TGMS window',
      warning: `At least one reporting weather provider indicates current local temperature at ${minSourceTemp.toFixed(1)}°C (consensus ${currentTemp.toFixed(1)}°C), crossing the 24.0°C TGMS threshold during D${cropDay}.`,
      restraint: 'Verify microclimate with the in-field sensor before recording the lot as thermally compliant.',
      remedial: 'Check on-farm logger data and expand bagged panicle inspection.',
      affectedActivities: ['TGMS audit', 'sensor cross-check', 'bagged controls'],
      threshold: `< ${thresholds.tgmsMinimumC.toFixed(1)}°C`,
      measured: `Source low ${minSourceTemp.toFixed(1)}°C`,
      time: currentTime,
      cropDay,
      date: currentDate
    });
  }

  // 1b. Present day daily mean in TGMS window
  if (inSterilityWindow && presentDay?.consensus && Number.isFinite(presentDay.consensus.dailyMeanC) && presentDay.consensus.dailyMeanC < thresholds.tgmsDailyMeanC) {
    advisories.push({
      isCurrent: true,
      severity: 'critical',
      category: 'TGMS',
      title: 'CURRENT ALERT: Daily mean below 27°C TGMS sterility guardrail',
      warning: `Present 24-hour mean temperature is ${presentDay.consensus.dailyMeanC.toFixed(1)}°C, below the 27.0°C PhilRice TGMS operational threshold during the sensitive window (D${cropDay}).`,
      restraint: 'Do not assume complete male sterility or combine questionable harvest lots.',
      remedial: 'Segregate affected blocks on the field map and verify with iodine pollen viability staining.',
      affectedActivities: ['TGMS audit', 'lot segregation', 'purity testing'],
      threshold: `< ${thresholds.tgmsDailyMeanC.toFixed(1)}°C`,
      measured: `${presentDay.consensus.dailyMeanC.toFixed(1)}°C 24h mean`,
      time: currentTime,
      cropDay,
      date: currentDate
    });
  }

  // 2. Chilling / Cold Shock in Young Crop (D0-D32)
  if (inNurseryOrTransplant && Number.isFinite(currentTemp) && currentTemp < thresholds.coldStressC) {
    advisories.push({
      isCurrent: true,
      severity: 'high',
      category: 'COLD',
      title: 'CURRENT ALERT: Chilling temperature stress (< 20°C)',
      warning: `Current temperature is ${currentTemp.toFixed(1)}°C, below the 20.0°C minimum for normal hybrid rice seedling vigor and root growth during ${phase.toLowerCase()} (D${cropDay}).`,
      restraint: 'Do not drain nursery beds or transplant weak seedlings during cold spells.',
      remedial: 'Raise water level to 3–5 cm in the late afternoon to buffer nocturnal root temperatures.',
      affectedActivities: ['nursery management', 'transplanting', 'water buffering'],
      threshold: `< ${thresholds.coldStressC.toFixed(1)}°C`,
      measured: `${currentTemp.toFixed(1)}°C`,
      time: currentTime,
      cropDay,
      date: currentDate
    });
  }

  // 3. Heat Stress
  if (Number.isFinite(currentTemp) && currentTemp >= thresholds.heatDaylightMeanC) {
    const isSevere = currentTemp >= thresholds.severeHeatC;
    if (inHeadingWindow) {
      advisories.push({
        isCurrent: true,
        severity: isSevere ? 'critical' : 'high',
        category: 'HEAT',
        title: isSevere
          ? 'CURRENT ALERT: Extreme heat floret sterility risk (≥ 38°C)'
          : 'CURRENT ALERT: Heat stress threshold exceeded (≥ 35°C)',
        warning: `Current temperature is ${currentTemp.toFixed(1)}°C (threshold: ${thresholds.heatDaylightMeanC.toFixed(1)}°C) during heading/anthesis (D${cropDay}). Extreme risk of pollen desiccation and spikelet sterility.`,
        restraint: 'Suspend midday rope-pulling and foliar chemical sprays. Avoid panicle agitation during peak heat.',
        remedial: 'Maintain 5–7 cm circulating freshwater layer to cool the canopy microclimate. Restrict rope pulling to morning opening hours (08:30–10:30) before temperatures exceed 32°C.',
        affectedActivities: ['rope pulling', 'GA3 application', 'irrigation cooling', 'worker safety'],
        threshold: `≥ ${thresholds.heatDaylightMeanC.toFixed(1)}°C`,
        measured: `${currentTemp.toFixed(1)}°C`,
        time: currentTime,
        cropDay,
        date: currentDate
      });
    } else {
      advisories.push({
        isCurrent: true,
        severity: isSevere ? 'high' : 'moderate',
        category: 'HEAT',
        title: 'CURRENT ALERT: High temperature stress (≥ 35°C)',
        warning: `Current temperature is ${currentTemp.toFixed(1)}°C during ${phase.toLowerCase()} (D${cropDay}). High evapotranspiration and seedling/worker heat stress.`,
        restraint: 'Avoid midday transplanting and non-essential foliar chemical applications.',
        remedial: 'Irrigate to maintain shallow water cover and shift field labor to early morning or late afternoon.',
        affectedActivities: ['irrigation', 'transplanting', 'spraying', 'worker safety'],
        threshold: `≥ ${thresholds.heatDaylightMeanC.toFixed(1)}°C`,
        measured: `${currentTemp.toFixed(1)}°C`,
        time: currentTime,
        cropDay,
        date: currentDate
      });
    }
  }

  // 4. Wind and Gust Limits
  if (Number.isFinite(effectiveWind) && effectiveWind >= thresholds.sprayWindKmh) {
    const isDamaging = (Number.isFinite(maxGust) && maxGust >= thresholds.damagingGustKmh)
      || (Number.isFinite(currentWind) && currentWind >= thresholds.damagingGustKmh);
    if (isDamaging) {
      const gustVal = maxGust || currentWind;
      advisories.push({
        isCurrent: true,
        severity: 'critical',
        category: 'WIND',
        title: 'CURRENT ALERT: Damaging wind gusts (≥ 35 km/h)',
        warning: `Current wind gusts reach ${gustVal.toFixed(1)} km/h, exceeding the 35.0 km/h threshold for crop lodging and panicle damage.`,
        restraint: 'Immediately suspend all field operations. Strictly forbid GA3 application, boom spraying, and rope pulling.',
        remedial: 'Clear workers from the field; inspect crop rows and isolation borders for mechanical lodging after winds subside.',
        affectedActivities: ['GA3 application', 'rope pulling', 'crop protection', 'field safety'],
        threshold: `≥ ${thresholds.damagingGustKmh.toFixed(1)} km/h`,
        measured: `${gustVal.toFixed(1)} km/h`,
        time: currentTime,
        cropDay,
        date: currentDate
      });
    } else {
      advisories.push({
        isCurrent: true,
        severity: 'high',
        category: 'WIND',
        title: 'CURRENT ALERT: Wind speed exceeds 20 km/h spray/pollination limit',
        warning: `Current wind is ${currentWind.toFixed(1)} km/h${maxGust ? ` with gusts to ${maxGust.toFixed(1)} km/h` : ''}, exceeding the 20.0 km/h limit for controlled foliar spraying and targeted pollen transfer.`,
        restraint: 'Do not apply GA3, pesticides, or foliar nutrients. Suspend rope-pulling if wind carries pollen cloud off-target.',
        remedial: 'Recheck wind speed every 30 minutes; resume operations when wind drops below 15–20 km/h during calm morning hours.',
        affectedActivities: ['GA3 spraying', 'crop protection', 'rope pulling', 'isolation control'],
        threshold: `≥ ${thresholds.sprayWindKmh.toFixed(1)} km/h`,
        measured: `${(currentWind || maxGust).toFixed(1)} km/h`,
        time: currentTime,
        cropDay,
        date: currentDate
      });
    }
  }

  // 5. Active Rainfall Detection
  if (Number.isFinite(maxPrecip) && maxPrecip > 0) {
    if (inHeadingWindow) {
      advisories.push({
        isCurrent: true,
        severity: 'critical',
        category: 'RAIN',
        title: 'CURRENT ALERT: Active precipitation during heading / anthesis',
        warning: `Current rainfall detected (${maxPrecip.toFixed(1)} mm). Rain closes glumes, bursts pollen grains upon contact, and washes off GA3 solution.`,
        restraint: 'Strictly prohibited: GA3 spraying and rope-pulling wet panicles. Never shake wet flowering heads.',
        remedial: 'Wait until the canopy has dried completely after rainfall stops. Recount flowering percentage and adjust GA3 timing.',
        affectedActivities: ['GA3 application', 'rope pulling', 'supplementary pollination'],
        threshold: '> 0.0 mm',
        measured: `${maxPrecip.toFixed(1)} mm`,
        time: currentTime,
        cropDay,
        date: currentDate
      });
    } else {
      advisories.push({
        isCurrent: true,
        severity: 'high',
        category: 'RAIN',
        title: 'CURRENT ALERT: Active rainfall detected in field area',
        warning: `Current precipitation is ${maxPrecip.toFixed(1)} mm. Active rainfall causes chemical wash-off and fertilizer leaching.`,
        restraint: 'Cease foliar spraying and topdress fertilizer applications.',
        remedial: 'Inspect bunds and field outlets to ensure excess runoff does not submerge nursery beds or wash away seedlings.',
        affectedActivities: ['spraying', 'fertilizer application', 'water management'],
        threshold: '> 0.0 mm',
        measured: `${maxPrecip.toFixed(1)} mm`,
        time: currentTime,
        cropDay,
        date: currentDate
      });
    }
  }

  // 6. Relative Humidity during Heading/Anthesis (D85-D102)
  if (inHeadingWindow && Number.isFinite(minHumidity) && minHumidity < thresholds.humidityMinPct) {
    advisories.push({
      isCurrent: true,
      severity: 'moderate',
      category: 'HUMIDITY',
      title: 'CURRENT ALERT: Low humidity (< 50%) during flowering',
      warning: `Current relative humidity is ${minHumidity.toFixed(0)}%, below the 50% threshold for pollen longevity. Pollen grains desiccate rapidly.`,
      restraint: 'Do not delay rope-pulling once anther dehiscence begins.',
      remedial: 'Keep standing water in paddies to increase relative humidity in the canopy microclimate.',
      affectedActivities: ['supplementary pollination', 'canopy humidity'],
      threshold: `< ${thresholds.humidityMinPct}%`,
      measured: `${minHumidity.toFixed(0)}%`,
      time: currentTime,
      cropDay,
      date: currentDate
    });
  } else if (inHeadingWindow && Number.isFinite(maxHumidity) && maxHumidity > thresholds.humidityMaxPct && maxPrecip === 0) {
    advisories.push({
      isCurrent: true,
      severity: 'moderate',
      category: 'HUMIDITY',
      title: 'CURRENT ALERT: Excessive humidity (> 92%) during flowering',
      warning: `Current relative humidity is ${maxHumidity.toFixed(0)}%. Glumes remain closed and anther dehiscence is retarded in water-saturated air.`,
      restraint: 'Do not shake panicles before spikelets open naturally.',
      remedial: 'Wait for sunlight and slight air movement to reduce glume surface moisture before beginning rope pulling.',
      affectedActivities: ['rope pulling', 'anthesis inspection'],
      threshold: `> ${thresholds.humidityMaxPct}%`,
      measured: `${maxHumidity.toFixed(0)}%`,
      time: currentTime,
      cropDay,
      date: currentDate
    });
  }

  // 7. Multi-Provider Disagreement
  if (Number.isFinite(tempSpread) && tempSpread > thresholds.providerSpreadC) {
    advisories.push({
      isCurrent: true,
      severity: 'moderate',
      category: 'UNCERTAINTY',
      title: 'CURRENT ALERT: Provider model divergence (> 3°C)',
      warning: `Current multi-source models differ by ${tempSpread.toFixed(1)}°C (exceeding 3.0°C threshold). Local microclimate may vary from forecast.`,
      restraint: 'Do not make irreversible chemical or sterility release decisions based solely on forecast models.',
      remedial: 'Cross-reference with physical data logger placed at canopy height in the Lanna field.',
      affectedActivities: ['temperature decisions', 'TGMS release', 'GA3 timing'],
      threshold: `> ${thresholds.providerSpreadC.toFixed(1)}°C`,
      measured: `${tempSpread.toFixed(1)}°C spread`,
      time: currentTime,
      cropDay,
      date: currentDate
    });
  }

  // 8. Stale Forecast Feed
  const checkNow = options.now ?? Date.now();
  if (nextRefreshDueAt && checkNow > new Date(nextRefreshDueAt).getTime()) {
    advisories.push({
      isCurrent: true,
      severity: 'moderate',
      category: 'STALE',
      title: 'CURRENT ALERT: Weather feed older than 48 hours',
      warning: 'Current forecast data has exceeded the 48-hour refresh policy window.',
      restraint: 'Do not rely on stale model data for upcoming 24-48 h field operations.',
      remedial: 'Click "Check latest published forecast" or re-run update script, and cross-reference with local PAGASA bulletins.',
      affectedActivities: ['operational planning', 'weather monitoring'],
      threshold: `> ${thresholds.freshnessMaxHours} hours`,
      measured: 'Expired',
      time: currentTime,
      cropDay,
      date: currentDate
    });
  }

  const rank = { critical: 0, high: 1, moderate: 2, routine: 3 };
  return advisories.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
