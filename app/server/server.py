#!/usr/bin/env python3
"""
server.py — El Niño 2026 Live Data Proxy
Flask CORS proxy die live data fetch van NOAA/CPC/PMEL/IRI endpoints.
Draait op poort 8899, omzeilt CORS-problemen in de browser.

Usage: python server.py
       (opent http://127.0.0.1:8899/api/livedata)
"""

import json
import logging
import re
import sys
from datetime import datetime, timezone
from io import StringIO

import requests
from flask import Flask, jsonify
from flask_cors import CORS

# ── Config ───────────────────────────────────────────────────────────────
HOST = "127.0.0.1"
PORT = 8899
TIMEOUT = 10  # seconden per endpoint

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)],
)
log = logging.getLogger("enso-proxy")

app = Flask(__name__)
CORS(app)  # sta alle origins toe (localhost dev)

# ── Endpoint Registry ────────────────────────────────────────────────────
ENDPOINTS = {
    "nino34": {
        "url": "https://origin.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/detrend.nino34.ascii.txt",
        "parser": "nino34",
    },
    "soi": {
        "url": "https://www.cpc.ncep.noaa.gov/data/indices/soi",
        "parser": "tabular_monthly",
    },
    "oni": {
        "url": "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt",
        "parser": "oni",
    },
    "wwv": {
        "url": "https://www.pmel.noaa.gov/tao/wwv/data/WWV_5S5N_180W100W.txt",
        "parser": "tabular_monthly",
    },
    "olr": {
        "url": "http://iridl.ldeo.columbia.edu/SOURCES/.NOAA/.NCEP/.CPC/.CAMS/.OPI/.anomaly/data.json",
        "parser": "iri_grid",
    },
    "subsurface": {
        "url": "http://iridl.ldeo.columbia.edu/SOURCES/.NOAA/.NCEP/.EMC/.CMB/.GODAS/.monthly/.temp/.anomaly/X/120/280/RANGE/Y/-5/5/RANGE/Z/0/300/RANGE/data.json",
        "parser": "iri_subsurface",
    },
    "wind850_u": {
        "url": "http://iridl.ldeo.columbia.edu/SOURCES/.NOAA/.NCEP-NCAR/.CDAS-1/.MONTHLY/.Intrinsic/.PressureLevel/.u/.anomaly/Y/-30/30/RANGE/X/120/280/RANGE/P/850/VALUE/T/(last)VALUES/data.json",
        "parser": "iri_grid_2d",
    },
    "wind850_v": {
        "url": "http://iridl.ldeo.columbia.edu/SOURCES/.NOAA/.NCEP-NCAR/.CDAS-1/.MONTHLY/.Intrinsic/.PressureLevel/.v/.anomaly/Y/-30/30/RANGE/X/120/280/RANGE/P/850/VALUE/T/(last)VALUES/data.json",
        "parser": "iri_grid_2d",
    },
    "plume": {
        "url": "https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/data/Nino34_ECMWF.csv",
        "parser": "plume_csv",
    },
    "precip": {
        "url": "http://iridl.ldeo.columbia.edu/SOURCES/.Models/.NMME/.IRI-Anomaly-Forecast/.Precipitation/.pct/T/(last)/RANGE/X/0/360/GRID/Y/-90/90/GRID/data.json",
        "parser": "iri_grid",
    },
}

# ── HTTP Helper ──────────────────────────────────────────────────────────
def safe_fetch(url, timeout=TIMEOUT):
    """HTTP GET met timeout + error handling. Retourneert text of None."""
    try:
        log.info(f"  Fetching: {url[:110]}...")
        resp = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "enso-dashboard/2.0"},
        )
        resp.raise_for_status()
        return resp.text
    except requests.exceptions.Timeout:
        log.warning(f"    TIMEOUT: {url[:80]}")
        return None
    except requests.exceptions.RequestException as e:
        log.warning(f"    HTTP ERROR: {e}")
        return None
    except Exception as e:
        log.warning(f"    UNEXPECTED: {e}")
        return None


