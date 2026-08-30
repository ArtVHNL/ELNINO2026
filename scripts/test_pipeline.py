"""
test_pipeline.py — unit tests for the El Niño 2026 data pipeline v3.
Run:  pytest scripts/test_pipeline.py   (no network required)
"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fetch_data as fd  # noqa: E402


# --------------------------------------------------------------------------
# Fixture builders — generate >= 24 rows so parsers accept them as live
# --------------------------------------------------------------------------
def make_sstoi(n=40, last_vals=None):
    lines = ["YR MON  NINO1+2   ANOM   NINO3    ANOM   NINO4    ANOM NINO3.4    ANOM"]
    for i in range(n):
        y, m = divmod(i, 12)
        lines.append(f"{1982 + y} {m + 1:2d}   24.28    -0.24   25.84    0.17   28.01   -0.21   26.65    0.08")
    if last_vals:
        lines.append(f"2026   7   23.10    {last_vals['nino12']:+.2f}   27.10    {last_vals['nino3']:+.2f}   29.40    0.80   28.20    {last_vals['nino34']:+.2f}")
    return "\n".join(lines) + "\n"


def make_weekly(n=30):
    lines = [" Weekly SST data starts week centered on 2Sept1981", "",
             "                Nino1+2      Nino3        Nino34        Nino4",
             " Week          SST SSTA     SST SSTA     SST SSTA     SST SSTA"]
    for i in range(n):
        # every row: 12AUG2026 style (reuse the same date, values vary slightly)
        lines.append(f"12AUG2026     {24.0 + i / 100:5.1f} {0.1 + i / 10:4.1f}     {28.0 + i / 100:5.1f} {1.0 + i / 10:4.1f}     {29.0 + i / 100:5.1f} {1.5 + i / 10:4.1f}     {29.5 + i / 100:5.1f} {0.5 + i / 10:4.1f}")
    lines.append("19AUG2026     24.8 4.0     28.3 3.3     29.4 2.6     29.5 0.8")
    return "\n".join(lines) + "\n"


def make_oni(n=40):
    lines = [" SEAS  YR   TOTAL   ANOM"]
    for i in range(n):
        y, m = divmod(i, 12)
        lines.append(f"  {fd.SEASONS[m]} {1982 + y}  27.00  {0.1 + i / 100:.2f}")
    lines.append("  MJJ 2026  29.02   1.39")
    return "\n".join(lines) + "\n"


def make_soi(n=40):
    lines = ["(STAND TAHITI - STAND DARWIN)  SEA LEVEL PRESS", "                        ANOMALY", "",
             "YEAR   JAN   FEB   MAR   APR   MAY   JUN   JUL   AUG   SEP   OCT   NOV   DEC"]
    for i in range(n):
        y, m = divmod(i, 12)
        vals = "  ".join(f"{-1.0 + (j + i) / 100:.1f}" for j in range(12))
        lines.append(f"{1982 + y}  {vals}")
    lines.append("2026  -1.2  -2.3  -0.9   0.4   1.1  -1.4")
    return "\n".join(lines) + "\n"


def make_mei(n=40):
    lines = ["1979     2026"]
    for i in range(n):
        y, m = divmod(i, 12)
        vals = "  ".join(f"{0.5 + (j + i) / 100:.3f}" for j in range(12))
        lines.append(f"{1979 + y} {vals}")
    lines.append("2026    -1.03    0.80     1.20     1.75     2.10     2.41     2.30")
    lines += ["Multivariate ENSO Index Version 2 (MEI.v2)",
              "https://www.psl.noaa.gov/enso/mei",
              "Row values are 2 month seasons (YEAR DJ JF FM MA AM MJ JJ JA AS SO ON ND)"]
    return "\n".join(lines) + "\n"


ENSO_DISC_SAMPLE = """\
<html><body>
<p>EL NI&ntilde;O/SOUTHERN OSCILLATION (ENSO) DIAGNOSTIC DISCUSSION
issued by CLIMATE PREDICTION CENTER/NCEP/NWS 13 August 2026</p>
<p>ENSO Alert System Status: El Ni&ntilde;o Advisory</p>
<p>Synopsis: El Ni&ntilde;o is strengthening, with a greater than 90% chance of a very
strong event during the Northern Hemisphere fall and winter 2026-27. El Ni&ntilde;o
strengthened over the past month. The July Ni&ntilde;o index values were +1.4&deg;C in
Ni&ntilde;o-3.4, +1.7&deg;C in Ni&ntilde;o-3, and +2.9&deg;C in Ni&ntilde;o-1+2 [Fig. 2].</p>
<p>The next ENSO Diagnostics Discussion is scheduled for 10 September 2026.</p>
</body></html>
"""


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    """Ensure tests never touch the network."""
    monkeypatch.setattr(fd, "fetch_text", lambda url, **kw: None)


# --------------------------------------------------------------------------
# Parsers
# --------------------------------------------------------------------------
def test_sstoi_parser(monkeypatch):
    monkeypatch.setattr(fd, "fetch_text", lambda url, **kw: make_sstoi(last_vals={"nino34": 1.4, "nino3": 1.7, "nino12": 2.9}))
    data, meta = fd.fetch_cpc_sstoi()
    assert meta["source"] == "live"
    assert data["nino34"][-1] == {"date": "2026-07-01", "value": 1.4}
    assert data["nino3"][-1]["value"] == 1.7
    assert data["nino12"][-1]["value"] == 2.9
    assert len(data["nino34"]) == 41


def test_sstoi_synthetic_on_empty(monkeypatch):
    monkeypatch.setattr(fd, "fetch_text", lambda url, **kw: "garbage")
    data, meta = fd.fetch_cpc_sstoi()
    assert data == {}
    assert meta["source"] == "synthetic"


def make_ersst(n=40):
    lines = [" YR   MON  NINO1+2  ANOM   NINO3    ANOM   NINO4    ANOM   NINO3.4  ANOM"]
    for i in range(n):
        y, m = divmod(i, 12)
        lines.append(f"{1950 + y}  {m + 1:2d}   23.00    0.10   25.00    0.20   28.00    0.30   26.00    0.40")
    lines.append("2026   6   25.94    2.82   28.33    1.71   30.19    1.22   29.17    1.44")
    return "\n".join(lines) + "\n"


def test_ersst5_parser(monkeypatch):
    monkeypatch.setattr(fd, "fetch_text", lambda url, **kw: make_ersst())
    data, meta = fd.fetch_cpc_ersst5()
    assert meta["source"] == "live"
    assert data[-1] == {"date": "2026-06-01", "value": 1.44}
    assert data[0] == {"date": "1950-01-01", "value": 0.4}
    assert len(data) == 41


def test_weekly_parser(monkeypatch):
    monkeypatch.setattr(fd, "fetch_text", lambda url, **kw: make_weekly())
    data, meta = fd.fetch_cpc_weekly()
    assert meta["source"] == "live"
    assert data["nino34"][-1] == {"date": "2026-08-19", "value": 2.6}
    assert data["nino4"][-1]["value"] == 0.8
    assert len(data["nino34"]) == 31


def test_oni_parser(monkeypatch):
    monkeypatch.setattr(fd, "fetch_text", lambda url, **kw: make_oni())
    data, meta = fd.fetch_cpc_oni()
    assert meta["source"] == "live"
    assert data[-1] == {"season": "MJJ", "year": 2026, "value": 1.39}
    assert len(data) == 41


def test_soi_parser(monkeypatch):
    monkeypatch.setattr(fd, "fetch_text", lambda url, **kw: make_soi())
    data, meta = fd.fetch_cpc_soi()
    assert meta["source"] == "live"
    assert data[-1] == {"date": "2026-06-15", "value": -1.4}
    assert len(data) == 486


def test_mei_parser(monkeypatch):
    monkeypatch.setattr(fd, "fetch_text", lambda url, **kw: make_mei())
    data, meta = fd.fetch_psl_mei()
    assert meta["source"] == "live"
    assert data[0] == {"date": "1979-01-01", "value": pytest.approx(0.5, abs=0.01)}
    assert data[-1] == {"date": "2026-07-01", "value": 2.3}
    assert len(data) == 487


PROB_SAMPLE = """<html><body>
<table id="probabilities-table">
<tr><th>Season</th><th>La Niña</th><th>Neutral</th><th>El Niño</th></tr>
<tr><td>JAS Jul Aug Sep</td><td>0</td><td>0</td><td>100</td></tr>
<tr><td>SON Sep Oct Nov</td><td>0</td><td>0</td><td>100</td></tr>
<tr><td>NDJ Nov Dec Jan</td><td>0</td><td>0</td><td>100</td></tr>
<tr><td>DJF Dec Jan Feb</td><td>0</td><td>0</td><td>100</td></tr>
<tr><td>FMA Feb Mar Apr</td><td>0</td><td>3</td><td>97</td></tr>
<tr><td>MAM Mar Apr May</td><td>0</td><td>18</td><td>82</td></tr>
</table></body></html>"""


def test_cpc_probabilities_parser(monkeypatch):
    monkeypatch.setattr(fd, "fetch_text", lambda url, **kw: PROB_SAMPLE)
    data, meta = fd.fetch_cpc_probabilities()
    assert meta["source"] == "live"
    assert data[0] == {"season": "JAS", "la_nina": 0, "neutral": 0, "el_nino": 100}
    assert data[-1] == {"season": "MAM", "la_nina": 0, "neutral": 18, "el_nino": 82}
    assert len(data) == 6


def test_ensodisc_parser(monkeypatch):
    monkeypatch.setattr(fd, "fetch_text", lambda url, **kw: ENSO_DISC_SAMPLE)
    data, meta = fd.fetch_cpc_ensodisc()
    assert meta["source"] == "live"
    assert data["advisory"] == "El Ni\u00f1o Advisory"
    assert data["issued"] == "13 August 2026"
    assert data["next_discussion"] == "10 September 2026"
    assert data["indices"] == {"month": "July", "nino34": 1.4, "nino3": 1.7, "nino12": 2.9}
    assert data["probabilities"]["very_strong_chance"] == "greater than 90%"
    assert "strengthening" in data["synopsis"]


# --------------------------------------------------------------------------
# Derived diagnostics
# --------------------------------------------------------------------------
def test_oni_category_boundaries():
    assert fd.oni_category(0.0) == "ENSO Neutral"
    assert fd.oni_category(0.7) == "Weak El Ni\u00f1o"
    assert fd.oni_category(1.2) == "Moderate El Ni\u00f1o"
    assert fd.oni_category(1.7) == "Strong El Ni\u00f1o"
    assert fd.oni_category(2.3) == "Very Strong El Ni\u00f1o"
    assert fd.oni_category(-1.2) == "Moderate La Ni\u00f1a"


def test_event_comparison():
    oni = [
        {"season": "JJA", "year": 1982, "value": 0.6},
        {"season": "DJF", "year": 1983, "value": 2.2},
        {"season": "MAM", "year": 1983, "value": 0.4},
        {"season": "MJJ", "year": 2026, "value": 1.39},
        {"season": "JJA", "year": 2026, "value": 1.8},
    ]
    result = fd.event_comparison(oni)["events"]
    assert len(result) == 2
    assert result[0]["label"] == "1982\u201383"
    assert result[0]["peak"] == 2.2
    assert result[0]["category"] == "Very Strong El Ni\u00f1o"
    assert result[1]["active"] is True
    assert result[1]["label"].endswith("(developing)")


def test_fill_lon():
    import numpy as np
    field = np.array([[np.nan, np.nan, 25.0, np.nan, 27.0, np.nan],
                      [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan]])
    out = fd._fill_lon(field)
    assert out[0].tolist() == [25.0, 25.0, 25.0, 25.0, 27.0, 27.0]
    assert out[1].tolist() == [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]


def test_isotherm_depth_nan():
    depths = [5.0, 15.0, 25.0, 35.0]
    assert fd._isotherm_depth(depths, [26.0, float("nan"), 18.0, 12.0]) is None
    d = fd._isotherm_depth(depths, [26.0, 22.0, 18.0, float("nan")])
    assert d is not None and 19.0 < d < 21.0


def test_event_comparison_merged_peak_year():
    """Events that never drop below 0.5 merge; label must use the peak year."""
    oni = [
        {"season": "SON", "year": 2014, "value": 0.7},
        {"season": "NDJ", "year": 2015, "value": 2.6},
        {"season": "JFM", "year": 2016, "value": 2.3},
        {"season": "MAM", "year": 2016, "value": 0.4},
    ]
    ev = fd.event_comparison(oni)["events"][0]
    assert ev["peak_year"] == 2015
    assert ev["label"] == "2015–2016"
    assert ev["peak"] == 2.6


def test_isotherm_depth():
    depths = [5.0, 15.0, 25.0, 35.0]
    profile = [26.0, 22.0, 18.0, 12.0]  # crosses 20°C between 15 and 25 m
    d = fd._isotherm_depth(depths, profile)
    assert d is not None and 19.0 < d < 21.0
    assert fd._isotherm_depth(depths, [28.0, 27.0, 26.0, 25.0]) is None


def test_compute_changes():
    prev = {"nino34_monthly": [{"date": "2026-07-01", "value": 1.4}],
            "oni_monthly": [{"season": "AMJ", "year": 2026, "value": 1.1}],
            "soi_monthly": [{"date": "2026-05-15", "value": -1.0}],
            "wwv_monthly": [{"date": "2026-06-15", "value": 1.2}],
            "enso_status": {"advisory": "El Ni\u00f1o Advisory"}}
    cur = {"nino34_monthly": [{"date": "2026-08-01", "value": 1.6}],
           "oni_monthly": [{"season": "MJJ", "year": 2026, "value": 1.39}],
           "soi_monthly": [{"date": "2026-06-15", "value": -1.4}],
           "wwv_monthly": [{"date": "2026-07-15", "value": 1.6}],
           "enso_status": {"advisory": "El Ni\u00f1o Advisory"}}
    ch = fd.compute_changes(prev, cur)
    assert ch["nino34"] == {"previous": 1.4, "current": 1.6, "delta": 0.2}
    assert ch["oni"]["delta"] == pytest.approx(0.29, abs=0.01)
    assert "advisory" not in ch
    assert fd.compute_changes(None, cur) == {"note": "first run \u2014 no previous data"}


# --------------------------------------------------------------------------
# Output schema sanity (regression against accidental shape changes)
# --------------------------------------------------------------------------
def test_schema_keys_present():
    required = [
        "schema_version", "generated_at", "nino34_monthly", "nino34_forecast", "nino34_weekly",
        "oni_monthly", "soi_monthly", "mei_monthly", "wwv_monthly",
        "olr_anomaly", "subsurface_temp", "wind850_anomaly", "ensemble_plume",
        "precip_forecast", "enso_status", "current", "comparison",
        "sources", "_pipeline",
    ]
    p = Path(__file__).resolve().parent.parent / "data.json"
    if p.exists():
        d = json.loads(p.read_text(encoding="utf-8"))
        for key in required:
            assert key in d, f"missing key {key}"
        assert set(d["sources"].values()) <= {"live", "derived", "synthetic"}
