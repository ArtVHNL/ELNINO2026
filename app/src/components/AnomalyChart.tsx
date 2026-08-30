// ============================================================================
// "How bad is it?" — Niño 3.4 monthly anomaly vs the previous record year.
// Flat, print-ready: white background, no spines, hairline gridlines.
// Three series only: climatological mean (gray), previous record (light gray),
// current year (signal red, thick).
// ============================================================================
import { useMemo } from "react";
import * as d3 from "d3";
import type { IndexValue } from "../data";

interface Props {
  monthly: IndexValue[];            // full history from the pipeline
  currentYear: number;              // e.g. 2026
  referenceYear: number;            // previous record year, e.g. 2015
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const W = 880;
const H = 320;
const M = { top: 16, right: 24, bottom: 32, left: 44 };

function seriesForYear(monthly: IndexValue[], year: number): (number | null)[] {
  const out: (number | null)[] = Array(12).fill(null);
  for (const rec of monthly) {
    const m = rec.date.match(/^(\d{4})-(\d{2})/);
    if (!m) continue;
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    if (y === year && mo >= 0 && mo < 12) out[mo] = rec.value;
  }
  return out;
}

export function AnomalyChart({ monthly, currentYear, referenceYear }: Props) {
  const { cur, ref, x, y, gridYs, lastPt } = useMemo(() => {
    const cur = seriesForYear(monthly, currentYear);
    const ref = seriesForYear(monthly, referenceYear);
    const all = [...cur, ...ref].filter((v): v is number => v !== null);
    const yMax = Math.max(3, ...all.map(v => v + 0.4));
    const yMin = -0.6;

    const x = d3.scaleLinear().domain([0, 12]).range([M.left, W - M.right]);
    const y = d3.scaleLinear().domain([yMin, yMax]).range([H - M.bottom, M.top]);

    const gridYs = y.ticks(5).map(t => ({ t, py: y(t) }));
    let lastPt: { x: number; y: number } | null = null;
    for (let m = 11; m >= 0; m--) {
      if (cur[m] !== null) {
        lastPt = { x: x(m + 0.5), y: y(cur[m] as number) };
        break;
      }
    }
    return { cur, ref, x, y, gridYs, lastPt };
  }, [monthly, currentYear, referenceYear]);

  const line = (vals: (number | null)[]) =>
    vals.map((v, m) => (v === null ? null : `${x(m + 0.5)},${y(v)}`))
        .filter(Boolean)
        .join(" L");

  const refPath = "M" + line(ref).split(" L").join(" L");
  const curPathRaw = "M" + line(cur);
  const curPath = curPathRaw.split(" L").join(" L");

  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Temperature anomaly line chart">
        {/* hairline horizontal gridlines (no vertical, no spines) */}
        {gridYs.map(g => (
          <g key={g.t}>
            <line x1={M.left} x2={W - M.right} y1={g.py} y2={g.py} stroke="#F3F4F6" strokeWidth="1" />
            <text x={M.left - 8} y={g.py + 3} textAnchor="end" fontSize="10" fill="#9CA3AF" fontFamily="inherit">
              {g.t >= 0 ? `+${g.t.toFixed(1)}` : g.t.toFixed(1)}°
            </text>
          </g>
        ))}

        {/* climatological mean baseline */}
        <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="#9CA3AF" strokeWidth="1" strokeDasharray="4,3" />

        {/* previous record year */}
        <path d={refPath} fill="none" stroke="#D1D5DB" strokeWidth="1.5" />

        {/* current year — signal red, thick */}
        <path d={curPath} fill="none" stroke="#DC2626" strokeWidth="3" strokeLinejoin="round" />
        {lastPt && (
          <circle cx={lastPt.x} cy={lastPt.y} r="3.5" fill="#DC2626" />
        )}

        {/* x labels */}
        {MONTHS.map((m, i) => (
          <text key={m} x={x(i + 0.5)} y={H - 10} textAnchor="middle" fontSize="10" fill="#6B7280" fontFamily="inherit">
            {m}
          </text>
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-700">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-[3px] w-8 bg-[#DC2626]" /> {currentYear} (current year)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-[2px] w-8 bg-[#D1D5DB]" /> {referenceYear} (previous record)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-0 w-8 border-t border-dashed border-[#9CA3AF]" /> climatological mean (0 °C anomaly)
        </span>
      </div>
    </div>
  );
}
