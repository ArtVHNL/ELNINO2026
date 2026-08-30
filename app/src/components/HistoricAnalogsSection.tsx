import { useState } from "react";
import { BarChart2 } from "lucide-react";
import { HISTORIC_ANALOGS } from "../data";

export function HistoricAnalogsSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const current = HISTORIC_ANALOGS[activeIdx];

  return (
    <div className="bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-4 shadow-2xl backdrop-blur-sm">
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-purple-400" />
          <h4 className="text-xs font-sans font-bold text-white tracking-wider uppercase">
            Climatological Benchmarking & Historical ENSO Analogs
          </h4>
        </div>
        <span className="text-[9px] font-mono bg-[#111827] px-2 py-0.5 rounded text-gray-400 border border-white/5 uppercase">
          Reference Center
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {HISTORIC_ANALOGS.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveIdx(idx)}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
              activeIdx === idx 
              ? "bg-[#251b3d]/50 border-purple-500/50 shadow-md shadow-purple-900/10" 
              : "bg-slate-950/40 border-white/5 hover:bg-slate-900/50"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono font-extrabold text-purple-400">{item.year}</span>
              <span className="text-[10px] font-bold text-white bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                Peak ONI: {item.oni}
              </span>
            </div>
            <h5 className="text-xs font-sans font-extrabold text-white mt-2">{item.name}</h5>
            <p className="text-[10px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
          </button>
        ))}
      </div>

      <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-xs font-mono space-y-2">
        <div className="text-purple-300 font-extrabold uppercase text-[10px] tracking-wider">
          📊 HISTORICAL DIRECT COMPARISON HIGHLIGHTS:
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-300 leading-relaxed font-light">{current.description}</p>
          </div>
          <div className="border-t md:border-t-0 md:border-l border-white/5 pt-3 md:pt-0 md:pl-4 space-y-2 flex flex-col justify-center">
            <div className="flex justify-between">
              <span className="text-gray-500 font-light">Southern Oscillation Index Peak:</span>
              <span className="text-red-400 font-bold">{current.soi}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-light">Atmospheric Coupling:</span>
              <span className="text-white font-bold">Strong Coupled Boundary</span>
            </div>
            <p className="text-[10px] text-red-500 bg-red-950/25 px-2 py-1 rounded border border-red-900/20 leading-snug font-light italic mt-1">
              * {current.highlight}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
