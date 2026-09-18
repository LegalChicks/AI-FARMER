import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  WEATHER_LOCATION,
  buildConsensus,
  maxFinite,
  mean,
  minFinite,
  round
} from '../src/assets/weather-core.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(repoRoot, 'src', 'data', 'weather.json');
const USER_AGENT = 'Lingan-Agronomist/1.0 (Mestiso 20 field dashboard; scheduled forecast cache)';
const MANILA_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: WEATHER_LOCATION.timezone,
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  hourCycle: 'h23'
});

const PROVIDER_META = Object.freeze({
  openMeteo: {
    id: 'open-meteo',
    name: 'Open-Meteo',
    model: 'Best-match global model blend',
    forecastHorizon: 'Up to 16 days',
    license: 'CC BY 4.0; free non-commercial API use',
    documentation: 'https://open-meteo.com/en/docs'
  },
  metNorway: {
    id: 'met-norway',
    name: 'MET Norway Locationforecast',
    model: 'ECMWF global forecast outside Nordic region',
    forecastHorizon: 'Up to 9–10 days',
    license: 'MET Norway weather-data terms; attribution required',
    documentation: 'https://api.met.no/weatherapi/locationforecast/2.0/documentation'
  },
  sevenTimer: {
    id: '7timer',
    name: '7Timer!',
    model: 'NOAA/NCEP Global Forecast System',
    forecastHorizon: 'Up to 8 days',
    license: 'Public no-key machine-readable API; attribution retained',
    documentation: 'https://www.7timer.info/doc.php?lang=en'
  }
});

