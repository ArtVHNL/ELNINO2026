#!/usr/bin/env python3
"""
build_godas_climatology.py — one-time builder for the GODAS monthly climatology
================================================================================
Downloads the equatorial-band GODAS potential temperature fields for 1991–2020
from the NOAA PSL THREDDS OPeNDAP server and stores the monthly climatology as
a compact gzipped JSON reference file used by fetch_data.py to compute
subsurface temperature anomalies and the Warm Water Volume index.

Output: reference/godas_pottmp_clim_1991-2020.json.gz
  {
    "hm":  [12][depth][lon]  lat-averaged (2°S–2°N) monthly mean temperature [°C]
    "wwv": [12][depth]       5°S–5°N, 180°W–100°W, box-mean monthly temperature [°C]
    "depth": [...], "lon": [...], "years": [1991, ..., 2020], "units": "degC"
  }

Run once; the reference file is committed to the repository.
"""

import gzip
import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path

import numpy as np
import netCDF4

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("godas-clim")

GODAS_BASE = "https://psl.noaa.gov/thredds/dodsC/Datasets/godas/pottmp.{year}.nc"
YEARS = list(range(1991, 2021))
DEPTH_MAX = 300.0
LAT_HM = 2.0
LAT_WWV = 5.0
LON_HM = (120.0, 280.0)
LON_WWV = (180.0, 260.0)
OUT = Path(__file__).resolve().parent.parent / "reference" / "godas_pottmp_clim_1991-2020.json.gz"


def read_slice(url: str, idx: tuple) -> np.ndarray | None:
    for attempt in range(3):
        try:
            with netCDF4.Dataset(url) as ds:
                return np.asarray(ds.variables["pottmp"][idx], dtype=np.float64)
        except Exception as e:  # noqa: BLE001
            log.warning("  attempt %d failed for %s: %s", attempt + 1, url[-40:], e)
            time.sleep(3 * (attempt + 1))
    return None


def main() -> int:
    log.info("Building GODAS 1991–2020 monthly climatology (equatorial band)")
    log.info("Output: %s", OUT)

    # Discover grid once
    url = GODAS_BASE.format(year=1991)
    with netCDF4.Dataset(url) as ds:
        lat_all = np.asarray(ds.variables["lat"][:])
        lon_all = np.asarray(ds.variables["lon"][:])
        levels = [float(v) for v in ds.variables["level"][:]]
    depth_idx = [i for i, d in enumerate(levels) if d <= DEPTH_MAX]
    d0, d1 = depth_idx[0], depth_idx[-1] + 1
    depth_arr = [levels[i] for i in depth_idx]
    la_hm = np.where(np.abs(lat_all) <= LAT_HM)[0]
    la_wwv = np.where(np.abs(lat_all) <= LAT_WWV)[0]
    lo_hm = np.where((lon_all >= LON_HM[0]) & (lon_all <= LON_HM[1]))[0]
    lo_wwv = np.where((lon_all >= LON_WWV[0]) & (lon_all <= LON_WWV[1]))[0]
    lon_arr = [float(v) for v in lon_all[lo_hm]]
    log.info("grid: lat=%d points, lon=%d (hm), depth=%d levels (≤%gm)",
             len(lat_all), len(lo_hm), len(depth_arr), DEPTH_MAX)

    n_months = 12
    n_depth = len(depth_arr)
    hm_sum = np.zeros((n_months, n_depth, len(lo_hm)))
    hm_cnt = np.zeros(n_months, dtype=int)
    wwv_sum = np.zeros((n_months, n_depth))
    wwv_cnt = np.zeros(n_months, dtype=int)

    for year in YEARS:
        url = GODAS_BASE.format(year=year)
        t0 = time.time()
        hm = read_slice(url, (slice(0, 12), slice(d0, d1),
                              slice(la_hm[0], la_hm[-1] + 1), slice(lo_hm[0], lo_hm[-1] + 1)))
        wwv = read_slice(url, (slice(0, 12), slice(d0, d1),
                               slice(la_wwv[0], la_wwv[-1] + 1), slice(lo_wwv[0], lo_wwv[-1] + 1)))
        if hm is None or wwv is None:
            log.warning("  %d skipped (read failed)", year)
            continue
        hm_c = hm - 273.15
        wwv_c = wwv - 273.15
        ntime = min(hm.shape[0], 12)
        for t in range(ntime):
            hm_sum[t] += hm_c[t].mean(axis=1)   # lat-average
            wwv_sum[t] += wwv_c[t].mean(axis=(1, 2))
            hm_cnt[t] += 1
            wwv_cnt[t] += 1
        log.info("  %d done in %.1fs (months=%d)", year, time.time() - t0, ntime)

    ok_months = [i for i in range(12) if hm_cnt[i] >= 20]
    if len(ok_months) < 12:
        log.warning("Only %d months have sufficient coverage: %s", len(ok_months), ok_months)

    hm_clim = [hm_sum[m] / hm_cnt[m] for m in range(12)]
    wwv_clim = [wwv_sum[m] / wwv_cnt[m] for m in range(12)]

    payload = {
        "hm": [[[round(float(v), 3) for v in row] for row in hm_clim[m]] for m in range(12)],
        "wwv": [[round(float(v), 3) for v in wwv_clim[m]] for m in range(12)],
        "depth": depth_arr,
        "lon": lon_arr,
        "years": YEARS,
        "units": "degC",
        "built_at": datetime.utcnow().isoformat() + "Z",
        "source": "NOAA PSL THREDDS GODAS pottmp",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT, "wt", encoding="utf-8") as f:
        json.dump(payload, f)
    log.info("Wrote %s (%.1f KB gz)", OUT, OUT.stat().st_size / 1024)
    return 0


if __name__ == "__main__":
    sys.exit(main())
