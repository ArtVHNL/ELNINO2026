// ============================================================================
// "What is predicted?" — observed vs forecast Niño-3.4 water temperature.
// Observed: thin black. Forecast: thick red mean line with a flat light-red
// multi-model range band. Flat style: no spines, hairline gridlines.
// ============================================================================
import { useMemo } from "react";
import * as d3 from "d3";
import type { IndexValue, Nino34Forecast } from "../data";

interface Props {
  observed: IndexValue[];    // monthly ERSST anomalies (full history)
  forecast: Nino34Forecast;  // NMME real-time forecast
}

const W = 880;
const H = 340;
const M = { top: 16, right: 24, bottom: 30, left: 44 };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthIndex(iso: string): number {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 12 + parseInt(m[2], 10) - 1;
}

function monthLabel(idx: number): string {
  return `${MONTHS[idx % 12]} ${String(Math.floor(idx / 12) % 100).padStart(2, "0")}`;
}

export function PredictedChart({ observed, forecast }: Props) {
  const { x, y, obsPath, obsPts, meanPath, bandPath, connectPath, gridYs, ticks } = useMemo(() => {
    const obs = observed.slice(-12);
    const months = forecast.months;
    const n0 = obs.length ? monthIndex(obs[0].date) : monthIndex(months[0] + "-01");
    const n1 = monthIndex(months[months.length - 1] + "-01") + 1;
    const x = d3.scaleLinear().domain([n0, n1]).range([M.left, W - M.right]);
    const yMax = Math.max(2.0, ...forecast.max.map(v => v + 0.5));
    const y = d3.scaleLinear().domain([-0.6, yMax]).range([H - M.bottom, M.top]);

    const obsPts = obs.map(r => ({ x: x(monthIndex(r.date)), y: y(r.value), v: r.value }));
    const obsPath = obsPts.length ? "M" + obsPts.map(p => `${p.x},${p.y}`).join(" L") : "";

    const fPts = months.map((m, i) => ({
      x: x(monthIndex(m + "-01")),
      mean: y(forecast.mean[i] ?? 0),
      min: y(forecast.min[i] ?? 0),
      max: y(forecast.max[i] ?? 0),
    }));
    const meanPath = fPts.length ? "M" + fPts.map(p => `${p.x},${p.mean}`).join(" L") : "";
    // dashed connector: last observed month -> first forecast month
    const connectPath =
      obsPts.length && fPts.length
        ? `M${obsPts[obsPts.length - 1].x},${obsPts[obsPts.length - 1].y} L${fPts[0].x},${fPts[0].mean}`
        : "";
    const bandPath = fPts.length
      ? "M" + fPts.map(p => `${p.x},${p.max}`).join(" L")
        + " L" + [...fPts].reverse().map(p => `${p.x},${p.min}`).join(" L") + " Z"
      : "";

    const gridYs = y.ticks(5).map(t => ({ t, py: y(t) }));
    const ticks: { x: number; label: string }[] = [];
    for (let idx = n0; idx <= n1; idx += 3) ticks.push({ x: x(idx), label: monthLabel(idx) });

    return { x, y, obsPath, obsPts, meanPath, bandPath, connectPath, gridYs, ticks };
  }, [observed, forecast]);

  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Forecast chart: observed and predicted water temperature">
        {gridYs.map(g => (
          <g key={g.t}>
            <line x1={M.left} x2={W - M.right} y1={g.py} y2={g.py} stroke="#F3F4F6" strokeWidth="1" />
            <text x={M.left - 8} y={g.py + 3} textAnchor="end" fontSize="10" fill="#9CA3AF" fontFamily="inherit">
              {g.t >= 0 ? `+${g.t.toFixed(1)}` : g.t.toFixed(1)}°
            </text>
          </g>
        ))}
        <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="#9CA3AF" strokeWidth="1" strokeDasharray="4,3" />

        {/* multi-model range band */}
        {bandPath && <path d={bandPath} fill="#DC2626" fillOpacity="0.10" stroke="none" />}

        {/* observed-to-forecast connector */}
        {connectPath && <path d={connectPath} fill="none" stroke="#9CA3AF" strokeWidth="1" strokeDasharray="4,3" />}

        {/* observed */}
        <path d={obsPath} fill="none" stroke="#111827" strokeWidth="2" />
        {obsPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.4" fill="#111827" />)}

        {/* forecast mean */}
        {meanPath && <path d={meanPath} fill="none" stroke="#DC2626" strokeWidth="3" strokeLinejoin="round" />}

        {ticks.map((t, i) => (
          <text key={i} x={t.x} y={H - 8} textAnchor="middle" fontSize="10" fill="#6B7280" fontFamily="inherit">
            {t.label}
          </text>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-700">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-[2px] w-8 bg-[#111827]" /> observed (measured)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-[3px] w-8 bg-[#DC2626]" /> forecast (6-model mean)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-8 bg-[#DC2626]/10 border border-[#DC2626]/30" /> model range
        </span>
      </div>
    </div>
  );
}