function localParts(date) {
  const parts = Object.fromEntries(MANILA_FORMATTER.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function todayInManila() {
  return localParts(new Date()).date;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(25_000),
    headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT, ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return { data: await response.json(), headers: response.headers };
}

function groupByDate(samples) {
  const groups = new Map();
  for (const sample of samples) {
    if (!groups.has(sample.date)) groups.set(sample.date, []);
    groups.get(sample.date).push(sample);
  }
  return groups;
}

function dayNightSummary(samples, solar = {}) {
  const sunrise = solar.sunrise?.slice(11, 16) || '06:00';
  const sunset = solar.sunset?.slice(11, 16) || '18:00';
  const daylight = samples.filter((sample) => sample.time >= sunrise && sample.time < sunset);
  const night = samples.filter((sample) => sample.time < sunrise || sample.time >= sunset);
  const temperatures = samples.map((sample) => sample.temperatureC);
  const rainParts = samples.map((sample) => sample.precipitationMm).filter(Number.isFinite);
  return {
    daylightMeanC: round(mean(daylight.map((sample) => sample.temperatureC))),
    nightMeanC: round(mean(night.map((sample) => sample.temperatureC))),
    dailyMeanC: round(mean(temperatures)),
    minimumC: round(minFinite(temperatures)),
    maximumC: round(maxFinite(temperatures)),
    rainMm: rainParts.length ? round(rainParts.reduce((total, value) => total + value, 0)) : null,
    rainSignal: samples.some((sample) => sample.rainSignal || Number(sample.precipitationMm) > 0),
    windMaximumKmh: round(maxFinite(samples.map((sample) => sample.windKmh))),
    sampleCount: samples.length,
    daylightSampleCount: daylight.length,
    nightSampleCount: night.length,
    coverageComplete: samples.length >= 4 && daylight.length >= 2 && night.length >= 2
  };
}

async function loadOpenMeteo() {
  const query = new URLSearchParams({
    latitude: String(WEATHER_LOCATION.latitude),
    longitude: String(WEATHER_LOCATION.longitude),
    elevation: String(WEATHER_LOCATION.elevationM),
    timezone: WEATHER_LOCATION.timezone,
    forecast_days: '16',
    past_days: '2',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,shortwave_radiation',
    daily: 'sunrise,sunset,temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,shortwave_radiation_sum',
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
    wind_speed_unit: 'kmh'
  });
  const { data } = await fetchJson(`https://api.open-meteo.com/v1/forecast?${query}`);
  const solarByDate = new Map();
  for (let index = 0; index < data.daily.time.length; index += 1) {
    solarByDate.set(data.daily.time[index], {
      sunrise: data.daily.sunrise[index],
      sunset: data.daily.sunset[index],
      rainMm: data.daily.precipitation_sum[index],
      rainProbabilityPct: data.daily.precipitation_probability_max[index],
      windMaximumKmh: data.daily.wind_gusts_10m_max[index],
      solarRadiationMjM2: data.daily.shortwave_radiation_sum[index],
      minimumC: data.daily.temperature_2m_min[index],
      maximumC: data.daily.temperature_2m_max[index]
    });
  }
  const samples = data.hourly.time.map((stamp, index) => ({
    date: stamp.slice(0, 10),
    time: stamp.slice(11, 16),
    temperatureC: data.hourly.temperature_2m[index],
    precipitationMm: data.hourly.precipitation[index],
    rainSignal: data.hourly.weather_code[index] >= 51,
    windKmh: Math.max(data.hourly.wind_speed_10m[index] || 0, data.hourly.wind_gusts_10m[index] || 0)
  }));
  const groups = groupByDate(samples);
  const days = [...groups.entries()].map(([date, dateSamples]) => {
    const solar = solarByDate.get(date) || {};
    return {
      date,
      sourceId: PROVIDER_META.openMeteo.id,
      sunrise: solar.sunrise || null,
      sunset: solar.sunset || null,
      ...dayNightSummary(dateSamples, solar),
      minimumC: round(solar.minimumC),
      maximumC: round(solar.maximumC),
      rainMm: round(solar.rainMm),
      rainProbabilityPct: round(solar.rainProbabilityPct, 0),
      windMaximumKmh: round(solar.windMaximumKmh),
      solarRadiationMjM2: round(solar.solarRadiationMjM2)
    };
  });
  return {
    meta: { ...PROVIDER_META.openMeteo, status: 'ok', updatedAt: data.current.time, horizonEnd: days.at(-1)?.date },
    current: {
      time: data.current.time,
      temperatureC: data.current.temperature_2m,
      humidityPct: data.current.relative_humidity_2m,
      precipitationMm: data.current.precipitation,
      windKmh: data.current.wind_speed_10m,
      gustKmh: data.current.wind_gusts_10m,
      weatherCode: data.current.weather_code
    },
    days
  };
}

async function loadMetNorway(solarByDate) {
  const query = new URLSearchParams({
    lat: WEATHER_LOCATION.latitude.toFixed(4),
    lon: WEATHER_LOCATION.longitude.toFixed(4),
    altitude: String(WEATHER_LOCATION.elevationM)
  });
  const { data, headers } = await fetchJson(`https://api.met.no/weatherapi/locationforecast/2.0/compact?${query}`);
  const samples = data.properties.timeseries.map((entry) => {
    const local = localParts(new Date(entry.time));
    const details = entry.data.instant.details;
    const oneHour = entry.data.next_1_hours?.details;
    const sixHours = entry.data.next_6_hours?.details;
    const precipitationMm = oneHour?.precipitation_amount ?? sixHours?.precipitation_amount ?? null;
    const symbol = entry.data.next_1_hours?.summary?.symbol_code || entry.data.next_6_hours?.summary?.symbol_code || entry.data.next_12_hours?.summary?.symbol_code || '';
    return {
      ...local,
      temperatureC: details.air_temperature,
      precipitationMm,
      rainSignal: /rain|sleet|snow|thunder/.test(symbol) || Number(precipitationMm) > 0,
      windKmh: Number(details.wind_speed) * 3.6
    };
  });
  const groups = groupByDate(samples);
  const days = [...groups.entries()].map(([date, dateSamples]) => ({
    date,
    sourceId: PROVIDER_META.metNorway.id,
    ...dayNightSummary(dateSamples, solarByDate.get(date))
  }));
  return {
    meta: {
      ...PROVIDER_META.metNorway,
      status: 'ok',
      updatedAt: data.properties.meta.updated_at,
      expiresAt: headers.get('expires'),
      horizonEnd: days.at(-1)?.date
    },
    current: samples[0] ? { time: data.properties.timeseries[0].time, temperatureC: samples[0].temperatureC, windKmh: samples[0].windKmh } : null,
    days
  };
}

const WIND_CATEGORY_MS = { 1: 0.1, 2: 1.8, 3: 5.7, 4: 9.4, 5: 14, 6: 20.8, 7: 28.5, 8: 35 };

function parseSevenTimerInit(value) {
  const text = String(value);
  return new Date(Date.UTC(Number(text.slice(0, 4)), Number(text.slice(4, 6)) - 1, Number(text.slice(6, 8)), Number(text.slice(8, 10))));
}

async function loadSevenTimer(solarByDate) {
  const query = new URLSearchParams({
    lon: WEATHER_LOCATION.longitude.toFixed(3),
    lat: WEATHER_LOCATION.latitude.toFixed(3),
    product: 'civil',
    output: 'json'
  });
  const { data } = await fetchJson(`https://www.7timer.info/bin/api.pl?${query}`);
  const initialized = parseSevenTimerInit(data.init);
  const samples = data.dataseries.map((entry) => {
    const validTime = new Date(initialized.getTime() + entry.timepoint * 3_600_000);
    const local = localParts(validTime);
    return {
      ...local,
      validTime: validTime.toISOString(),
      temperatureC: entry.temp2m,
      precipitationMm: null,
      rainSignal: entry.prec_type !== 'none' || /rain|shower|storm/.test(entry.weather || ''),
      windKmh: round((WIND_CATEGORY_MS[entry.wind10m?.speed] || 0) * 3.6)
    };
  });
  const groups = groupByDate(samples);
  const days = [...groups.entries()].map(([date, dateSamples]) => ({
    date,
    sourceId: PROVIDER_META.sevenTimer.id,
    ...dayNightSummary(dateSamples, solarByDate.get(date)),
    rainMm: null
  }));
  return {
    meta: { ...PROVIDER_META.sevenTimer, status: 'ok', updatedAt: initialized.toISOString(), horizonEnd: days.at(-1)?.date },
    current: samples[0] ? { time: samples[0].validTime, temperatureC: samples[0].temperatureC, windKmh: samples[0].windKmh } : null,
    days
  };
}

function toDayMap(provider) {
  return new Map(provider?.days?.map((day) => [day.date, day]) || []);
}

async function main() {
  const errors = [];
  let openMeteo;
  try {
    openMeteo = await loadOpenMeteo();
  } catch (error) {
    errors.push({ provider: PROVIDER_META.openMeteo.name, message: error.message });
  }

  const solarByDate = new Map((openMeteo?.days || []).map((day) => [day.date, { sunrise: day.sunrise, sunset: day.sunset }]));
  const [metResult, sevenResult] = await Promise.allSettled([
    loadMetNorway(solarByDate),
    loadSevenTimer(solarByDate)
  ]);
  const metNorway = metResult.status === 'fulfilled' ? metResult.value : null;
  const sevenTimer = sevenResult.status === 'fulfilled' ? sevenResult.value : null;
  if (metResult.status === 'rejected') errors.push({ provider: PROVIDER_META.metNorway.name, message: metResult.reason.message });
  if (sevenResult.status === 'rejected') errors.push({ provider: PROVIDER_META.sevenTimer.name, message: sevenResult.reason.message });

  const providers = [openMeteo, metNorway, sevenTimer].filter(Boolean);
  if (providers.length < 2) throw new Error(`Weather refresh aborted: only ${providers.length} provider succeeded.`);
  const dayMaps = providers.map(toDayMap);
  const today = todayInManila();
  const dateSet = new Set(providers.flatMap((provider) => provider.days.map((day) => day.date)).filter((date) => date >= today));
  const dates = [...dateSet].sort().slice(0, 16);
  const daily = dates.map((date) => {
    const sourceDays = dayMaps.map((map) => map.get(date)).filter(Boolean);
    const openDay = sourceDays.find((day) => day.sourceId === 'open-meteo');
    return {
      date,
      sunrise: openDay?.sunrise || null,
      sunset: openDay?.sunset || null,
      sources: sourceDays,
      consensus: buildConsensus(sourceDays)
    };
  });

  const currentSources = providers.map((provider) => provider.current && ({
    sourceId: provider.meta.id,
    time: provider.current.time,
    temperatureC: round(provider.current.temperatureC),
    humidityPct: round(provider.current.humidityPct, 0),
    precipitationMm: round(provider.current.precipitationMm),
    windKmh: round(provider.current.windKmh),
    gustKmh: round(provider.current.gustKmh)
  })).filter(Boolean);
  const generatedAt = new Date();
  const presentDay = daily.find((day) => day.date === today) || daily[0];
  const output = {
    schema: 'lingan-agronomist-weather/v1',
    generatedAt: generatedAt.toISOString(),
    nextRefreshDueAt: new Date(generatedAt.getTime() + 48 * 3_600_000).toISOString(),
    refreshPolicyHours: 48,
    forecastNature: 'Numerical weather-model forecast. It is not an on-farm sensor observation and cannot certify TGMS sterility.',
    location: WEATHER_LOCATION,
    current: {
      time: openMeteo?.current?.time || currentSources[0]?.time,
      primarySourceId: openMeteo ? PROVIDER_META.openMeteo.id : currentSources[0]?.sourceId,
      primaryTemperatureC: round(openMeteo?.current?.temperatureC ?? currentSources[0]?.temperatureC),
      consensusTemperatureC: round(mean(currentSources.map((source) => source.temperatureC))),
      consensusWindKmh: round(mean(currentSources.map((source) => source.windKmh))),
      sources: currentSources
    },
    presentDay,
    providers: providers.map((provider) => provider.meta),
    unavailableProviders: errors,
    daily
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Weather snapshot written to ${path.relative(repoRoot, outputPath)} with ${providers.length} providers and ${daily.length} forecast days.`);
  if (errors.length) console.warn(JSON.stringify(errors));
}

await main();
