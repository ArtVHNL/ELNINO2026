# Deployment & Operations

## One-time setup (5 minutes)

1. **Push this repository** to `github.com/ArtVHNL/ELNINO2026` (main branch).
2. **Enable GitHub Pages**
   → repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Add the DeepSeek API key**
   → repo **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `DEEPSEEK_API_KEY` — value: your key from https://platform.deepseek.com
   - Optional variable `DEEPSEEK_MODEL` (default `deepseek-v4-flash`)
4. **Optional: cron-failure alarms** — create a check at https://healthchecks.io,
   add the ping URL as secret `HEALTHCHECKS_URL`.
5. **Optional: uptime monitoring** — UptimeRobot free tier, URL of the live site.

After that everything runs itself: twice-daily data fetch + AI briefing, and a
GitHub Pages deploy on every change.

## What runs automatically

| Workflow | Trigger | Result |
|----------|---------|--------|
| `Update ENSO Data` | cron 06:00 & 18:00 UTC, manual dispatch | `data.json`, `meta.json`, `news/`, `history/` committed |
| `Deploy Dashboard` | every push + after each data update | `app/` built, data bundled, Pages published |

## Troubleshooting

- **Actions tab shows a failed run** → open the run log; `pipeline_output.txt`
  is echoed into the job summary. The most common cause is an endpoint being
  temporarily unreachable; the pipeline degrades per-endpoint and the site keeps
  the last good data.
- **Site shows old data** → check `meta.json` in the repo for the last run
  timestamp; check the Actions tab for skipped runs (cron can be delayed by
  GitHub by up to ~2 h).
- **Briefing missing on the site** → the `DEEPSEEK_API_KEY` secret is unset or
  the API call failed validation (logged in the workflow step).
- **GitHub disables the cron after 60 days of repo inactivity** → the twice-daily
  runs themselves keep the repo active, so this cannot happen while the cron works.
  If it ever does, run the workflow manually once (Actions → Update ENSO Data →
  Run workflow).
