import { useState, useEffect } from "react";
import { Database } from "lucide-react";
import { REGIONAL_IMPACTS } from "../data";

interface RegionalImpactAtlasSectionProps {
  scenario: "active" | "neutral" | "lanina" | "modoki";
}

export function RegionalImpactAtlasSection({ scenario }: RegionalImpactAtlasSectionProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const list = REGIONAL_IMPACTS[scenario] || REGIONAL_IMPACTS.active;

  useEffect(() => {
    setSelectedIdx(0);
  }, [scenario]);

  const current = list[selectedIdx] || list[0];

  return (
    <div className="bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-4 shadow-2xl backdrop-blur-sm">
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-sans font-bold text-white tracking-wider uppercase">
            Interactive Regional Impact Atlas & Socio-Economic Indicators
          </h4>
        </div>
        <span className="text-[9px] font-mono bg-[#111827] px-2 py-0.5 rounded text-gray-400 border border-white/5 uppercase">
          Atmospheric Consequence Diagnostics
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
          {list.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                selectedIdx === idx 
                ? "bg-[#182038]/60 border-emerald-500/50 shadow-md" 
                : "bg-slate-950/40 border-white/5 hover:bg-slate-900/60"
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-sans font-semibold text-white">{item.region}</span>
                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                  item.severity.includes("CRITICAL") || item.severity.includes("HIGH") ? "bg-red-950/60 text-red-400 border border-red-900" :
                  item.severity.includes("SEVERE") ? "bg-orange-950/60 text-orange-400 border border-orange-900" :
                  item.severity.includes("NORMAL") ? "bg-slate-950 text-slate-400 border border-slate-800" :
                  "bg-emerald-950/60 text-emerald-400 border border-emerald-900"
                }`}>
                  {item.severity.split(" ")[0]}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">{item.risk}</p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-7 bg-slate-900/10 p-4 rounded-xl border border-white/5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-widest">
                PROJECTED RISKS & MITIGATION METRICS
              </span>
              <h5 className="text-sm font-sans font-extrabold text-white">
                {current.region}
              </h5>
              <div className="text-xs font-mono font-bold text-amber-400 bg-amber-950/20 px-2.5 py-1 rounded border border-amber-900/35">
                ⚠️ Warning: {current.risk}
              </div>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed font-light">
              {current.impact}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5 mt-4 text-center font-mono">
            <div className="bg-black/30 p-2 rounded-lg border border-white/5">
              <div className="text-[9px] text-gray-500">Temp Anomaly</div>
              <div className="text-xs font-bold text-red-400">{current.stats.temp}</div>
            </div>
            <div className="bg-black/30 p-2 rounded-lg border border-white/10">
              <div className="text-[9px] text-gray-500">Precipitation</div>
              <div className="text-xs font-bold text-sky-400">{current.stats.precip}</div>
            </div>
            <div className="bg-black/30 p-2 rounded-lg border border-white/10">
              <div className="text-[9px] text-gray-500">Economic Value</div>
              <div className="text-xs font-bold text-emerald-400">{current.stats.economic}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
