# Lingan-Agronomist — Mestiso 20

A deploy-ready, source-backed field operations dashboard for **NSIC Rc204H / Mestiso 20** two-line hybrid rice seed production using **PRUP TG102** as the TGMS S-line and **TG102M** as the pollen parent in Lanna, Solana, Cagayan.

The default production clock starts with PRUP TG102 on **20 September 2026** and TG102M P1 on **25 September 2026**. The 125-day calendar is generated in the browser and includes nursery work, the 8S:2P row module, PI diagnosis, the modelled TGMS sterility audit, GA3 decision gates, supplementary pollination, grain filling, harvest segregation, and seed-lot control.

## What is included

- A responsive operational dashboard with the full D0–D124 daily calendar.
- Editable field, seed-lot, S-line date, P-line stagger, and row-ratio settings.
- Search and filters for line, growth phase, and critical operations.
- Persistent task completion and field observations using browser local storage.
- Three-provider farm forecast using Open-Meteo, MET Norway Locationforecast, and 7Timer/GFS.
- Recorded forecast snapshots with present daylight mean, night mean, provider spread, rainfall, and wind.
- Crop-day-aware warnings, operational restraints, solutions, and remedials for nursery work, transplanting, TGMS sterility, GA3, rope pulling, irrigation, lodging, and harvest.
- Automatic daily weather refresh workflow, with a 48-hour maximum freshness target and stale-data warning.
- TGMS temperature-exception flags for recorded minimum and mean temperatures.
- A four-gate nitrogen planner that validates the published M20 120–150 kg N/ha evidence envelope and requires approved split percentages totalling 100%.
- Fertilizer product conversion from nutrient kg/ha, guaranteed analysis, actual treated area, and bag size.
- A heading-triggered GA₃ calculator using the approved active rate, verified formulation concentration, actual S/P area, calibrated carrier volume, and split percentage.
- A precisely dated fertilizer and chemical operations table covering nursery diagnosis, basal and three later N gates, weed/snail decisions, GA₃ preparation and release, anthesis restraint, IPM, PHI audit, and chemical closure.
- A persistent application ledger with eight release gates, FPA registration and expiry, label crop/target, actual rate and area, calibration, weather, PPE, REI, PHI, operator, and supervisor fields.
- CSV calendar and chemical-ledger exports, JSON field-record backup, and print/PDF layout.
- Source and evidence labels separating documented practice, provisional local recommendations, modelled windows, and unknown traits.
- Zero package dependencies; the browser reads only the same-origin published weather record after the page loads.
- Static deployment configurations for OpenAI Sites, Netlify, Vercel, Cloudflare Pages, and GitHub Pages.
- Node tests for the calendar, dates, stagger, critical windows, and temperature guardrails.
- Weather tests for provider consensus, crop-day mapping, TGMS cold exposure, and wet-anthesis restraints.

## Weather intelligence

The committed weather record is generated from three independent, free global forecast services:

1. **Open-Meteo** — best-match global model blend, hourly values, sunrise/sunset, rainfall probability, solar radiation, and up to 16 forecast days.
2. **MET Norway Locationforecast** — ECMWF-based global point forecast outside the Nordic region, fetched server-side with the identifying User-Agent required by MET Norway.
3. **7Timer!** — NOAA/NCEP GFS-derived forecast, used as an independent no-key temperature, rain-signal, and wind comparison.

The default coordinate is the published barangay-center reference for Lanna: **17.6934° N, 121.7010° E, approximately 24 m elevation**. Replace these constants in `src/assets/weather-core.js` with a surveyed field coordinate when available; temperature downscaling and local rainfall can differ across even short distances.

The system calculates each provider’s daylight mean from local sunrise to sunset and its night mean from the remaining local hours. It stores the published snapshot in `src/data/weather.json` and records each new snapshot in browser storage. The interface also shows source count, inter-model temperature spread, and confidence. These are numerical weather-model values, not measurements from a canopy logger.

