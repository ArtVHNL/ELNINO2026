#!/usr/bin/env python3
"""
fetch_data.py — El Niño 2026 Pipeline v3
=========================================
Fetches ENSO monitoring data from verified public NOAA/PSL/CPC/IRI endpoints,
computes derived diagnostics (WWV, thermocline depth, event comparison),
and writes a fully provenance-labelled data.json for the public dashboard.

Provenance model (per data block):
  live      — fetched and parsed successfully from the official source
  derived   — computed by this pipeline from live data (e.g. WWV from GODAS)
  synthetic — official source unavailable; deterministic stand-in, clearly
              labelled in the UI. NEVER presented as measurement.
  stale     — fetched OK but older than the freshness threshold

Outputs (in OUT_DIR):
  data.json          dashboard payload (schema v3)
  meta.json          endpoint health matrix + freshness report
  history/YYYY-MM-DD.json   daily archive of data.json
  pipeline.log       run log

Usage:
  python scripts/fetch_data.py [--out DIR] [--max-history N]
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests
import numpy as np

try:
    import netCDF4
    HAS_NETCDF4 = True
except ImportError:
    HAS_NETCDF4 = False

VERSION = "3.0.0"
USER_AGENT = "enso-pipeline/3.0 (+https://github.com/ArtVHNL/ELNINO2026)"
REQUEST_TIMEOUT = 30

# --------------------------------------------------------------------------
# Logging
# --------------------------------------------------------------------------
log = logging.getLogger("enso-pipeline")
log.setLevel(logging.INFO)
_fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")


def _setup_logging(log_file: Path):
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(_fmt)
    log.addHandler(sh)
    if log_file:
        fh = logging.FileHandler(log_file)
        fh.setFormatter(_fmt)
        log.addHandler(fh)


# --------------------------------------------------------------------------
# HTTP helpers with retry/backoff
# --------------------------------------------------------------------------
def fetch_text(url: str, timeout: int = REQUEST_TIMEOUT, retries: int = 3) -> str | None:
    """GET text with exponential backoff. Returns None on final failure."""
    delay = 2.0
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(
                url, timeout=timeout,
                headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
            )
            resp.raise_for_status()
            return resp.text
        except requests.exceptions.RequestException as e:
            log.warning("  HTTP attempt %d/%d failed for %s: %s", attempt, retries, url[:100], e)
            if attempt < retries:
                time.sleep(delay)
                delay *= 2
    return None


def fetch_binary(url: str, timeout: int = 60, retries: int = 2) -> bytes | None:
    delay = 2.0
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, timeout=timeout, headers={"User-Agent": USER_AGENT})
            resp.raise_for_status()
            return resp.content
        except requests.exceptions.RequestException as e:
            log.warning("  BIN attempt %d/%d failed for %s: %s", attempt, retries, url[:100], e)
            if attempt < retries:
                time.sleep(delay)
    return None


def parse_float_list(text: str) -> list[float]:
    """Parse whitespace-separated floats, tolerating '-.5' style tokens."""
    return [float(tok) for tok in text.split() if tok.strip()]


# --------------------------------------------------------------------------
# 1. CPC sstoi.indices — monthly SST + anomaly for Niño 1+2 / 3 / 4 / 3.4
# --------------------------------------------------------------------------
CPC_SSTOI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/sstoi.indices"


def fetch_cpc_sstoi() -> tuple[dict, dict]:
    """Full monthly history (1982–present) for the four Niño regions."""
    text = fetch_text(CPC_SSTOI_URL)
    if not text:
        return {}, {"source": "synthetic", "error": "fetch failed"}

    regions = {"nino12": 3, "nino3": 5, "nino4": 7, "nino34": 9}  # ANOM column index
    series = {k: [] for k in regions}
    for line in text.strip().splitlines():
        parts = line.split()
        if len(parts) < 10 or not parts[0].isdigit():
            continue
        year, month = int(parts[0]), int(parts[1])
        if not (1 <= month <= 12):
            continue
        date = f"{year}-{month:02d}-01"
        for name, col in regions.items():
            try:
                val = float(parts[col])
                if -10 < val < 10:
                    series[name].append({"date": date, "value": round(val, 2)})
            except (ValueError, IndexError):
                continue

    if len(series["nino34"]) < 24:
        return {}, {"source": "synthetic", "error": f"only {len(series['nino34'])} rows parsed"}
    log.info("  OK: nino34 %d rows (latest %s)", len(series["nino34"]), series["nino34"][-1]["date"])
    return series, {"source": "live", "url": CPC_SSTOI_URL}


# --------------------------------------------------------------------------
# 2. CPC wksst9120.for — weekly Niño region SST anomalies (fixed width)
# --------------------------------------------------------------------------
CPC_WKST_URL = "https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for"


def fetch_cpc_weekly() -> tuple[dict, dict]:
    """Weekly values for the four Niño regions (fixed-width columns)."""
    text = fetch_text(CPC_WKST_URL)
    if not text:
        return {}, {"source": "synthetic", "error": "fetch failed"}

    # Layout: 9-char week label, then per region: SST(4) SSTA(4)
    regions = ["nino12", "nino3", "nino34", "nino4"]
    series = {k: [] for k in regions}
    for line in text.splitlines():
        tokens = line.split()
        # layout: Week SST1 SSTA1 SST2 SSTA2 ...  (9 tokens per data row)
        if len(tokens) != 9 or not tokens[0][:1].isdigit():
            continue
        week = tokens[0]
        try:
            # 02SEP1981 → 1981-09-02 (week centered date)
            day = datetime.strptime(week, "%d%b%Y").date().isoformat()
        except ValueError:
            continue
        for i, name in enumerate(regions):
            try:
                val = float(tokens[2 + 2 * i])
                if -10 < val < 10:
                    series[name].append({"date": day, "value": round(val, 2)})
            except ValueError:
                continue
    if not series["nino34"]:
        return {}, {"source": "synthetic", "error": "no rows parsed"}
    log.info("  OK: weekly nino34 %d rows (latest %s)", len(series["nino34"]), series["nino34"][-1]["date"])
    return series, {"source": "live", "url": CPC_WKST_URL}


# --------------------------------------------------------------------------
# 3. CPC ONI — 3-month running mean, full history
# --------------------------------------------------------------------------
CPC_ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
SEASONS = ["DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"]
SEASONS_3 = ["JAS", "ASO", "SON", "OND", "NDJ", "DJF", "JFM", "FMA", "MAM"]


def fetch_cpc_oni() -> tuple[list, dict]:
    text = fetch_text(CPC_ONI_URL)
    if not text:
        return [], {"source": "synthetic", "error": "fetch failed"}
    records = []
    for line in text.strip().splitlines():
        parts = line.split()
        # current CPC format: SEAS YR TOTAL ANOM
        if len(parts) < 4 or parts[0] not in SEASONS or not parts[1].isdigit():
            continue
        season, year = parts[0], int(parts[1])
        try:
            val = float(parts[3])
        except ValueError:
            continue
        if -5 < val < 5:
            records.append({"season": season, "year": year, "value": round(val, 2)})
    if len(records) < 24:
        return [], {"source": "synthetic", "error": f"only {len(records)} rows"}
    log.info("  OK: ONI %d rows (latest %s %d)", len(records), records[-1]["season"], records[-1]["year"])
    return records, {"source": "live", "url": CPC_ONI_URL}


# --------------------------------------------------------------------------
# 4. CPC SOI — monthly, full history
# --------------------------------------------------------------------------
CPC_SOI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/soi"


def fetch_cpc_soi() -> tuple[list, dict]:
    text = fetch_text(CPC_SOI_URL)
    if not text:
        return [], {"source": "synthetic", "error": "fetch failed"}
    records = []
    for line in text.strip().splitlines():
        parts = line.split()
        if len(parts) < 2 or not parts[0].isdigit():
            continue
        year = int(parts[0])
        for i, val_str in enumerate(parts[1:13], 1):
            try:
                val = float(val_str)
            except ValueError:
                continue
            if -60 < val < 60:
                records.append({"date": f"{year}-{i:02d}-15", "value": round(val, 2)})
    if len(records) < 24:
        return [], {"source": "synthetic", "error": f"only {len(records)} rows"}
    log.info("  OK: SOI %d rows (latest %s)", len(records), records[-1]["date"])
    return records, {"source": "live", "url": CPC_SOI_URL}


# --------------------------------------------------------------------------
# 5. PSL MEI v2 — monthly, full history
# --------------------------------------------------------------------------
PSL_MEI_URL = "https://psl.noaa.gov/enso/mei/data/meiv2.data"  # MEI v2 (1979–present)


def fetch_psl_mei() -> tuple[list, dict]:
    text = fetch_text(PSL_MEI_URL)
    if not text:
        return [], {"source": "synthetic", "error": "fetch failed"}
    records = []
    for line in text.strip().splitlines():
        parts = line.split()
        # header/footer lines ("1979 2026", "Multivariate ENSO Index ...") are skipped
        if len(parts) < 2 or not parts[0].isdigit() or parts[1].isdigit():
            continue
        year = int(parts[0])
        for i, val_str in enumerate(parts[1:13], 1):
            try:
                val = float(val_str)
            except ValueError:
                continue
            if -10 < val < 10:
                records.append({"date": f"{year}-{i:02d}-01", "value": round(val, 2)})
    if len(records) < 24:
        return [], {"source": "synthetic", "error": f"only {len(records)} rows"}
    log.info("  OK: MEI %d rows (latest %s)", len(records), records[-1]["date"])
    return records, {"source": "live", "url": PSL_MEI_URL}


# --------------------------------------------------------------------------
# 6. CPC ENSO Diagnostic Discussion — status, indices, probabilities
# --------------------------------------------------------------------------
CPC_ENSO_DISC_URL = (
    "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml"
)
MONTHS_EN = {
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
}


def _text_of(html: str) -> str:
    html = re.sub(r"<script.*?</script>", "", html, flags=re.S | re.I)
    html = re.sub(r"<[^>]+>", " ", html)
    import html as h
    text = h.unescape(html)
    text = text.replace("\xa0", " ")
    return re.sub(r"\s+", " ", text)


def fetch_cpc_ensodisc() -> tuple[dict, dict]:
    html = fetch_text(CPC_ENSO_DISC_URL)
    if not html:
        return {}, {"source": "synthetic", "error": "fetch failed"}
    text = _text_of(html)

    def grab(pattern: str) -> str | None:
        m = re.search(pattern, text, flags=re.I)
        return m.group(1).strip() if m else None

    status = grab(r"ENSO Alert System Status:\s*([A-Za-z\u00f1 ]+?)\s+(?=Synopsis:)")
    issued = grab(r"issued by CLIMATE PREDICTION CENTER/NCEP/NWS\s+(\d{1,2}\s+\w+\s+\d{4})")
    next_disc = grab(r"next ENSO Diagnostics Discussion is scheduled for\s+([^.]{5,60})")
    synopsis = grab(r"Synopsis:\s*(.*?)(?=\s*(?:Oceanic and atmospheric|The next ENSO Diagnostics|El Ni\u00f1o/La Ni\u00f1a Current))") or \
        grab(r"Synopsis:\s*([A-Za-z0-9\u00c0-\u024f.,'%()+\-–°\s]{60,700}?)")

    # Niño index values: "The July Niño index values were +1.4°C in Niño-3.4, ..."
    idx = {}
    m = re.search(
        r"The\s+(\w+)\s+Ni\u00f1o index values were\s+(.+?)\s*\[Fig",
        text, flags=re.I,
    )
    if m:
        month_name, values_text = m.group(1), m.group(2)
        idx["month"] = month_name
        # pattern: "+1.4°C in Niño-3.4, +1.7°C in Niño-3, ..." (value precedes region)
        for vm in re.finditer(r"([+-]?\d+\.?\d*)\s*°?C?\s*in\s*(Ni\u00f1o-3\.4|Ni\u00f1o-3|Ni\u00f1o-1\+2|Ni\u00f1o-4)", values_text):
            val, region = float(vm.group(1)), vm.group(2)
            key = {"Ni\u00f1o-3.4": "nino34", "Ni\u00f1o-3": "nino3",
                   "Ni\u00f1o-1+2": "nino12", "Ni\u00f1o-4": "nino4"}[region]
            idx[key] = val

    # Probability language: "greater than 90% chance of a very strong event ..."
    probs = {}
    pm = re.search(r"(greater than|about|around|approximately)\s+(\d{1,3})%\s+chance\s+of\s+([^.,;]{3,60})", text, flags=re.I)
    if pm:
        probs["very_strong_chance"] = f"{pm.group(1)} {pm.group(2)}%"
        probs["very_strong_event"] = re.sub(r"\s+", " ", pm.group(3)).strip()

    strength = None
    if status:
        low = status.lower()
        if "la ni" in low:
            strength = "La Niña Advisory"
        elif "neutral" in low:
            strength = "ENSO Neutral"
        elif "el ni" in low:
            strength = "El Niño Advisory"

    if not status:
        return {}, {"source": "synthetic", "error": "status line not found"}

    result = {
        "advisory": status,
        "strength": strength or status,
        "issued": issued,
        "next_discussion": next_disc,
        "synopsis": synopsis,
        "indices": idx,
        "probabilities": probs,
        "url": CPC_ENSO_DISC_URL,
    }
    log.info("  OK: status=%r issued=%s", status, issued)
    return result, {"source": "live", "url": CPC_ENSO_DISC_URL}


# --------------------------------------------------------------------------
# 6b. CPC official ENSO probabilities (La Niña / Neutral / El Niño by season)
# --------------------------------------------------------------------------
CPC_PROB_URL = ("https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/"
                "enso/roni/probabilities/")


def fetch_cpc_probabilities() -> tuple[list[dict], dict]:
    html = fetch_text(CPC_PROB_URL)
    if not html:
        return [], {"source": "synthetic", "error": "fetch failed"}
    rows = re.findall(r"<tr>(.*?)</tr>", html, flags=re.S | re.I)
    records = []
    for row in rows:
        cells = [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", c)).strip()
                 for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, flags=re.S | re.I)]
        if len(cells) < 4:
            continue
        season = cells[0].split()[0] if cells[0] else ""
        if season not in SEASONS_3:
            continue
        try:
            la, neu, el = (float(cells[1]), float(cells[2]), float(cells[3]))
        except ValueError:
            continue
        records.append({"season": season, "la_nina": la, "neutral": neu, "el_nino": el})
    if not records:
        return [], {"source": "synthetic", "error": "no probability rows parsed"}
    log.info("  OK: %d seasons (latest %s: El Niño %s%%)",
             len(records), records[-1]["season"], records[-1]["el_nino"])
    return records, {"source": "live", "url": CPC_PROB_URL}


# --------------------------------------------------------------------------
# 7. GODAS subsurface temperature via PSL THREDDS OPeNDAP
#    -> Hovmöller anomaly grid, 20°C isotherm depth, Warm Water Volume
# --------------------------------------------------------------------------
GODAS_BASE = "https://psl.noaa.gov/thredds/dodsC/Datasets/godas/pottmp.{year}.nc"
GODAS_CLIM_PATH = "reference/godas_pottmp_clim_1991-2020.json.gz"
GODAS_LON_W = 120   # 120°E
GODAS_LON_E = 280   # 280°E (80°W)
GODAS_DEPTH_MAX = 300.0
GODAS_LAT_HM = 2.0   # Hovmöller: 2°S–2°N
GODAS_LAT_WWV = 5.0  # WWV: 5°S–5°N
GODAS_LON_WWV_A = 180.0  # 180°W
GODAS_LON_WWV_B = 260.0  # 100°W


def _godas_year_files(now: datetime) -> list[int]:
    """Years needed to cover the last 24 months."""
    years = {now.year, now.year - 1}
    if now.month <= 2:
        years.add(now.year - 2)
    return sorted(years)


def _dap_slice(ds_url: str, var: str, idx: tuple[slice, ...]) -> np.ndarray | None:
    """Read a remote DAP2 slice with retries. Returns ndarray or None."""
    for attempt in range(3):
        try:
            with netCDF4.Dataset(ds_url) as ds:
                data = ds.variables[var][idx]
                # GODAS uses _FillValue for land / below-bottom cells -> NaN
                return np.ma.filled(data, np.nan).astype(np.float64)
        except Exception as e:  # noqa: BLE001
            log.warning("  DAP attempt %d failed for %s: %s", attempt + 1, ds_url[:80], e)
            time.sleep(2 * (attempt + 1))
    return None


def _godas_levels(ds_url: str) -> list[float] | None:
    for attempt in range(3):
        try:
            with netCDF4.Dataset(ds_url) as ds:
                return [float(v) for v in ds.variables["level"][:]]
        except Exception as e:  # noqa: BLE001
            log.warning("  DAP levels attempt %d failed: %s", attempt + 1, e)
            time.sleep(2)
    return None


def _load_godas_climatology(out_dir: Path) -> dict | None:
    p = out_dir / GODAS_CLIM_PATH
    if not p.exists():
        p = Path(__file__).resolve().parent.parent / GODAS_CLIM_PATH
    if not p.exists():
        return None
    try:
        import gzip
        with gzip.open(p, "rt", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:  # noqa: BLE001
        log.warning("  climatology unreadable: %s", e)
        return None


def fetch_godas(now: datetime, out_dir: Path) -> tuple[dict, dict]:
    if not HAS_NETCDF4:
        return {}, {"source": "synthetic", "error": "netCDF4 not installed"}

    clim = _load_godas_climatology(out_dir)
    hm_anom, hm_abs, thermo, months = [], [], [], []
    wwv_abs, wwv_anom = [], []
    lon_arr = depth_arr = lat_hm_arr = None
    any_live = False

    for year in _godas_year_files(now):
        url = GODAS_BASE.format(year=year)
        ds_url = url
        levels = _godas_levels(ds_url)
        if levels is None:
            continue
        depth_idx = [i for i, d in enumerate(levels) if d <= GODAS_DEPTH_MAX]
        if not depth_idx:
            continue

        # fetch coordinate arrays
        with netCDF4.Dataset(ds_url) as ds:
            lat_all = np.asarray(ds.variables["lat"][:])
            lon_all = np.asarray(ds.variables["lon"][:])
            time_vals = np.asarray(ds.variables["time"][:])
            ntime = len(time_vals)
        if ntime == 0:
            continue

        la_hm = np.where(np.abs(lat_all) <= GODAS_LAT_HM)[0]
        la_wwv = np.where(np.abs(lat_all) <= GODAS_LAT_WWV)[0]
        lo_hm = np.where((lon_all >= GODAS_LON_W) & (lon_all <= GODAS_LON_E))[0]
        lo_wwv = np.where((lon_all >= GODAS_LON_WWV_A) & (lon_all <= GODAS_LON_WWV_B))[0]
        if len(la_hm) == 0 or len(lo_hm) == 0:
            continue

        d0, d1 = depth_idx[0], depth_idx[-1] + 1
        lat_hm_arr = [float(v) for v in lat_all[la_hm]]
        lon_arr = [float(v) for v in lon_all[lo_hm]]
        depth_arr = [float(levels[i]) for i in depth_idx]

        # Hovmöller box: [time, depth, lat, lon]
        hm = _dap_slice(ds_url, "pottmp",
                        (slice(0, ntime), slice(d0, d1), slice(la_hm[0], la_hm[-1] + 1),
                         slice(lo_hm[0], lo_hm[-1] + 1)))
        if hm is None:
            continue
        hm_c = hm - 273.15  # Kelvin -> °C
        hm_latmean = np.nanmean(hm_c, axis=2)  # [time, depth, lon] (NaN-safe)

        # WWV box: [time, depth, lat, lon] -> box mean
        wwv = _dap_slice(ds_url, "pottmp",
                         (slice(0, ntime), slice(d0, d1), slice(la_wwv[0], la_wwv[-1] + 1),
                          slice(lo_wwv[0], lo_wwv[-1] + 1)))
        if wwv is None:
            continue
        wwv_c = wwv - 273.15  # Kelvin -> °C
        wwv_box = np.nanmean(wwv_c, axis=(2, 3))  # [time, depth] (NaN-safe)

        for t in range(ntime):
            # time in GODAS files: days since 1800-01-01 (approx); derive month label
            try:
                tdate = datetime(1800, 1, 1) + timedelta(days=float(time_vals[t]))
                month_label = tdate.strftime("%Y-%m")
            except (ValueError, OverflowError):
                month_label = f"{year}-{t + 1:02d}"
            months.append(month_label)
            # missing cells (land / below bottom) -> forward-fill along lon for absolute,
            # neutral 0.0 for anomaly (documented in DATA_SCHEMA)
            abs_row = _fill_lon(hm_latmean[t])
            anom_row = np.nan_to_num(_anomaly(hm_latmean[t], month_label, clim, "hm"))
            hm_abs.append([[round(float(v), 2) for v in row] for row in abs_row])
            hm_anom.append([[round(float(v), 2) for v in row] for row in anom_row])
            # thermocline: 20°C isotherm depth per longitude
            thermo.append([_isotherm_depth(depth_arr, hm_latmean[t][:, j]) for j in range(len(lon_arr))])
            wwv_abs.append(round(float(wwv_box[t].mean()), 3))
            wwv_anom.append(round(float(_anomaly(wwv_box[t], month_label, clim, "wwv").mean()), 3))
        any_live = True

    if not any_live:
        return {}, {"source": "synthetic", "error": "all GODAS DAP reads failed"}

    result = {
        "lon": lon_arr,
        "depth": depth_arr,
        "lat": lat_hm_arr,
        "months": months,
        "absolute": hm_abs,          # [month][depth][lon] °C
        "anomaly": hm_anom,          # [month][depth][lon] °C vs 1991-2020 clim
        "thermocline_depth": thermo, # [month][lon] m (20°C isotherm)
        "wwv_absolute": wwv_abs,
        "wwv_anomaly": wwv_anom,
        "climatology": "1991-2020 GODAS" if clim else None,
    }
    source = "live" if clim else "derived"
    note = None if clim else "climatology reference missing; anomalies are raw offsets"
    log.info("  OK: %d months, %d lons, %d depths (source=%s)", len(months), len(lon_arr or []), len(depth_arr or []), source)
    return result, {"source": source, "url": GODAS_BASE.format(year=now.year), "note": note}


def _fill_lon(field: np.ndarray) -> np.ndarray:
    """Forward-fill NaN along the last (lon) axis per row."""
    out = np.array(field, dtype=np.float64)
    for row in out:
        valid = np.where(~np.isnan(row))[0]
        if len(valid) == 0:
            row[:] = 0.0
            continue
        last = valid[0]
        for i in range(len(row)):
            if np.isnan(row[i]):
                row[i] = row[last]
            else:
                last = i
    return out


def _anomaly(field: np.ndarray, month_label: str, clim: dict | None, kind: str) -> np.ndarray:
    """Subtract monthly climatology if available, else return field as-is (caller labels derived)."""
    if clim is None:
        return field
    try:
        m = int(month_label.split("-")[1]) - 1
        clim_arr = np.asarray(clim[kind][m], dtype=float)
        if clim_arr.shape == field.shape:
            return field - clim_arr
    except (KeyError, IndexError, ValueError):
        pass
    return field


def _isotherm_depth(depths: list[float], temp_profile: np.ndarray) -> float | None:
    """Linear interpolation of the depth where temperature crosses 20°C."""
    for i in range(len(depths) - 1):
        t0v, t1v = temp_profile[i], temp_profile[i + 1]
        if np.isnan(t0v) or np.isnan(t1v):
            continue
        if t0v >= 20.0 >= t1v:
            t0, t1 = t0v, t1v
            d0, d1 = depths[i], depths[i + 1]
            if t0 == t1:
                return round(d0, 1)
            return round(float(d0 + (20.0 - t0) * (d1 - d0) / (t1 - t0)), 1)
    return None


# --------------------------------------------------------------------------
# 8. OLR anomaly — CPC blended OLR (1°, daily) via PSL THREDDS
# --------------------------------------------------------------------------
OLR_URL = ("https://psl.noaa.gov/thredds/dodsC/Datasets/cpc_blended_olr-1deg/"
           "olr.cbo-1deg.day.anom.nc")
OLR_LAT_LIM = 40.0
OLR_DAYS = 30


def fetch_olr(now: datetime) -> tuple[dict, dict]:
    if not HAS_NETCDF4:
        return {}, {"source": "synthetic", "error": "netCDF4 not installed"}
    try:
        with netCDF4.Dataset(OLR_URL) as ds:
            lat_all = np.asarray(ds.variables["lat"][:])
            lon_all = np.asarray(ds.variables["lon"][:])
            time_all = np.asarray(ds.variables["time"][:])
            ntime = len(time_all)
            if ntime == 0:
                return {}, {"source": "synthetic", "error": "empty OLR time axis"}
            t0 = max(0, ntime - OLR_DAYS)
            la = np.where(np.abs(lat_all) <= OLR_LAT_LIM)[0]
            data = np.ma.filled(ds.variables["olr"][t0:ntime, la[0]:la[-1] + 1, :], np.nan)
            # mean over the window -> one anomaly map (NaN-safe)
            data = np.nanmean(data, axis=0)
            # last timestamp label
            units = ds.variables["time"].units
            t_last = float(time_all[-1])
            last_date = netCDF4.num2date(t_last, units).strftime("%Y-%m-%d")
    except Exception as e:  # noqa: BLE001
        log.warning("  OLR fetch failed: %s", e)
        return {}, {"source": "synthetic", "error": str(e)}

    result = {
        "lat": [round(float(v), 2) for v in lat_all[la]],
        "lon": [float(v) for v in lon_all],
        "data": [[round(float(v), 1) for v in row] for row in data],
        "date": last_date,
        "window_days": OLR_DAYS,
    }
    log.info("  OK: OLR %d×%d, last %s", len(result["lat"]), len(result["lon"]), last_date)
    return result, {"source": "live", "url": OLR_URL}


# --------------------------------------------------------------------------
# 9. IRI ENSO plume — official figure URL (data table unavailable anonymously)
#    Kept as deterministic fallback table, clearly labelled synthetic.
# --------------------------------------------------------------------------
IRI_PLUME_URL = "https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/"


def fetch_plume(now: datetime) -> tuple[dict, dict]:
    """Plume table is not available as anonymous machine-readable data (IRI login wall).
    Return deterministic stand-in + official figure URL; provenance=synthetic."""
    months = []
    for y in range(now.year, now.year + 2):
        for m in range(1, 13):
            if len(months) >= 15:
                break
            months.append(f"{y}-{m:02d}")

    model_bases = {"CFSv2": 2.71, "ECMWF": 2.65, "UKMO": 2.58,
                   "GFDL": 2.50, "NASA": 2.55, "JMA": 2.50, "Statistical": 2.45}
    peak_months = {"CFSv2": 5, "ECMWF": 5, "UKMO": 4,
                   "GFDL": 6, "NASA": 5, "JMA": 4, "Statistical": 7}
    rng = np.random.RandomState(42)  # deterministic
    models = []
    for name, base in model_bases.items():
        values = []
        for i in range(len(months)):
            dist = i - peak_months[name]
            shape = np.exp(-dist * dist / 18)
            values.append(round(1.8 + (base - 1.8) * shape + (rng.random() - 0.5) * 0.15, 3))
        models.append({"name": name, "values": values})
    consensus = [round(float(np.mean([m["values"][i] for m in models])), 3) for i in range(len(months))]

    log.info("  SYNTHETIC plume: %d months, %d models (data API unavailable)", len(months), len(models))
    return {
        "months": months,
        "models": models,
        "consensus": consensus,
        "official_figure_url": IRI_PLUME_URL,
    }, {"source": "synthetic", "url": IRI_PLUME_URL,
        "note": "IRI data library requires login; official plume figure linked instead"}


# --------------------------------------------------------------------------
# 10. Wind 850hPa anomaly — no anonymous source (IRI login wall)
# --------------------------------------------------------------------------
def fetch_wind850() -> tuple[dict, dict]:
    lats = list(range(-30, 31, 5))
    lons = list(range(120, 291, 5))
    u, v = [], []
    for la in lats:
        urow, vrow = [], []
        for lo in lons:
            x = (lo - 210) / 80.0
            y = la / 30.0
            urow.append(round(6 * np.exp(-(x * x / 0.25 + y * y / 0.35)), 2))
            vrow.append(round(2 * np.exp(-(x * x / 0.2 + y * y / 0.15)) * (-1 if y > 0 else 1), 2))
        u.append(urow)
        v.append(vrow)
    log.info("  SYNTHETIC wind850 (source unavailable)")
    return {"lon": lons, "lat": lats, "u": u, "v": v}, {
        "source": "synthetic",
        "note": "NCEP/NCAR reanalysis via IRI requires login; schematic field",
    }


# --------------------------------------------------------------------------
# 11. NMME precipitation forecast — no anonymous source
# --------------------------------------------------------------------------
def fetch_precip(now: datetime) -> tuple[dict, dict]:
    lats = list(range(-60, 61, 4))
    lons = list(range(0, 361, 4))
    data = []
    for la in lats:
        row = []
        for lo in lons:
            v = 0.0
            if -10 < la < 15 and 30 < lo < 60:
                v += 1.5 * np.exp(-((lo - 45) ** 2 / 80 + (la - 2) ** 2 / 40))
            if 25 < la < 40 and 260 < lo < 290:
                v += 1.8 * np.exp(-((lo - 275) ** 2 / 60 + (la - 32) ** 2 / 50))
            if -20 < la < 0 and 270 < lo < 290:
                v += 2.0 * np.exp(-((lo - 280) ** 2 / 40 + (la + 8) ** 2 / 30))
            if -15 < la < 5 and 100 < lo < 150:
                v -= 2.5 * np.exp(-((lo - 125) ** 2 / 100 + (la + 2) ** 2 / 60))
            if -15 < la < 0 and 310 < lo < 340:
                v -= 1.5 * np.exp(-((lo - 325) ** 2 / 50 + (la + 5) ** 2 / 40))
            if -30 < la < -10 and 20 < lo < 40:
                v -= 1.0 * np.exp(-((lo - 30) ** 2 / 30 + (la + 20) ** 2 / 30))
            row.append(round(v, 2))
        data.append(row)
    log.info("  SYNTHETIC precip forecast (source unavailable)")
    return {"lon": lons, "lat": lats, "anomaly_percent": data}, {
        "source": "synthetic",
        "note": "NMME via IRI requires login; climatological schematic",
    }


# --------------------------------------------------------------------------
# Derived diagnostics
# --------------------------------------------------------------------------
def latest(series: list[dict], key: str = "value") -> dict | None:
    return series[-1] if series else None


def oni_category(v: float) -> str:
    av = abs(v)
    if av < 0.5:
        return "ENSO Neutral"
    if av < 1.0:
        return "Weak El Niño" if v > 0 else "Weak La Niña"
    if av < 1.5:
        return "Moderate El Niño" if v > 0 else "Moderate La Niña"
    if av < 2.0:
        return "Strong El Niño" if v > 0 else "Strong La Niña"
    return "Very Strong El Niño" if v > 0 else "Very Strong La Niña"


def event_comparison(oni: list[dict]) -> dict:
    """Find historical ENSO events and their peak ONI from the full ONI series."""
    events = []
    cur = None
    for rec in oni:
        active = rec["value"] >= 0.5
        if active and cur is None:
            cur = {"start": f"{rec['year']}", "peak": rec["value"],
                   "peak_season": rec["season"], "peak_year": rec["year"]}
        elif active and cur is not None:
            if rec["value"] > cur["peak"]:
                cur["peak"] = rec["value"]
                cur["peak_season"] = rec["season"]
                cur["peak_year"] = rec["year"]
        elif not active and cur is not None:
            cur["end"] = f"{rec['year']}"
            events.append(cur)
            cur = None
    if cur is not None:
        cur["active"] = True
        events.append(cur)
    labels = {
        ("1982", "1983"): "1982–83",
        ("1997", "1998"): "1997–98",
        ("2015", "2016"): "2015–16",
        ("2023", "2024"): "2023–24",
        ("2025", "2026"): "2025–26",
    }
    result = []
    for ev in events:
        if not ev.get("active") and ev["peak"] < 0.6:
            continue  # suppress borderline blips
        key = (ev.get("start", ""), ev.get("end", ""))
        peak_year = int(ev.get("peak_year") or 0)
        ev["label"] = (
            labels.get(key)
            or (f"{peak_year}–{peak_year + 1}" if peak_year
                else f"{ev.get('start','?')}–{ev.get('end', ev.get('start','?'))}")
        )
        if ev.get("active"):
            ev["label"] = f"{peak_year or ev['start']}–{(peak_year or int(ev['start'])) + 1} (developing)"
        ev["category"] = oni_category(ev["peak"])
        result.append(ev)
    return {"events": result}


def compute_changes(prev: dict | None, cur: dict) -> dict:
    """Diff of headline values vs previous run (feeds briefing + UI)."""
    if not prev:
        return {"note": "first run — no previous data"}

    def head(series: list, key: str):
        if not series:
            return None
        last = series[-1]
        return last.get(key) if isinstance(last, dict) else None

    changes = {}
    pairs = [
        ("nino34", "nino34_monthly", "nino34_weekly"),
        ("oni", "oni_monthly", None),
        ("soi", "soi_monthly", None),
        ("mei", "mei_monthly", None),
        ("wwv", "wwv_monthly", None),
    ]
    for name, cur_key, prev_key in pairs:
        prev_series = prev.get(prev_key or cur_key) or prev.get(cur_key, [])
        cur_series = cur.get(cur_key, [])
        pv = head(prev_series, "value") if isinstance(prev_series, list) else None
        cv = head(cur_series, "value") if isinstance(cur_series, list) else None
        if pv is not None and cv is not None and pv != cv:
            changes[name] = {
                "previous": round(pv, 2),
                "current": round(cv, 2),
                "delta": round(cv - pv, 2),
            }
    if prev.get("enso_status") and cur.get("enso_status"):
        ps = prev["enso_status"].get("advisory")
        cs = cur["enso_status"].get("advisory")
        if ps != cs:
            changes["advisory"] = {"previous": ps, "current": cs}
    return changes


# --------------------------------------------------------------------------
# Assemble + write outputs
# --------------------------------------------------------------------------
def _round_json(obj):
    return obj  # values are rounded at parse time


def _safe_json_size(obj) -> int:
    try:
        return len(json.dumps(obj))
    except TypeError:
        return -1


def _find_non_json(obj, path="payload"):
    """Return first non-JSON-serializable value path (debug helper)."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            r = _find_non_json(v, f"{path}.{k}")
            if r:
                return r
    elif isinstance(obj, (list, tuple)):
        for i, v in enumerate(obj):
            r = _find_non_json(v, f"{path}[{i}]")
            if r:
                return r
    elif isinstance(obj, (str, int, float, bool, type(None))):
        return None
    else:
        return f"{path}: {type(obj).__name__} = {obj!r}"
    return None


