import { useState, useEffect } from "react";
import { Wind } from "lucide-react";

interface WalkerCirculationProps {
  scenario: "active" | "neutral" | "lanina" | "modoki";
}

export function WalkerCirculationSection({ scenario }: WalkerCirculationProps) {
  const getParams = () => {
    switch (scenario) {
      case "active":
        return {
          winds: "reversed (Westerly Wind Bursts)",
          windDir: "→ Eastward Zonal Burst (Reversed)",
          convection: "Central & Eastern Pacific (Fully Shifted)",
          thermocline: "Flattened (Deep in East, shallow in West)",
          rain: "Peru / Ecuador (Meteorological Extremes)",
          drought: "Indonesia / Australia (Severe Drought & Fires)",
          cloudX: "75%",
          windStroke: "#ef4444",
          // Surface wind loop is reversed (flows West to East at bottom)
          reverseWind: true,
          thermoPath: "M 0 110 Q 150 110 300 110 L 300 160 L 0 160 Z",
          warmPoolX: "180",
          warmPoolW: "120",
          cells: [
            { x: "20%", label: "Subsiding Air (Drought)", arrow: "↓", color: "text-red-400" },
            { x: "80%", label: "Rising Warm Convection", arrow: "↑", color: "text-blue-400" }
          ]
        };
      case "lanina":
        return {
          winds: "intense easterlies (Hyper-Trades)",
          windDir: "← Strong Westward (Enhanced)",
          convection: "Maritime Continent (Indonesia/Australia)",
          thermocline: "Extremely Steep (shallow in East, deep in West)",
          rain: "Indonesia / Australia (Torrential Deluges)",
          drought: "Coastal Peru (Hyper-Arid Dryness)",
          cloudX: "20%",
          windStroke: "#38bdf8",
          reverseWind: false,
          thermoPath: "M 0 145 Q 150 90 300 45 L 300 160 L 0 160 Z",
          warmPoolX: "0",
          warmPoolW: "110",
          cells: [
            { x: "20%", label: "Rising Hyper-Convection", arrow: "↑", color: "text-blue-400" },
            { x: "80%", label: "Subsiding Coastal Air (Dry)", arrow: "↓", color: "text-sky-300" }
          ]
        };
      case "modoki":
        return {
          winds: "converging westward & eastward trades",
          windDir: "⇄ Central Basinal Convergence",
          convection: "Central Pacific Basin (Niño 4)",
          thermocline: "Anomalous mid-basin dip",
          rain: "International Date Line (Central Rain Belt)",
          drought: "Indonesia & Peru (Divided Dry Zone)",
          cloudX: "50%",
          windStroke: "#f59e0b",
          reverseWind: false, // converging
          thermoPath: "M 0 120 Q 150 135 300 85 L 300 160 L 0 160 Z",
          warmPoolX: "100",
          warmPoolW: "100",
          cells: [
            { x: "20%", label: "Subsiding West (Dry)", arrow: "↓", color: "text-amber-500" },
            { x: "50%", label: "Rising Mid-Convection", arrow: "↑", color: "text-blue-400" },
            { x: "80%", label: "Subsiding East (Dry)", arrow: "↓", color: "text-amber-500" }
          ]
        };
      case "neutral":
      default:
        return {
          winds: "standard easterly atmospheric trades",
          windDir: "← Westward (Normal Trade)",
          convection: "Western Pacific Warm Pool",
          thermocline: "Standard tilts (shallow in East, deep in West)",
          rain: "Indonesia / Australia (Seasonal Monsoon)",
          drought: "Peru Coast (Standard Arid Desert clima)",
          cloudX: "25%",
          windStroke: "#94a3b8",
          reverseWind: false,
          thermoPath: "M 0 135 Q 150 95 300 65 L 300 160 L 0 160 Z",
          warmPoolX: "0",
          warmPoolW: "130",
          cells: [
            { x: "25%", label: "Rising Convection (Wet)", arrow: "↑", color: "text-blue-400" },
            { x: "75%", label: "Subsiding Air (Normal Dry)", arrow: "↓", color: "text-gray-400" }
          ]
        };
    }
  };

  const p = getParams();

  return (
    <div className="bg-slate-950/60 p-5 rounded-2xl border border-white/5 space-y-4 shadow-2xl backdrop-blur-sm">
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4 text-sky-400 animate-pulse" />
          <h4 className="text-xs font-sans font-bold text-white tracking-wider uppercase">
            Coupled Atmosphere-Ocean Walker Circulation Simulator
          </h4>
        </div>
        <span className="text-[9px] font-mono bg-[#111827] px-2 py-0.5 rounded text-gray-400 uppercase tracking-widest border border-white/5">
          Planetary Cross-Section
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Visual Model Canvas */}
        <div className="md:col-span-8 bg-[#020617] p-4 rounded-xl border border-white/5 relative h-64 flex flex-col justify-between overflow-hidden">
          {/* Geographical Endpoints */}
          <div className="absolute top-2 left-3 text-[9px] font-mono text-gray-500 font-semibold uppercase tracking-wider">
            Maritime Continent (120°E)
          </div>
          <div className="absolute top-2 right-3 text-[9px] font-mono text-gray-500 font-semibold uppercase tracking-wider">
            South America (80°W)
          </div>

          {/* SVG Custom Cloud and Rain (Zero Emojis!) */}
          <div
            className="absolute transition-all duration-700 ease-in-out z-20"
            style={{ left: p.cloudX, top: "12%", transform: "translateX(-50%)" }}
          >
            <div className="relative flex flex-col items-center">
              <svg className="w-16 h-12 filter drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]" viewBox="0 0 100 80">
                <path
                  d="M 20 50 A 15 15 0 0 1 35 35 A 20 20 0 0 1 70 35 A 15 15 0 0 1 85 50 A 12 12 0 0 1 75 62 L 25 62 A 12 12 0 0 1 20 50 Z"
                  fill="#475569"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
                {/* Custom Rain Drops */}
                <line x1="30" y1="67" x2="26" y2="75" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" className="animate-pulse" />
                <line x1="45" y1="69" x2="41" y2="77" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" className="animate-pulse" />
                <line x1="60" y1="67" x2="56" y2="75" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" className="animate-pulse" />
                <line x1="75" y1="69" x2="71" y2="77" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" className="animate-pulse" />
              </svg>
              <span className="text-[8px] font-mono bg-blue-500 px-1.5 py-0.5 rounded text-white mt-1 whitespace-nowrap shadow-md uppercase tracking-wider font-bold">
                Convection Center
              </span>
            </div>
          </div>

          {/* Atmospheric Loop with SVG Custom Dashed Conveyor */}
          <div className="h-24 relative mt-12 mb-3 border-b border-dashed border-white/5">
            <svg className="absolute inset-0 w-full h-full pb-2" preserveAspectRatio="none" viewBox="0 0 300 100">
              <defs>
                <style>{`
                  @keyframes walkFlow {
                    0% { stroke-dashoffset: 0; }
                    100% { stroke-dashoffset: ${p.reverseWind ? "-40" : "40"}; }
                  }
                  .wind-conveyor {
                    animation: walkFlow 6s linear infinite;
                  }
                `}</style>
              </defs>
              {/* Conveyor Track of Walker Cell Loop */}
              <rect
                x="30"
                y="10"
                width="240"
                height="65"
                rx="15"
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="1.5"
              />
              <rect
                x="30"
                y="10"
                width="240"
                height="65"
                rx="15"
                fill="none"
                stroke={p.windStroke}
                strokeWidth="2.5"
                strokeDasharray="10, 8"
                className="wind-conveyor"
              />
            </svg>

            {/* Dynamic cellular indicators */}
            <div className="absolute inset-x-8 top-1 flex justify-between px-6">
              {p.cells.map((cell, i) => (
                <div key={i} className={`flex flex-col items-center ${cell.color} text-center space-y-0.5 z-10 transition-all duration-500`}>
                  <span className="text-xs font-bold font-mono animate-bounce">{cell.arrow}</span>
                  <span className="text-[9px] font-mono font-bold leading-tight uppercase tracking-wider bg-[#020617] px-1.5">{cell.label}</span>
                </div>
              ))}
            </div>

            {/* Core trade wind zonal description */}
            <div className="absolute inset-x-0 bottom-4 flex justify-center">
              <span className="text-[9px] font-mono px-2.5 py-0.5 bg-slate-900 border border-white/10 rounded-full text-white/90 shadow-lg">
                Zonal Winds: <strong className="text-amber-400 font-extrabold">{p.windDir}</strong>
              </span>
            </div>
          </div>

          {/* Ocean Gradient Cross-section & Thermocline Layer */}
          <div className="h-20 relative bg-[#01040f] rounded-lg overflow-hidden border border-white/5 flex items-end">
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 300 160">
              <defs>
                {/* FeGaussianBlur Blur for Smooth Thermocline Gradient blending */}
                <filter id="thermoclineBlur">
                  <feGaussianBlur stdDeviation="8" />
                </filter>
                {/* Warm Pool Shading */}
                <linearGradient id="warmPoolGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.1" />
                </linearGradient>
                {/* Cold Upwelling shading */}
                <linearGradient id="coldOcean" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.2" />
                </linearGradient>
              </defs>

              {/* Cold ocean depths base */}
              <rect width="300" height="160" fill="url(#coldOcean)" />

              {/* Scientific Warm Pool overlay */}
              <rect
                x={p.warmPoolX}
                y="0"
                width={p.warmPoolW}
                height="160"
                fill="url(#warmPoolGrad)"
                filter="url(#thermoclineBlur)"
                className="transition-all duration-700 ease-in-out"
              />

              {/* Thermocline Wave Line Path */}
              <path
                className="transition-all duration-700 ease-in-out"
                d={p.thermoPath}
                fill="none"
                stroke={p.windStroke}
                strokeWidth="3.5"
                strokeLinecap="round"
                filter="drop-shadow(0 0 4px rgba(255,255,255,0.2))"
              />
            </svg>

            {/* Floating Climatological labels on cross-section */}
            <div className="absolute top-1 right-3 text-[9px] font-mono text-rose-400 font-bold uppercase tracking-wider drop-shadow-md">
              Warm Pool Peak
            </div>
            <div className="absolute bottom-2.5 left-3 text-[9px] font-mono text-cyan-300 font-bold uppercase tracking-wider drop-shadow-md flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-ping" />
              Upwelling Cold Reserve
            </div>
          </div>
        </div>

        {/* Diagnostic Metadata Panel */}
        <div className="md:col-span-4 space-y-4">
          <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5 space-y-3 font-mono text-xs">
            <h5 className="text-[10px] font-bold text-gray-400 tracking-wider uppercase border-b border-white/5 pb-1">
              Atmospheric Coupling Factors
            </h5>
            <div className="space-y-2">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-gray-400">Trade Configuration:</span>
                <span className="text-white text-right font-bold ml-2 ">{p.winds}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-gray-400">Rainfall Focus:</span>
                <span className="text-emerald-400 text-right font-bold ml-2">{p.rain}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span className="text-gray-400">Monsoonal Deficit:</span>
                <span className="text-red-400 text-right font-bold ml-2">{p.drought}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Thermocline State:</span>
                <span className="text-amber-400 text-right font-bold ml-2">{p.thermocline}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