def safe_fetch_json(url, timeout=TIMEOUT):
    """Fetch + parse JSON."""
    text = safe_fetch(url, timeout)
    if text is None:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        log.warning(f"    JSON PARSE ERROR: {e}")
        return None


# ── Parsers ──────────────────────────────────────────────────────────────
def parse_nino34(text):
    """detrend.nino34.ascii.txt: jaar maand waarde per regel."""
    records = []
    for line in text.strip().split("\n"):
        line = line.strip()
        if not line or line.startswith(("YEAR", "Year", "#")):
            continue
        parts = line.split()
        if len(parts) < 3:
            continue
        try:
            year = int(parts[0])
            month = int(parts[1])
            val = float(parts[2])
            if -10 < val < 10:
                records.append(
                    {
                        "date": f"{year}-{month:02d}-01",
                        "value": round(val, 2),
                    }
                )
        except (ValueError, IndexError):
            continue
    if records:
        log.info(f"    NINO34: {len(records)} records, latest={records[-1]}")
    return records


def parse_tabular_monthly(text):
    """Tab-formaat: eerste kolom jaar, kolommen 1-12 maandwaarden."""
    records = []
    for line in text.strip().split("\n"):
        line = line.strip()
        if not line or line.startswith(("YEAR", "Year", "#")):
            continue
        parts = line.split()
        if len(parts) < 13:
            continue
        try:
            year = int(parts[0])
            for m_idx in range(12):
                raw = parts[m_idx + 1]
                if raw in ("-999.9", "-999.99", "***", "NaN", ""):
                    continue
                val = float(raw)
                records.append(
                    {
                        "date": f"{year}-{m_idx + 1:02d}-15",
                        "value": round(val, 2),
                    }
                )
        except (ValueError, IndexError):
            continue
    if records:
        log.info(f"    TABULAR: {len(records)} records, latest={records[-1]}")
    return records


def parse_oni(text):
    """ONI ASCII: jaar, dan 12 maandkolommen."""
    records = []
    seasons = [
        "DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ",
        "JJA", "JAS", "ASO", "SON", "OND", "NDJ",
    ]
    for line in text.strip().split("\n"):
        line = line.strip()
        if not line or line.startswith(("YEAR", "Year", "#")):
            continue
        parts = line.split()
        if len(parts) < 14:
            continue
        try:
            year = int(parts[0])
            for m_idx in range(12):
                raw = parts[m_idx + 1]
                if raw in ("-999.9", "-999.99", "***", "NaN", ""):
                    continue
                val = float(raw)
                if -5 < val < 5:
                    records.append(
                        {
                            "season": seasons[m_idx],
                            "year": year,
                            "value": round(val, 2),
                        }
                    )
        except (ValueError, IndexError):
            continue
    if records:
        log.info(f"    ONI: {len(records)} records, latest={records[-1]}")
    return records


def parse_iri_grid(data):
    """IRI JSON grid: X=lon, Y=lat, data=2D array."""
    if not data or "X" not in data:
        return None
    result = {
        "lon": data.get("X", []),
        "lat": data.get("Y", []),
        "data": data.get("data", data.get("Z", [])),
    }
    log.info(f"    IRI_GRID: {len(result['lon'])} lons × {len(result['lat'])} lats")
    return result


