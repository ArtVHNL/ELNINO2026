// ============================================================================
// "How bad is it?" — the 2026–27 event vs the three strongest El Niños on
// record, aligned by event month (month 0 = first month the event was active).
// Flat style: no spines, hairline gridlines, gray histories, red current.
// ============================================================================
import { useMemo } from "react";
import * as d3 from "d3";
import type { IndexValue, ComparisonEvent } from "../data";

interface Props {
  monthly: IndexValue[];       // monthly Niño-3.4 anomalies (ERSST, official)
  events: ComparisonEvent[];   // detected events with start_month / peak_month
}

const W = 880;
const H = 340;
const M = { top: 16, right: 24, bottom: 30, left: 44 };
const X_MIN = -6;
const X_MAX = 17; // months since onset
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function seriesFor(monthly: IndexValue[], startYear: number, startMonth: number): (number | null)[] {
  const vals: (number | null)[] = [];
  const startIdx = startYear * 12 + (startMonth - 1);
  const byKey = new Map(monthly.map(r => {
    const m = r.date.match(/^(\d{4})-(\d{2})/);
    return m ? [`${m[1]}-${m[2]}`, r.value] : null;
  }).filter(Boolean) as [string, number][]);
  for (let k = X_MIN; k <= X_MAX; k++) {
    const idx = startIdx + k;
    const y = Math.floor(idx / 12);
    const mo = (idx % 12) + 1;
    const v = byKey.get(`${y}-${String(mo).padStart(2, "0")}`);
    vals.push(v ?? null);
  }
  return vals;
}

