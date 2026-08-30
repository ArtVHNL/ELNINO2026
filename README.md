# El Niño 2026 — Live ENSO Monitoring Dashboard

A fully automated, publicly accessible climate monitoring dashboard tracking the
2026–27 El Niño event in near real time. The dashboard combines official NOAA/CPC
indices, ocean reanalysis fields, international model forecasts and an
AI-generated expert briefing into one continuously updated operational picture.

**Live site:** https://ArtVHNL.github.io/ELNINO2026/

[![Pipeline](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FArtVHNL%2FELNINO2026%2Fmain%2Fmeta.json&query=%24.summary.live&label=endpoints%20live&color=success)](https://github.com/ArtVHNL/ELNINO2026/actions/workflows/update_data.yml)
[![Synthetic](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FArtVHNL%2FELNINO2026%2Fmain%2Fmeta.json&query=%24.summary.synthetic&label=fallback%20%28synthetic%29&color=orange)](meta.json)
[![Last update](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FArtVHNL%2FELNINO2026%2Fmain%2Fmeta.json&query=%24.generated_at&label=last%20update&color=blue)](meta.json)
[![Tests](https://img.shields.io/badge/tests-14%20passing-brightgreen)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What it does

- **Flat, newsroom-style interface** — white background, black type, one functional
  red for the current data line; heavy visualisations removed
- **Three functional visualisations** — current anomaly vs the previous record
  year (2015), land-impact map, official CPC probability outlook per season
- **Official indices** — Niño 3.4 (weekly & monthly), ONI, MEI v2, Warm Water Volume
- **Ocean state** — GODAS subsurface temperature, thermocline depth, heat content
- **Official forecasts** — CPC ENSO probabilities by season, ENSO Diagnostic Discussion
- **Provenance & transparency** — every data block is labelled `live`, `derived`,
  `synthetic` or `stale`, with source URL and fetch timestamp

## How it stays updated — fully automatic

| Component | Mechanism | Cadence |
|---|---|---|
| Data pipeline (`scripts/fetch_data.py`) | GitHub Actions cron | 06:00 & 18:00 UTC daily |
| AI briefing + news digest (`scripts/deepseek_briefing.py`) | Same workflow, after data fetch | 06:00 UTC daily |
| Web deployment | GitHub Actions → GitHub Pages | On every data/push change |
| Pipeline health alarms | Healthchecks.io ping + failure alert | Every run |
| Site uptime monitoring | UptimeRobot | Every 5 min |

No manual maintenance is required after initial setup.

## Repository layout

```
├── app/                  React 19 + Vite + D3 + deck.gl dashboard
│   ├── src/              components, data layer, types
│   └── server/           local dev proxy (dev only — not used in production)
├── scripts/
│   ├── fetch_data.py     data pipeline v3 (10+ verified endpoints)
│   ├── deepseek_briefing.py  AI briefing & news generation
│   └── test_pipeline.py  pytest suite
├── docs/                 architecture, data schema, endpoint status
├── data.json             latest pipeline output (served to the dashboard)
├── news/                 AI briefing + news archive (served to the dashboard)
└── legacy/               earlier vanilla-JS iteration (archived)
```

## Data sources (verified working)

| Parameter | Source | Format |
|---|---|---|
| Niño 3.4 SSTA (weekly) | [NOAA CPC](https://www.cpc.ncep.noaa.gov/data/indices/sstoi.indices) | ASCII |
| Niño regions (weekly) | [NOAA CPC](https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for) | ASCII |
| ONI | [NOAA CPC](https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt) | ASCII |
| SOI | [NOAA CPC](https://www.cpc.ncep.noaa.gov/data/indices/soi) | ASCII |
| MEI v2 | [NOAA PSL](https://psl.noaa.gov/data/correlation/mei.data) | ASCII |
| Niño 3.4 anomaly (monthly) | [NOAA PSL](https://psl.noaa.gov/data/correlation/nina34.anom.data) | ASCII |
| Subsurface T / WWV / thermocline | [NOAA NOMADS GODAS](https://nomads.ncep.noaa.gov/dods/godas) | OPeNDAP |
| OLR anomaly | NOAA PSL / NCEI ERDDAP | OPeNDAP/JSON |
| ENSO Diagnostic Discussion + probabilities | [NOAA CPC](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml) | HTML parse |
| ENSO model plume | IRI | CSV |
| NMME precipitation outlook | IRI / CPC | JSON |
| ENSO blog / news | [Climate.gov](https://www.climate.gov/news-features/blogs/enso), NOAA, WMO | RSS |

See [`docs/API_ENDPOINTS.md`](docs/API_ENDPOINTS.md) for the full registry with
live status, and [`docs/DATA_SCHEMA.md`](docs/DATA_SCHEMA.md) for the output schema.

## Local development

```bash
# Frontend
cd app
npm install
npm run dev          # http://localhost:3000 — uses local proxy for live data

# Data pipeline (any machine with Python 3.10+)
python scripts/fetch_data.py --out .
pytest scripts/test_pipeline.py
```

> Note for WSL users: run `npm install`/`vite build` on the Linux filesystem
> (`/home/...`) — building directly on a Windows drive mount (`/mnt/c`) can
> crash Node with a `Bus error` on some WSL2 setups.

## Deployment

Pushing to `main` triggers:

1. `Update ENSO Data` — fetches all endpoints, validates, commits `data.json` + `news/`
2. `Deploy Dashboard` — builds `app/`, bundles `data.json` + `news/` into the
   static site, publishes to GitHub Pages

### Required repository secrets

| Secret | Purpose |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API key for the daily AI briefing (model: `deepseek-v4-flash`, configurable via `DEEPSEEK_MODEL`) |
| `HEALTHCHECKS_URL` (optional) | Healthchecks.io ping URL for cron-failure alerts |

## Disclaimer

This project is an independent monitoring tool. It is not affiliated with NOAA,
IRI, WMO or any other institution. Data is provided by the respective agencies;
AI-generated briefings are machine-written from official data and are **not**
reviewed by a professional meteorologist. Always consult official sources
(NOAA CPC, WMO) for authoritative statements.

## License

MIT — see [LICENSE](LICENSE).
