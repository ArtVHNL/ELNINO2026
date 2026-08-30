#!/usr/bin/env python3
"""
deepseek_briefing.py — DeepSeek V4 Flash expert briefing + news digest
========================================================================
Reads the latest pipeline output (data.json), optionally pulls ENSO news
headlines from Google News RSS, and asks DeepSeek to produce:

  1. an expert situation briefing (headline, summary, what changed,
     outlook, risks) — numbers may ONLY be quoted from the provided data,
  2. a short curated news digest (max 4 items, authoritative sources first).

Output (strict JSON, schema-validated):
  news/briefing-YYYY-MM-DD.json   daily archive
  news/latest.json                what the dashboard renders

Requirements: DEEPSEEK_API_KEY env var. Model: DEEPSEEK_MODEL env var
(default: deepseek-v4-flash). Without a key the script exits 0 and writes
nothing (the workflow treats AI content as optional).

Usage:
  python scripts/deepseek_briefing.py --data data.json --out news [--fetch-news]
"""

import argparse
import json
import logging
import os
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests

log = logging.getLogger("enso-briefing")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

API_URL = "https://api.deepseek.com/chat/completions"
DEFAULT_MODEL = "deepseek-v4-flash"
NEWS_RSS = ("https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en")
REQUIRED_KEYS = ["headline", "summary", "what_changed", "outlook", "risks", "data_confidence"]


# --------------------------------------------------------------------------
# Data digest
# --------------------------------------------------------------------------
def build_digest(data: dict) -> str:
    cur = data.get("current", {})
    st = data.get("enso_status", {})
    ch = data.get("changes_since_previous", {})
    cmp = data.get("comparison", {}).get("events", [])
    lines = [
        f"generated_at: {data.get('generated_at')}",
        f"advisory: {st.get('advisory')} (issued {st.get('issued')}, next {st.get('next_discussion')})",
        f"category (derived from ONI): {st.get('category')}",
        f"official indices: {json.dumps(st.get('indices', {}))}",
        f"official probabilities: {json.dumps(st.get('probabilities', {}))}",
    ]
    for name in ("nino34", "oni", "soi", "mei", "wwv"):
        v = cur.get(name)
        if v:
            lines.append(f"{name}: {json.dumps(v)}")
    if ch and ch.get("note") is None:
        lines.append(f"changes_since_previous: {json.dumps(ch)}")
    if cmp:
        latest_ev = cmp[-1]
        lines.append(f"latest_event: {json.dumps(latest_ev)}")
    syn = st.get("synopsis")
    if syn:
        lines.append(f"official_synopsis: {syn[:600]}")
    return "\n".join(lines)


# --------------------------------------------------------------------------
# News RSS
# --------------------------------------------------------------------------
def fetch_news_links(limit: int = 10) -> list[dict]:
    url = NEWS_RSS.format(query=quote("El Niño 2026 climate"))
    try:
        resp = requests.get(url, timeout=25, headers={"User-Agent": "enso-dashboard/3.0"})
        resp.raise_for_status()
    except requests.RequestException as e:
        log.warning("news RSS fetch failed: %s", e)
        return []
    items = []
    try:
        root = ET.fromstring(resp.text)
        for item in root.iter("item"):
            title = item.findtext("title", "").strip()
            link = item.findtext("link", "").strip()
            pub = item.findtext("pubDate", "").strip()
            source = item.find("source")
            src = source.text.strip() if source is not None and source.text else "unknown"
            if title:
                items.append({"title": title, "source": src, "url": link, "published": pub})
    except ET.ParseError as e:
        log.warning("RSS parse failed: %s", e)
        return []
    return items[:limit]


# --------------------------------------------------------------------------
# DeepSeek call
# --------------------------------------------------------------------------
def call_deepseek(system: str, user: str, api_key: str, model: str) -> dict:
    resp = requests.post(
        API_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
            "max_tokens": 1600,
        },
        timeout=120,
    )
    resp.raise_for_status()
    body = resp.json()
    content = body["choices"][0]["message"]["content"]
    usage = body.get("usage", {})
    log.info("DeepSeek usage: %s", usage)
    return json.loads(content)


