// ============================================================================
// Compact flat thermometer for one measurement. The red column rises once on
// load (subtle). No threshold rows — one shared scale note lives below the trio.
// ============================================================================
import { useEffect, useState } from "react";

interface Props {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  caption: string;
}

const SCALE_MAX = 3.0;
const pct = (v: number) => Math.max(0, Math.min(100, (v / SCALE_MAX) * 100));

export function MiniThermometer({ label, value, suffix = "", decimals = 2, caption }: Props) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct(value)), 200);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div>
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
        {value >= 0 ? "+" : ""}{value.toFixed(decimals)}{suffix}
      </div>
      <div className="relative mt-3 h-2 w-full bg-gray-100">
        <span className="absolute inset-y-0 w-px bg-gray-300" style={{ left: `${pct(1.0)}%` }} />
        <span className="absolute inset-y-0 w-px bg-gray-300" style={{ left: `${pct(2.0)}%` }} />
        <div
          className="absolute inset-y-0 left-0 bg-[#DC2626]"
          style={{ width: `${w}%`, transition: "width 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
        <span
          className="absolute -top-1 h-4 w-[2px] bg-gray-900"
          style={{ left: `${pct(value)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-500">{caption}</p>
    </div>
  );
}