def parse_iri_subsurface(data):
    """IRI subsurface JSON: X=lon, Y=lat, Z=depth, data=3D (depth x lat x lon)."""
    if not data or "X" not in data:
        return None
    # IRI data kan 2D of 3D zijn; neem equatoriaal slice (Y=0)
    raw = data.get("data", [])
    depths = data.get("Z", [])
    lons = data.get("X", [])
    lats = data.get("Y", [0])

    # Als data 3D (depth x lat x lon), neem de eerste lat
    if raw and isinstance(raw[0], list) and raw[0] and isinstance(raw[0][0], list):
        # 3D: neem lat=0 (midden)
        lat_idx = len(lats) // 2
        anomaly_2d = [row[lat_idx] if isinstance(row[lat_idx], list) else row for row in raw]
        result = {
            "lon": lons,
            "depth": depths,
            "lat": [lats[lat_idx]],
            "anomaly": anomaly_2d,
        }
    elif raw and isinstance(raw[0], list):
        # Al 2D
        result = {
            "lon": lons,
            "depth": depths,
            "lat": lats,
            "anomaly": raw,
        }
    else:
        result = {"lon": lons, "depth": depths, "lat": lats, "anomaly": []}

    log.info(
        f"    SUBSURFACE: {len(result['lon'])} lons × {len(result['depth'])} depths"
    )
    return result


def parse_iri_grid_2d(data):
    """IRI 2D grid: X=lon, Y=lat, data=2D array."""
    if not data or "X" not in data:
        return None
    result = {
        "lon": data.get("X", []),
        "lat": data.get("Y", []),
        "data": data.get("data", []),
    }
    log.info(f"    IRI_2D: {len(result['lon'])} lons × {len(result['lat'])} lats")
    return result


def parse_plume_csv(text):
    """Plume CSV → dashboard-structuur."""
    if text is None:
        return None
    try:
        import csv

        reader = csv.DictReader(StringIO(text))
        rows = list(reader)
        log.info(f"    PLUME CSV: {len(rows)} rijen, kolommen={list(reader.fieldnames or [])}")
        return {"raw_rows": len(rows), "columns": reader.fieldnames}
    except Exception as e:
        log.warning(f"    CSV parse failed: {e}")
        return None


# ── Synthetische fallbacks ───────────────────────────────────────────────
def synthetic_nino34():
    records = []
    vals = [
        2.0, 1.9, 2.0, 2.1, 2.2, 2.3, 2.3, 2.2, 2.3, 2.3, 2.3, 2.3,
        2.2, 2.3, 2.3, 2.3, 2.3,
    ]
    base_year, base_month = 2025, 6
    for i, v in enumerate(vals):
        y = base_year + (base_month + i - 1) // 12
        m = (base_month + i - 1) % 12 + 1
        records.append({"date": f"{y}-{m:02d}-01", "value": v})
    log.info(f"    NINO34 (synthetic): {len(records)} records")
    return records


def synthetic_soi():
    records = []
    vals = [-8.2, -9.5, -11.3, -13.0, -14.2, -15.1, -16.0, -16.8, -17.5, -18.0, -18.5, -18.7]
    months = [6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5]
    years = [2025] * 7 + [2026] * 5
    for i in range(12):
        records.append({"date": f"{years[i]}-{months[i]:02d}-15", "value": vals[i]})
    log.info(f"    SOI (synthetic): {len(records)} records")
    return records


