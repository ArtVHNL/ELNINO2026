# API Endpoints — Live Status Registry

Verified on **30 August 2026** by direct probes from the pipeline environment.
Every endpoint is checked automatically on each pipeline run and the result is
published in `meta.json` and shown on the dashboard.

## Core indices — all working (HTTP 200)

| # | Parameter | Endpoint | Format | Pipeline source |
|---|-----------|----------|--------|-----------------|
| 1 | Niño 1+2/3/3.4/4 SSTA (monthly, 1982→) | https://www.cpc.ncep.noaa.gov/data/indices/sstoi.indices | ASCII | `cpc_sstoi` |
| 2 | Niño 1+2/3/3.4/4 SSTA (weekly) | https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for | fixed-width ASCII | `cpc_weekly` |
| 3 | ONI (3-month running mean, 1950→) | https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt | ASCII (SEAS YR TOTAL ANOM) | `cpc_oni` |
| 4 | SOI (monthly, full history) | https://www.cpc.ncep.noaa.gov/data/indices/soi | ASCII | `cpc_soi` |
| 5 | MEI v2 (1979→) | https://psl.noaa.gov/enso/mei/data/meiv2.data | ASCII | `psl_mei` |
| 6 | ENSO Diagnostic Discussion (advisory, indices, probabilities, dates) | https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml | HTML | `cpc_ensodisc` |

## Ocean & atmosphere fields — OPeNDAP (working)

| # | Parameter | Endpoint | Method | Pipeline source |
|---|-----------|----------|--------|-----------------|
| 7 | GODAS potential temperature (subsurface, monthly, 1980→) | https://psl.noaa.gov/thredds/dodsC/Datasets/godas/pottmp.{year}.nc | DAP2 subset | `godas` |
| 8 | CPC blended OLR anomaly (1°, daily) | https://psl.noaa.gov/thredds/dodsC/Datasets/cpc_blended_olr-1deg/olr.cbo-1deg.day.anom.nc | DAP2 subset | `olr` |
| 9 | GODAS climatology reference (1991–2020, built once) | `reference/godas_pottmp_clim_1991-2020.json.gz` (repo) | — | `godas` |

## Derived in the pipeline

| Parameter | Derivation |
|-----------|------------|
| Warm Water Volume (WWV) | GODAS box mean (5°S–5°N, 180°W–100°W, 0–300 m) minus 1991–2020 climatology |
| Thermocline depth | 20 °C isotherm depth per longitude from GODAS |
| Subsurface anomaly (Hovmöller) | GODAS 2°S–2°N average minus monthly climatology |
| Event comparison | Peak ONI of historical events (1982–83, 1997–98, 2015–16, 2023–24, …) detected from the ONI series |

## Unavailable anonymously — labelled `synthetic` (never presented as live)

| Parameter | Reason | Mitigation |
|-----------|--------|------------|
| IRI Data Library (OLR/GODAS/NMME JSON) | IRI now requires login (302 → /auth/login) | PSL THREDDS equivalents used instead; health matrix tracks restoration |
| NMME precipitation forecast | IRI login wall; NOMADS DODS retired | Climatological schematic, clearly labelled |
| 850 hPa wind anomaly | IRI login wall | Schematic Walker-circulation field, clearly labelled |
| ENSO model plume table | IRI page embeds figures only (no anonymous data API) | Official IRI figure linked; table is a deterministic schematic |
| PMEL WWV text file | URL dead (302/403) | WWV computed from GODAS instead |

## News & briefing

| Source | URL | Use |
|--------|-----|-----|
| Google News RSS (El Niño 2026 climate) | https://news.google.com/rss/search?q=El+Niño+2026+climate | DeepSeek news digest |
| CPC ENSO Diagnostic Discussion | https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ | Official statements |
| IRI ENSO forecast page | https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/ | Official plume figure |