SYSTEM_PROMPT = """You are a senior ENSO (El Niño/La Niña) monitoring analyst writing for a public dashboard.

RULES:
1. You may ONLY use numbers, dates and statements that appear in the DATA section.
   Never invent values. If a number is not in the DATA, do not mention it.
2. If some data blocks are marked synthetic/unavailable in the sources list, say so
   briefly in the summary instead of pretending the data exists.
3. Output STRICT JSON with exactly these keys:
   headline (string, max 90 chars), summary (3-5 sentences), what_changed (array of
   short strings, may be empty), outlook (2-3 sentences), risks (array of short
   strings), data_confidence ("high"|"medium"|"low").
4. Language: English. Tone: factual, concise, no hype words like "super" or "catastrophic"
   unless they appear in the DATA.
5. news (optional array): digest items from the NEWS section. Pick at most 4, prefer
   NOAA/CPC/WMO/IRI/BoM/official sources. Each: title, source, url, summary (max 2 sentences)."""


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------
def validate(payload: dict) -> list[str]:
    errors = []
    for key in REQUIRED_KEYS:
        if key not in payload:
            errors.append(f"missing key: {key}")
    if "headline" in payload and not isinstance(payload["headline"], str):
        errors.append("headline not a string")
    if payload.get("data_confidence") not in ("high", "medium", "low"):
        errors.append("data_confidence must be high|medium|low")
    if not isinstance(payload.get("what_changed", []), list):
        errors.append("what_changed not a list")
    if not isinstance(payload.get("risks", []), list):
        errors.append("risks not a list")
    news = payload.get("news", [])
    if not isinstance(news, list):
        errors.append("news not a list")
    return errors


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data.json")
    ap.add_argument("--out", default="news")
    ap.add_argument("--fetch-news", action="store_true", help="pull headlines from Google News RSS")
    ap.add_argument("--model", default=None)
    args = ap.parse_args()

    api_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        log.warning("DEEPSEEK_API_KEY not set — skipping briefing")
        return 0
    model = args.model or os.environ.get("DEEPSEEK_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL

    data_path = Path(args.data)
    if not data_path.exists():
        log.error("data file not found: %s", data_path)
        return 1
    data = json.loads(data_path.read_text(encoding="utf-8"))
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    digest = build_digest(data)
    news_links = fetch_news_links() if args.fetch_news else []
    log.info("digest: %d chars, news items: %d", len(digest), len(news_links))

    user = f"DATA:\n{digest}\n\nSOURCES:\n{json.dumps(data.get('sources', {}))}\n"
    if news_links:
        user += f"\nNEWS:\n{json.dumps(news_links, ensure_ascii=False)}"

    try:
        payload = call_deepseek(SYSTEM_PROMPT, user, api_key, model)
    except Exception as e:  # noqa: BLE001
        log.error("DeepSeek call failed: %s", e)
        return 1

    errors = validate(payload)
    if errors:
        log.error("briefing failed validation: %s", errors)
        log.error("raw payload: %s", json.dumps(payload)[:500])
        return 1

    payload["generated_at"] = datetime.now(timezone.utc).isoformat()
    payload["model"] = model
    payload["disclaimer"] = (
        "AI-generated by DeepSeek from official NOAA/CPC data — not reviewed by a "
        "professional meteorologist. Always consult NOAA CPC for authoritative statements."
    )
    payload["sources_url"] = "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/"

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    archive = out_dir / f"briefing-{today}.json"
    latest = out_dir / "latest.json"
    archive.write_text(json.dumps(payload, indent=1, ensure_ascii=False), encoding="utf-8")
    latest.write_text(json.dumps(payload, indent=1, ensure_ascii=False), encoding="utf-8")

    # prune old briefings (keep 14)
    old = sorted(out_dir.glob("briefing-*.json"))[:-14]
    for p in old:
        p.unlink()

    log.info("briefing written: %s (%.1f KB)", latest, latest.stat().st_size / 1024)
    return 0


if __name__ == "__main__":
    sys.exit(main())
