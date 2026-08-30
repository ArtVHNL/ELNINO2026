#!/usr/bin/env python3
"""pipeline_summary.py — print the meta.json health matrix for the Actions
job summary. Reads meta.json from the current directory (or --meta path)."""

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--meta", default="meta.json")
    args = ap.parse_args()
    p = Path(args.meta)
    if not p.exists():
        print("meta.json not found")
        return 1
    try:
        m = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        print(f"meta.json unreadable: {e}")
        return 1

    s = m.get("summary", {})
    print(f"Endpoints: {s.get('endpoints_total')} total — {s.get('live')} live, "
          f"{s.get('derived')} derived, {s.get('synthetic')} synthetic, {s.get('error')} error")
    for name, st in m.get("health", {}).items():
        line = f"- {name}: {st.get('source')}"
        if st.get("error"):
            line += f" ({st['error'][:80]})"
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