To fetch an immediate three-provider record:

```bash
npm run weather:update
npm run validate
```

The [weather refresh workflow](.github/workflows/refresh-weather.yml) runs every day at 21:17 UTC, approximately 05:17 Philippine time. It refreshes the data, validates the application, commits the changed source and production weather records, and triggers the normal deployment workflow. Daily execution is more frequent than the requested 48-hour interval. GitHub Actions and repository write permission must remain enabled for unattended refreshes.

The web application checks the latest deployed record when it opens and offers a cache-bypassing “Check latest published forecast” control. It marks records older than 48 hours as stale. MET Norway is intentionally fetched in the scheduled Node workflow because its official API guidance requires an identifying server-side User-Agent and advises against direct production-browser access.

## Run locally

Node.js 20 or newer is required. No dependency installation is needed.

```bash
npm run dev
```

Open `http://127.0.0.1:4173`.

## Validate the production build

```bash
npm run validate
```

This recreates `dist/`, validates the deployable entry points and JavaScript syntax, then runs the calendar tests.

To preview the exact production directory:

```bash
npm run preview
```

## Deploy

The production output is `dist/`.

- **OpenAI Sites:** the included `.openai/hosting.json` points to `dist`.
- **Netlify:** import the repository; `netlify.toml` supplies the build command and publish directory.
- **Vercel:** import the repository; `vercel.json` supplies the build command and output directory.
- **Cloudflare Pages:** use `npm run build` and set the output directory to `dist`.
- **GitHub Pages:** push the repository to a `main` branch and enable GitHub Pages with **GitHub Actions** as the source. The included workflow validates and deploys the site.

Security headers are included for hosts that support `_headers`, Netlify, and Vercel. All application data remains in the user’s browser unless the user exports it.

## Agronomic use boundary

This is an operational planning and recordkeeping tool. It does not certify TGMS sterility or seed purity. The production release gate remains field evidence: canopy temperature records, line-specific PI and heading observations, bagged S-line controls, pollen/fertility checks, isolation and roguing records, and required laboratory or certification results.

No numeric GA₃ dose is preloaded. The calculator remains locked until the signed M20 protocol’s active rate and the actual product concentration are entered. The public research establishes the biological timing at observed heading but does not provide a current commercial M20 product rate. A qualitative public statement that TG102M may need a higher dose is not converted into a number.

The public Isabela M20 evidence supports a 120–150 kg N/ha seasonal range, and a later PRUP TG102 study reports four nitrogen splits. The public sources do not give the four split quantities. The application therefore requires approved percentages that total 100%. P₂O₅, K₂O, S, and Zn remain MOET/soil-diagnosis values. Pesticides are never pre-scheduled by product: every use requires a confirmed target, current FPA registration, rice/target label, approved rate, calibration, weather gate, PPE, REI, and PHI.

## Repository structure

```text
.
├── .github/workflows/      # deployment and scheduled weather refresh
├── .openai/hosting.json
├── scripts/               # zero-dependency build, server, and validation
├── src/                   # authored application
│   ├── assets/
│   └── index.html
├── dist/                  # generated by npm run build
├── tests/
├── netlify.toml
├── vercel.json
└── package.json
```

## Evidence base

The dashboard links its primary sources in the interface. The core references are DA-PhilRice’s Mestiso 20 synchronization article, PhilRice Isabela station results, the 2019 Hybrid Rice Program report, PhilRice 2014–2015 milestones, PhilRice TGMS environmental safeguards, the current FPA registered-products list, PAGASA Tuguegarao 1991–2020 climatological normals, and the PAGASA September 2026–February 2027 climate outlook.

Weather API documentation and attribution are displayed in the dashboard and retained in every generated record: [Open-Meteo](https://open-meteo.com/en/docs), [MET Norway Locationforecast](https://api.met.no/weatherapi/locationforecast/2.0/documentation), and [7Timer!](https://www.7timer.info/doc.php?lang=en).