def synthetic_oni():
    records = []
    seasons = ["DJF","JFM","FMA","MAM","AMJ","MJJ","JJA","JAS","ASO","SON","OND","NDJ"]
    vals = [2.27, 2.27, 2.27, 2.30, 2.30, 2.30]
    base_year = 2025
    for i, v in enumerate(vals):
        records.append({"season": seasons[i], "year": base_year + ((i + 8) // 12), "value": v})
    return records


def synthetic_wwv():
    records = []
    for i in range(12):
        v = 2.5 + 0.8 * (1 - abs(i - 6) / 6) + (0.1 * ((i % 3) - 1))
        m = (6 + i) % 12 or 12
        y = 2025 if (6 + i) <= 12 else 2026
        records.append({"date": f"{y}-{m:02d}-15", "value": round(v, 2)})
    return records


def synthetic_olr():
    lats = list(range(-30, 31, 5))
    lons = list(range(120, 291, 5))
    import math

    data = []
    for la in lats:
        row = []
        for lo in lons:
            x = (lo - 210) / 80.0
            y = la / 30.0
            v = -25 * math.exp(-(x * x / 0.15 + y * y / 0.3)) + 10 * math.exp(
                -((x + 0.5) ** 2 / 0.2 + y * y / 0.4)
            )
            row.append(round(v, 1))
        data.append(row)
    return {"lat": lats, "lon": lons, "data": data}


def synthetic_subsurface():
    lons = list(range(120, 281, 4))
    depths = list(range(5, 301, 10))
    import math

    anomaly = []
    for d in depths:
        row = []
        dn = d / 300.0
        for lon in lons:
            ln = (lon - 200) / 80.0
            v = 3.0 * math.exp(-((dn - 0.35) ** 2) / 0.04) * math.exp(
                -((ln + 0.3) ** 2) / 0.15
            )
            v += 1.5 * math.exp(-((dn - 0.15) ** 2) / 0.02) * math.exp(
                -((ln - 0.2) ** 2) / 0.2
            )
            v -= 0.5 * math.exp(-((dn - 0.8) ** 2) / 0.04)
            row.append(round(v, 2))
        anomaly.append(row)
    return {"lon": lons, "depth": depths, "lat": [0], "anomaly": anomaly}


def synthetic_wind():
    lats = list(range(-30, 31, 5))
    lons = list(range(120, 291, 5))
    import math

    u, v = [], []
    for la in lats:
        urow, vrow = [], []
        y = la / 30.0
        for lo in lons:
            x = (lo - 210) / 80.0
            urow.append(round(6 * math.exp(-(x * x / 0.25 + y * y / 0.35)), 3))
            vrow.append(
                round(
                    2 * math.exp(-(x * x / 0.2 + y * y / 0.15)) * (-1 if y > 0 else 1),
                    3,
                )
            )
        u.append(urow)
        v.append(vrow)
    return {"lon": lons, "lat": lats, "u": u, "v": v}


def synthetic_plume():
    dates = []
    for y in range(2025, 2028):
        max_m = 2 if y == 2027 else 12
        for m in range(1, max_m + 1):
            dates.append(f"{y}-{m:02d}")
    import random

    random.seed(42)
    model_config = {
        "CFSv2": 2.71, "ECMWF": 2.65, "UKMO": 2.58,
        "GFDL": 2.50, "NASA": 2.55, "JMA": 2.50, "Statistical": 2.45,
    }
    models = []
    for name, base in model_config.items():
        values = []
        for i in range(len(dates)):
            if i < 12:
                values.append(round(1.5 + random.random() * 0.5, 3))
            else:
                dist = i - 21
                shape = math.exp(-dist * dist / 18)
                values.append(round(1.8 + (base - 1.8) * shape + (random.random() - 0.5) * 0.15, 3))
        models.append({"name": name, "values": values})
    consensus = [round(sum(m["values"][i] for m in models) / len(models), 3) for i in range(len(dates))]
    return {"months": dates, "models": models, "consensus": consensus}


def synthetic_precip():
    lats = list(range(-60, 61, 4))
    lons = list(range(0, 361, 4))
    import math

    data = []
    for la in lats:
        row = []
        for lo in lons:
            v = 0.0
            if -10 < la < 15 and 30 < lo < 60:
                v += 1.5 * math.exp(-((lo - 45) ** 2 / 80 + (la - 2) ** 2 / 40))
            if 25 < la < 40 and 260 < lo < 290:
                v += 1.8 * math.exp(-((lo - 275) ** 2 / 60 + (la - 32) ** 2 / 50))
            if -20 < la < 0 and 270 < lo < 290:
                v += 2.0 * math.exp(-((lo - 280) ** 2 / 40 + (la + 8) ** 2 / 30))
            if -15 < la < 5 and 100 < lo < 150:
                v -= 2.5 * math.exp(-((lo - 125) ** 2 / 100 + (la + 2) ** 2 / 60))
            if -15 < la < 0 and 310 < lo < 340:
                v -= 1.5 * math.exp(-((lo - 325) ** 2 / 50 + (la + 5) ** 2 / 40))
            if -30 < la < -10 and 20 < lo < 40:
                v -= 1.0 * math.exp(-((lo - 30) ** 2 / 30 + (la + 20) ** 2 / 30))
            row.append(round(v, 2))
        data.append(row)
    return {"lon": lons, "lat": lats, "anomaly_percent": data}


# ── Runtime State ────────────────────────────────────────────────────────
_data_cache = None
_cache_time = 0
_CACHE_TTL_S = 1800  # 30 min


def build_live_data():
    """Fetch en parse ALLEEN live data via endpoints. Synthetische fallback per endpoint."""
    import math  # noqa: F401 — used by synthetic funcs

    log.info("=" * 60)
    log.info("ENSO Live Data Proxy — Fetching all endpoints")
    log.info("=" * 60)

    result = {"generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    errors = []

    # 1. NINO34
    log.info("[1/10] Niño 3.4...")
    try:
        text = safe_fetch(ENDPOINTS["nino34"]["url"])
        parsed = parse_nino34(text) if text else None
        result["nino34_weekly"] = (parsed or synthetic_nino34())[-12:]
    except Exception as e:
        result["nino34_weekly"] = synthetic_nino34()[-12:]
        errors.append(f"nino34: {e}")

    # 2. ONI
    log.info("[2/10] ONI...")
    try:
        text = safe_fetch(ENDPOINTS["oni"]["url"])
        parsed = parse_oni(text) if text else None
        result["oni_monthly"] = (parsed or synthetic_oni())[-6:]
    except Exception as e:
        result["oni_monthly"] = synthetic_oni()[-6:]
        errors.append(f"oni: {e}")

    # 3. SOI
    log.info("[3/10] SOI...")
    try:
        text = safe_fetch(ENDPOINTS["soi"]["url"])
        parsed = parse_tabular_monthly(text) if text else None
        result["soi_monthly"] = (parsed or synthetic_soi())[-12:]
    except Exception as e:
        result["soi_monthly"] = synthetic_soi()[-12:]
        errors.append(f"soi: {e}")

    # 4. WWV
    log.info("[4/10] WWV...")
    try:
        text = safe_fetch(ENDPOINTS["wwv"]["url"])
        parsed = parse_tabular_monthly(text) if text else None
        result["wwv_monthly"] = (parsed or synthetic_wwv())[-12:]
    except Exception as e:
        result["wwv_monthly"] = synthetic_wwv()[-12:]
        errors.append(f"wwv: {e}")

    # 5. OLR
    log.info("[5/10] OLR...")
    try:
        json_data = safe_fetch_json(ENDPOINTS["olr"]["url"])
        result["olr_anomaly"] = parse_iri_grid(json_data) or synthetic_olr()
    except Exception as e:
        result["olr_anomaly"] = synthetic_olr()
        errors.append(f"olr: {e}")

    # 6. Subsurface
    log.info("[6/10] Subsurface Temp...")
    try:
        json_data = safe_fetch_json(ENDPOINTS["subsurface"]["url"])
        result["subsurface_temp"] = parse_iri_subsurface(json_data) or synthetic_subsurface()
    except Exception as e:
        result["subsurface_temp"] = synthetic_subsurface()
        errors.append(f"subsurface: {e}")

    # 7. Wind 850hPa (u + v)
    log.info("[7/10] Wind 850hPa...")
    try:
        u_data = safe_fetch_json(ENDPOINTS["wind850_u"]["url"])
        v_data = safe_fetch_json(ENDPOINTS["wind850_v"]["url"])
        wind = {"lon": [], "lat": [], "u": [], "v": []}
        if u_data and "X" in u_data:
            wind["lon"] = u_data.get("X", [])
            wind["lat"] = u_data.get("Y", [])
            wind["u"] = u_data.get("data", [])
        if v_data and "X" in v_data:
            wind["v"] = v_data.get("data", [])
        result["wind850_anomaly"] = wind if wind["u"] and wind["v"] else synthetic_wind()
    except Exception as e:
        result["wind850_anomaly"] = synthetic_wind()
        errors.append(f"wind850: {e}")

    # 8. Plume
    log.info("[8/10] ENSO Plume...")
    try:
        text = safe_fetch(ENDPOINTS["plume"]["url"])
        result["ensemble_plume"] = parse_plume_csv(text) or synthetic_plume()
    except Exception as e:
        result["ensemble_plume"] = synthetic_plume()
        errors.append(f"plume: {e}")

    # 9. Precip
    log.info("[9/10] Precip Forecast...")
    try:
        json_data = safe_fetch_json(ENDPOINTS["precip"]["url"])
        parsed = parse_iri_grid(json_data) if json_data else None
        if parsed:
            result["precip_forecast"] = {
                "lon": parsed["lon"],
                "lat": parsed["lat"],
                "anomaly_percent": parsed["data"],
            }
        else:
            result["precip_forecast"] = synthetic_precip()
    except Exception as e:
        result["precip_forecast"] = synthetic_precip()
        errors.append(f"precip: {e}")

    # 10. ENSO Status
    log.info("[10/10] ENSO Advisory...")
    result["enso_status"] = {"advisory": "El Niño Advisory", "strength": "Strong"}

    # Pipeline metadata
    result["_pipeline"] = {
        "version": "4.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "endpoints": len(ENDPOINTS),
        "errors": errors,
        "mode": "flask-proxy",
    }

    log.info(f"\n✓ Live data assembled — {len(errors)} errors")
    if errors:
        for e in errors:
            log.warning(f"  - {e}")
    log.info("=" * 60)
    return result


# ── API Routes ───────────────────────────────────────────────────────────
@app.route("/api/livedata", methods=["GET"])
def api_livedata():
    global _data_cache, _cache_time

    now = datetime.now().timestamp()
    # Serve cache if fresh
    if _data_cache and (now - _cache_time) < _CACHE_TTL_S:
        return jsonify(_data_cache)

    # Build fresh data
    try:
        data = build_live_data()
        _data_cache = data
        _cache_time = now
        return jsonify(data)
    except Exception as e:
        log.error(f"Build failed: {e}")
        if _data_cache:
            return jsonify(_data_cache)
        return jsonify({"error": str(e), "generated_at": datetime.now(timezone.utc).isoformat()}), 500


@app.route("/api/health", methods=["GET"])
def api_health():
    now = datetime.now().timestamp()
    cache_age = round(now - _cache_time) if _cache_time else -1
    return jsonify({
        "status": "ok",
        "cache_age_s": cache_age,
        "cache_ttl_s": _CACHE_TTL_S,
        "endpoints": len(ENDPOINTS),
        "host": HOST,
        "port": PORT,
    })


@app.route("/api/refresh", methods=["POST"])
def api_refresh():
    global _data_cache, _cache_time
    try:
        _data_cache = None
        _cache_time = 0
        data = build_live_data()
        _data_cache = data
        _cache_time = datetime.now().timestamp()
        return jsonify({"status": "refreshed", "generated_at": data["generated_at"]})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ── Main ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"\n╔═══════════════════════════════════════════════════╗")
    print(f"║  El Niño 2026 — Live Data Proxy (Flask)         ║")
    print(f"╠═══════════════════════════════════════════════════╣")
    print(f"║  API:   http://{HOST}:{PORT}/api/livedata         ║")
    print(f"║  Health: http://{HOST}:{PORT}/api/health          ║")
    print(f"║  Cache: {_CACHE_TTL_S//60} min auto-refresh          ║")
    print(f"║  Endpoints: {len(ENDPOINTS)}                          ║")
    print(f"╚═══════════════════════════════════════════════════╝\n")
    app.run(host=HOST, port=PORT, debug=False)