export function AlignedComparison({ monthly, events }: Props) {
  const { refs, refSeries, refEnds, currentSeries, x, y, gridYs, xTicks, curveText } = useMemo(() => {
    const completed = events.filter(e => !e.active);
    const refs = [...completed].sort((a, b) => b.peak - a.peak).slice(0, 3);
    const current = events.find(e => e.active);

    const palette = ["#9CA3AF", "#60A5FA", "#F59E0B"];
    const refSeries = refs.map((e, i) => ({
      label: e.label,
      peak: e.peak,
      color: palette[i % palette.length],
      vals: e.start ? seriesFor(monthly, parseInt(e.start, 10), e.start_month || 6) : null,
    })).filter(r => r.vals);

    const curStart = current?.start && current.start_month
      ? { y: parseInt(current.start, 10), m: current.start_month } : null;
    const curVals = curStart ? seriesFor(monthly, curStart.y, curStart.m) : [];

    const all = [...refSeries, { vals: curVals }].flatMap(r => (r.vals || []).filter((v): v is number => v !== null));
    const yMax = Math.max(1.5, ...all.map(v => v + 0.4));
    const x = d3.scaleLinear().domain([X_MIN, X_MAX]).range([M.left, W - M.right]);
    const y = d3.scaleLinear().domain([-0.6, yMax]).range([H - M.bottom, M.top]);

    const gridYs = y.ticks(5).map(t => ({ t, py: y(t) }));
    const xTicks = [0, 3, 6, 9, 12, 15, 17].map(k => ({ k, py: x(k), label: k === 0 ? "onset" : `+${k}m` }));

    // conclusion: current at +3 months vs mean of refs at +3
    let curveText = "The event is still in its first months.";
    const curIdx = 3;
    const refIdx = 3;
    const cv = curVals[curIdx];
    const rv = refSeries.map(r => r.vals![refIdx]).filter((v): v is number => v !== null);
    if (cv !== null && Number.isFinite(cv) && rv.length > 1) {
      const mean = rv.reduce((a, b) => a + b, 0) / rv.length;
      const diff = cv - mean;
      curveText =
        diff >= 0
          ? `Three months in, 2026-27 runs ${Math.abs(diff).toFixed(2)}°C above the average of the record events at the same stage.`
          : `Three months in, 2026-27 runs ${Math.abs(diff).toFixed(2)}°C below the average of the record events at the same stage.`;
    }

    const endLabel = (vals: (number | null)[]) => {
      for (let i = vals.length - 1; i >= 0; i--) {
        if (vals[i] !== null) return { x: x(i + X_MIN), y: y(vals[i] as number) };
      }
      return null;
    };
    const refEnds = refSeries.map(r => endLabel(r.vals!));
    return { refs, refSeries, refEnds, currentSeries: curVals, x, y, gridYs, xTicks, curveText };
  }, [monthly, events]);

  const pathOf = (vals: (number | null)[]) =>
    "M" + vals.map((v, i) => (v === null ? null : `${x(i + X_MIN)},${y(v)}`)).filter(Boolean).join(" L");

  const curPath = currentSeries.length ? pathOf(currentSeries) : "";
  const lastPt = (() => {
    for (let i = currentSeries.length - 1; i >= 0; i--) {
      if (currentSeries[i] !== null) return { px: x(i + X_MIN), py: y(currentSeries[i] as number) };
    }
    return null;
  })();

  return (
    <div className="mt-4">
      <p className="mb-1 max-w-3xl text-sm text-gray-600">{curveText}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Aligned event comparison chart">
        {gridYs.map(g => (
          <g key={g.t}>
            <line x1={M.left} x2={W - M.right} y1={g.py} y2={g.py} stroke="#F3F4F6" strokeWidth="1" />
            <text x={M.left - 8} y={g.py + 3} textAnchor="end" fontSize="10" fill="#9CA3AF" fontFamily="inherit">
              {g.t >= 0 ? `+${g.t.toFixed(1)}` : g.t.toFixed(1)}°
            </text>
          </g>
        ))}
        <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="#9CA3AF" strokeWidth="1" strokeDasharray="4,3" />

        {/* historical events */}
        {refSeries.map((r, i) => (
          <g key={i}>
            <path d={pathOf(r.vals!)} fill="none" stroke={r.color} strokeWidth="1.5" />
            {(() => {
              let best = -1;
              r.vals!.forEach((v, k) => { if (v !== null && (best < 0 || v > (r.vals![best] ?? 0))) best = k; });
              if (best >= 0 && r.vals![best] !== null) {
                return <circle cx={x(best + X_MIN)} cy={y(r.vals![best] as number)} r="2.6" fill={r.color} />;
              }
              return null;
            })()}
          </g>
        ))}
        {refEnds.map((p, i) => p && (
          <text key={i} x={p.x - 6} y={p.y + 3} textAnchor="end" fontSize="10" fontWeight="600" fill={refSeries[i].color} fontFamily="inherit">
            {refSeries[i].label}
          </text>
        ))}

        {/* current event */}
        {curPath && <path d={curPath} fill="none" stroke="#DC2626" strokeWidth="3" strokeLinejoin="round" />}
        {lastPt && (
          <g>
            <circle cx={lastPt.px} cy={lastPt.py} r="3.5" fill="#DC2626" />
            <text x={lastPt.px + 8} y={lastPt.py + 4} fontSize="10" fontWeight="700" fill="#DC2626" fontFamily="inherit">
              2026–27 (now)
            </text>
          </g>
        )}

        {xTicks.map((t, i) => (
          <text key={i} x={t.py} y={H - 8} textAnchor="middle" fontSize="10" fill="#6B7280" fontFamily="inherit">
            {t.label}
          </text>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-700">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-[3px] w-8 shrink-0 bg-[#DC2626]" /> 2026–27 (current)
        </span>
        {refSeries.map(r => (
          <span key={r.label} className="inline-flex items-center gap-2">
            <span className="inline-block h-[2px] w-8 shrink-0" style={{ backgroundColor: r.color }} /> {r.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-[3px] w-8 shrink-0 border-t-2 border-dashed border-[#9CA3AF]" /> climatological mean (0 °C)
        </span>
      </div>
    </div>
  );
}