def write_outputs(out_dir: Path, payload: dict, meta: dict, max_history: int):
    out_dir.mkdir(parents=True, exist_ok=True)
    hist_dir = out_dir / "history"
    hist_dir.mkdir(exist_ok=True)

    (out_dir / "data.json").write_text(json.dumps(payload, indent=1), encoding="utf-8")
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    hist_path = hist_dir / f"{today}.json"
    hist_path.write_text(json.dumps(payload, indent=1), encoding="utf-8")

    # prune old history
    old = sorted(hist_dir.glob("*.json"))
    for p in old[:-max_history]:
        p.unlink()

    # previous.json = state before this run (for diffing on next run)
    log.info("Outputs written to %s (data.json %.1f KB)", out_dir, (out_dir / "data.json").stat().st_size / 1024)


def main() -> int:
    ap = argparse.ArgumentParser(description="El Niño 2026 pipeline v3")
    ap.add_argument("--out", default=".", help="output directory (default: cwd)")
    ap.add_argument("--max-history", type=int, default=30, help="history files to keep")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.out).resolve()
    _setup_logging(out_dir / "pipeline.log")
    now = datetime.now(timezone.utc)
    started = time.time()

    log.info("=" * 70)
    log.info("El Niño 2026 Pipeline v%s — %s", VERSION, now.isoformat())
    log.info("netCDF4: %s", "✓" if HAS_NETCDF4 else "✗")
    log.info("=" * 70)

    endpoints = {}
    status = {}

    def run(name: str, fn):
        t0 = time.time()
        try:
            data, meta = fn()
        except Exception as e:  # noqa: BLE001
            log.error("  %s CRASHED: %s", name, e)
            status[name] = {"source": "error", "error": str(e), "latency_ms": int((time.time() - t0) * 1000)}
            return
        status[name] = {
            "source": meta.get("source", "unknown"),
            "latency_ms": int((time.time() - t0) * 1000),
        }
        for k in ("url", "error", "note"):
            if meta.get(k):
                status[name][k] = meta[k]
        endpoints[name] = data
        log.info("[done] %s (%s, %d ms)", name, meta.get("source"), status[name]["latency_ms"])

    log.info("[1/11] CPC sstoi (monthly Niño regions)...")
    run("cpc_sstoi", fetch_cpc_sstoi)
    log.info("[2/11] CPC wksst (weekly Niño regions)...")
    run("cpc_weekly", fetch_cpc_weekly)
    log.info("[3/11] CPC ONI...")
    run("cpc_oni", fetch_cpc_oni)
    log.info("[4/11] CPC SOI...")
    run("cpc_soi", fetch_cpc_soi)
    log.info("[5/11] PSL MEI v2...")
    run("psl_mei", fetch_psl_mei)
    log.info("[6/11] CPC ENSO Diagnostic Discussion...")
    run("cpc_ensodisc", fetch_cpc_ensodisc)
    log.info("[6b/12] CPC official ENSO probabilities...")
    run("cpc_probabilities", fetch_cpc_probabilities)
    log.info("[7/12] GODAS subsurface (Hovmöller/WWV/thermocline)...")
    run("godas", lambda: fetch_godas(now, out_dir))
    log.info("[8/11] OLR anomaly (CPC blended, 1°)...")
    run("olr", lambda: fetch_olr(now))
    log.info("[9/11] IRI ENSO plume...")
    run("plume", lambda: fetch_plume(now))
    log.info("[10/11] 850hPa wind anomaly...")
    run("wind850", fetch_wind850)
    log.info("[11/11] NMME precipitation forecast...")
    run("precip", lambda: fetch_precip(now))

    # ---------------- assemble payload ----------------
    sstoi = endpoints.get("cpc_sstoi", {})
    weekly = endpoints.get("cpc_weekly", {})
    oni = endpoints.get("cpc_oni", [])
    soi = endpoints.get("cpc_soi", [])
    mei = endpoints.get("psl_mei", [])
    godas = endpoints.get("godas", {})
    olr = endpoints.get("olr", {})
    plume = endpoints.get("plume", {})
    wind = endpoints.get("wind850", {})
    precip = endpoints.get("precip", {})
    status_block = endpoints.get("cpc_ensodisc", {})

    wwv_monthly = []
    if godas.get("wwv_anomaly"):
        for i, m in enumerate(godas.get("months", [])):
            wwv_monthly.append({"date": f"{m}-15", "value": godas["wwv_anomaly"][i]})

    nino34_monthly = sstoi.get("nino34", [])
    nino34_weekly = weekly.get("nino34", [])
    oni_monthly = oni
    soi_monthly = soi
    mei_monthly = mei

    current = {
        "nino34": latest(nino34_weekly) or latest(nino34_monthly),
        "oni": latest(oni_monthly),
        "soi": latest(soi_monthly),
        "mei": latest(mei_monthly),
        "wwv": latest(wwv_monthly),
    }
    if status_block.get("indices"):
        current["nino34_official"] = status_block["indices"]

    category = None
    if oni_monthly:
        last_oni = oni_monthly[-1]["value"]
        category = oni_category(last_oni)
    elif current.get("nino34"):
        category = oni_category(current["nino34"]["value"])

    payload = {
        "schema_version": VERSION,
        "generated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "nino34_monthly": nino34_monthly,
        "nino34_weekly": nino34_weekly[-52:],
        "oni_monthly": oni_monthly,
        "soi_monthly": soi_monthly,
        "mei_monthly": mei_monthly,
        "wwv_monthly": wwv_monthly,
        "olr_anomaly": olr,
        "subsurface_temp": {
            "lon": godas.get("lon", []),
            "depth": godas.get("depth", []),
            "lat": godas.get("lat", []),
            "months": godas.get("months", []),
            "absolute": godas.get("absolute", []),
            "anomaly": godas.get("anomaly", []),
            "thermocline_depth": godas.get("thermocline_depth", []),
            "climatology": godas.get("climatology"),
        },
        "wind850_anomaly": wind,
        "ensemble_plume": plume,
        "precip_forecast": precip,
        "enso_probabilities": endpoints.get("cpc_probabilities", []),
        "enso_status": {
            "advisory": status_block.get("advisory", "Unknown"),
            "strength": status_block.get("strength") or category or "Unknown",
            "category": category,
            "issued": status_block.get("issued"),
            "next_discussion": status_block.get("next_discussion"),
            "synopsis": status_block.get("synopsis"),
            "indices": status_block.get("indices", {}),
            "probabilities": status_block.get("probabilities", {}),
            "url": CPC_ENSO_DISC_URL,
        },
        "current": current,
        "comparison": event_comparison(oni_monthly) if oni_monthly else {"events": []},
        "sources": {
            "nino34": status.get("cpc_sstoi", {}).get("source"),
            "nino34_weekly": status.get("cpc_weekly", {}).get("source"),
            "oni": status.get("cpc_oni", {}).get("source"),
            "soi": status.get("cpc_soi", {}).get("source"),
            "mei": status.get("psl_mei", {}).get("source"),
            "subsurface": status.get("godas", {}).get("source"),
            "olr": status.get("olr", {}).get("source"),
            "plume": status.get("plume", {}).get("source"),
            "wind850": status.get("wind850", {}).get("source"),
            "precip": status.get("precip", {}).get("source"),
            "enso_status": status.get("cpc_ensodisc", {}).get("source"),
            "enso_probabilities": status.get("cpc_probabilities", {}).get("source"),
        },
        "_pipeline": {
            "version": VERSION,
            "timestamp": now.isoformat(),
            "duration_sec": round(time.time() - started, 1),
            "status": status,
            "errors": [v.get("error") for v in status.values() if v.get("source") == "error"],
        },
    }

    # diff vs previous run (history/latest.json kept as previous.json)
    prev_path = out_dir / "history" / "previous.json"
    prev = None
    if prev_path.exists():
        try:
            prev = json.loads(prev_path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            prev = None
    payload["changes_since_previous"] = compute_changes(prev, payload)

    _bad = _find_non_json(payload)
    if _bad:
        log.error("NON-JSON VALUE FOUND: %s", _bad)

    # meta.json — health matrix
    live_count = sum(1 for v in status.values() if v.get("source") == "live")
    synthetic_count = sum(1 for v in status.values() if v.get("source") == "synthetic")
    meta = {
        "schema_version": VERSION,
        "generated_at": payload["generated_at"],
        "health": status,
        "summary": {
            "endpoints_total": len(status),
            "live": live_count,
            "derived": sum(1 for v in status.values() if v.get("source") == "derived"),
            "synthetic": synthetic_count,
            "error": sum(1 for v in status.values() if v.get("source") == "error"),
        },
        "debug_non_json": _find_non_json(payload),
        "checksum": {
            "data.json_size_bytes": _safe_json_size(payload),
        },
    }

    write_outputs(out_dir, payload, meta, args.max_history)

    # keep a copy of the new payload as previous.json for the next run's diff
    (out_dir / "history" / "previous.json").write_text(json.dumps(payload), encoding="utf-8")

    log.info("-" * 70)
    log.info("Health: %d/%d live · %d derived · %d synthetic · %d error",
             meta["summary"]["live"], meta["summary"]["endpoints_total"],
             meta["summary"]["derived"], meta["summary"]["synthetic"],
             meta["summary"]["error"])
    log.info("Pipeline finished in %.1fs", time.time() - started)
    return 0 if meta["summary"]["error"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
