# Architecture

```
 NOAA CPC ──┐                    ┌──────────────────────────────────────────────┐
 NOAA PSL ──┤  GitHub Actions    │  GitHub Pages (static, free, HTTPS)          │
 (THREDDS)  │  cron 06:00/18:00  │  ┌────────────────────────────────────────┐  │
 GoogleNews ┤  ┌──────────────┐  │  │ React 19 dashboard (app/)             │  │
 RSS        ├─▶│ fetch_data.py│──┼─▶│  · data.json + news/ same-origin      │  │
             │  └──────────────┘  │  │  · provenance badges, freshness       │  │
             │  ┌──────────────┐  │  │  · AI expert briefing panel           │  │
             │  │ deepseek_    │  │  │  · deck.gl map lazy-loaded            │  │
             │  │ briefing.py  │  │  │  · SEO / Open Graph / JSON-LD         │  │
             │  └──────────────┘  │  └────────────────────────────────────────┘  │
             │  commit data.json  │                                               │
             │  + news/ + history │                                               │
             └────────────────────┘                                               │
                              ▲ push triggers deploy.yml (Pages)                  │
 ┌────────────────────────────┴───────────────────────────────────────────────────┘
 │ Healthchecks.io (cron alive + failure ping) · UptimeRobot (site uptime)
 │ README shields: pipeline health, last update, endpoints live
 └─────────────────────────────────────────────────────────────────────────────────
```

## Key decisions

1. **No backend in production.** The dashboard is fully static; all data arrives
   as committed JSON. Dev-only proxies (`app/server/`) are used solely for local
   development CORS workarounds.
2. **Honest provenance.** `synthetic` blocks are visibly labelled; the pipeline
   never reports a failed fetch as `OK`.
3. **Two deployment triggers.** `deploy.yml` runs on every push *and* after every
   completed data update (`workflow_run`), because commits made by the
   `GITHUB_TOKEN` do not fire `on: push` workflows.
4. **Climatology committed to the repo.** The 1991–2020 GODAS monthly reference
   (`reference/godas_pottmp_clim_1991-2020.json.gz`) makes anomalies reproducible
   without re-downloading 30 years of data per run.
5. **AI with guardrails.** DeepSeek may only quote numbers present in the data
   payload; output is schema-validated before publication; a disclaimer is
   rendered on every briefing.

## Failure modes

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Endpoint down/retired | per-run health matrix (`meta.json`) | automatic fallback to labelled schematic; UI shows badge |
| Cron skipped (GitHub 60-day rule / delay) | Healthchecks.io silence → alert | manual `workflow_dispatch`; site keeps last committed data |
| DeepSeek API down | briefing step `continue-on-error` | site keeps last briefing |
| Data pipeline crash | exit code + healthchecks `/fail` + GitHub issue log | last committed data remains published |
