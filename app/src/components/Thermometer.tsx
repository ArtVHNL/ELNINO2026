// ============================================================================
// "Where things stand" — flat thermometer: the ocean-temperature anomaly on
// the official CPC category scale. The red column rises once on load
// (subtle, no looping animation).
// ============================================================================
import { useEffect, useState } from "react";

interface Props {
  value: number;          // anomaly in °C (e.g. +1.4)
  absoluteLabel: string;  // e.g. "29.2°C (84.5°F)"
  valueLab: string;       // e.g. "June 2026"
}

const SCALE_MAX = 3.0;
const pct = (v: number) => Math.max(0, Math.min(100, (v / SCALE_MAX) * 100));

export function Thermometer({ value, absoluteLabel, valueLab }: Props) {
  const [w, setW] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setW(pct(value)), 200);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div>
      <div className="flex items-end justify-between">
        <span className="text-sm font-semibold text-gray-900">Ocean warmer than normal</span>
        <span className="text-3xl font-bold tracking-tight tabular-nums">
          +{value.toFixed(1)}°C
        </span>
      </div>

      {/* track with category bands */}
      <div className="relative mt-3 h-3 w-full bg-gray-100">
        {[0.5, 1.0, 1.5, 2.0].map(t => (
          <span key={t} className="absolute inset-y-0 w-px bg-gray-300" style={{ left: `${pct(t)}%` }} />
        ))}
        {/* rising fill */}
        <div
          className="absolute inset-y-0 left-0 bg-[#DC2626]"
          style={{ width: `${w}%`, transition: "width 1000ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
        {/* current marker */}
        <span
          className="absolute -top-1.5 h-6 w-[3px] bg-gray-900"
          style={{ left: `${pct(value)}%` }}
        />
      </div>

      <div className="relative mt-3 h-4">
        <span
          className="absolute whitespace-nowrap text-xs font-bold text-gray-900"
          style={{ left: `${pct(value)}%`, transform: "translateX(-50%)" }}
        >
          now +{value.toFixed(1)}°C
        </span>
      </div>

      <div className="flex justify-between border-t border-gray-200 pt-1.5 text-[11px] text-gray-500">
        <span>0</span>
        <span className="-translate-x-1/2">+0.5 weak</span>
        <span className="-translate-x-1/2">+1.0 moderate</span>
        <span className="-translate-x-1/2">+1.5 strong</span>
        <span className="translate-x-1/2">+2.0 very strong</span>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Eastern Pacific water now: {absoluteLabel} ({valueLab}). Thresholds and categories: NOAA CPC.
      </p>
    </div>
  );
}
