import * as React from "react";
import { useState, useMemo } from "react";
import * as d3 from "d3";
import { GlassTooltip } from "./GlassTooltip";
import { Nino34Weekly, SoiMonthly } from "../data";

interface CoupledTimeSeriesChartProps {
  data: {
    nino34_weekly: Nino34Weekly[];
    soi_monthly: SoiMonthly[];
  };
}

export const CoupledTimeSeriesChart = React.memo(({ data }: CoupledTimeSeriesChartProps) => {
  const [hoverState, setHoverState] = useState<{
    mouseX: number;
    mouseY: number;
    index: number;
    visible: boolean;
  }>({ mouseX: 0, mouseY: 0, index: 0, visible: false });

  const ninoData = data.nino34_weekly;
  const soiData = data.soi_monthly;

  const width = 800;
  const height = 320;
  const margin = { top: 20, right: 65, bottom: 40, left: 65 };

  const timeLabels = [
    "Jun '25", "Jul '25", "Aug '25", "Sep '25", "Oct '25", "Nov '25", 
    "Dec '25", "Jan '26", "Feb '26", "Mar '26", "Apr '26", "May '26"
  ];

  // Mathematical Calculations
  const {
    xScale,
    yLeftScale,
    yRightScale,
    ninoPath,
    soiPath,
    couplingAreaPath,
    leftTicks,
    rightTicks
  } = useMemo(() => {
    const xScale = d3.scaleLinear()
      .domain([0, 11])
      .range([margin.left, width - margin.right]);

    // Left Y-axis: Niño 3.4 anomalies (domain from minimum to maximum data anomalies)
    const yLeftScale = d3.scaleLinear()
      .domain([-2.0, 3.5]) // fits both La Nina negative swings (-1.9C) and Super El Nino (+2.5C)
      .range([height - margin.bottom, margin.top]);

    // Right Y-axis: SOI atmospheric index (normally -25 to +25)
    const yRightScale = d3.scaleLinear()
      .domain([25, -25])
      .range([height - margin.bottom, margin.top]);

    // Niño Line generator with smooth CatmullRom curves
    const ninoLineGenerator = d3.line<Nino34Weekly | any>()
      .x((_, i) => xScale(i))
      .y(d => yLeftScale(d.value))
      .curve(d3.curveCatmullRom);

    // SOI Line generator
    const soiLineGenerator = d3.line<SoiMonthly | any>()
      .x((_, i) => xScale(i))
      .y(d => yRightScale(d.value))
      .curve(d3.curveCatmullRom);

    // Coupling Area between standard scales
    const mergedData = ninoData.map((d, i) => ({
      index: i,
      nino: d.value,
      soi: soiData[i] ? soiData[i].value : 0
    }));

    const couplingAreaGenerator = d3.area<any>()
      .x((_, i) => xScale(i))
      .y0(d => yLeftScale(d.nino))
      .y1(d => yRightScale(d.soi))
      .curve(d3.curveCatmullRom);

    const leftTicks = yLeftScale.ticks(6);
    const rightTicks = yRightScale.ticks(6);

    return {
      xScale,
      yLeftScale,
      yRightScale,
      ninoPath: ninoLineGenerator(ninoData) || "",
      soiPath: soiLineGenerator(soiData) || "",
      couplingAreaPath: couplingAreaGenerator(mergedData) || "",
      leftTicks,
      rightTicks
    };
  }, [ninoData, soiData]);

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    // Calculate accurate mouse position in viewBox system
    const mouseX = ((event.clientX - rect.left) / rect.width) * width;
    const mouseY = ((event.clientY - rect.top) / rect.height) * height;

    const leftBound = margin.left;
    const rightBound = width - margin.right;

    if (mouseX >= leftBound - 15 && mouseX <= rightBound + 15) {
      const pct = (mouseX - leftBound) / (rightBound - leftBound);
      const index = Math.min(11, Math.max(0, Math.round(pct * 11)));
      setHoverState({
        mouseX,
        mouseY,
        index,
        visible: true
      });
    } else {
      setHoverState(prev => ({ ...prev, visible: false }));
    }
  };

  const handleMouseLeave = () => {
    setHoverState(prev => ({ ...prev, visible: false }));
  };

  const activeNino = ninoData[hoverState.index];
  const activeSoi = soiData[hoverState.index];

  return (
    <div className="w-full relative overflow-visible bg-slate-950/40 p-5 rounded-2xl border border-white/5 shadow-2xl">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
          <h4 className="text-xs font-sans font-bold text-white tracking-wider uppercase">
            Atmosphere-Ocean Coupled Core Time Series (Niño 3.4 vs SOI)
          </h4>
        </div>
        <div className="flex items-center gap-4 text-[9px] font-mono">
          <span className="flex items-center gap-1.5 text-red-400 font-bold">
            <span className="h-0.5 w-3 bg-red-400" /> OCEAN ANOMALY
          </span>
          <span className="flex items-center gap-1.5 text-sky-400 font-bold">
            <span className="h-0.5 w-3 bg-sky-400" /> SOI ATMOSPHERE
          </span>
        </div>
      </div>

      <div className="w-full relative select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-auto overflow-visible cursor-crosshair"
        >
          <defs>
            {/* Soft glows and linear gradient fills */}
            <linearGradient id="couplingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.25" />
            </linearGradient>
            <filter id="glowNino">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glowSoi">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grids and Axes */}
          <g className="opacity-10">
            {leftTicks.map((tickVal, i) => (
              <line
                key={i}
                x1={margin.left}
                y1={yLeftScale(tickVal)}
                x2={width - margin.right}
                y2={yLeftScale(tickVal)}
                stroke="#ffffff"
                strokeWidth="1"
                strokeDasharray="2, 4"
              />
            ))}
          </g>

          {/* Left Y-axis (ticks and labels) */}
          <g className="font-mono text-[9px] fill-red-400/80">
            {leftTicks.map((tickVal, i) => (
              <text
                key={i}
                x={margin.left - 10}
                y={yLeftScale(tickVal) + 3}
                textAnchor="end"
                className="font-bold"
              >
                {tickVal > 0 ? `+${tickVal.toFixed(1)}°C` : `${tickVal.toFixed(1)}°C`}
              </text>
            ))}
            <text
              transform="rotate(-90)"
              y={18}
              x={-height / 2}
              textAnchor="middle"
              className="font-sans text-[9px] font-bold tracking-widest uppercase fill-red-400"
            >
              Nino 3.4 SSTA (°C)
            </text>
          </g>

          {/* Right Y-axis (ticks and labels) */}
          <g className="font-mono text-[9px] fill-sky-400/80">
            {rightTicks.map((tickVal, i) => (
              <text
                key={i}
                x={width - margin.right + 10}
                y={yRightScale(tickVal) + 3}
                textAnchor="start"
                className="font-bold"
              >
                {tickVal > 0 ? `+${tickVal}` : `${tickVal}`}
              </text>
            ))}
            <text
              transform="rotate(90)"
              y={-width + 18}
              x={height / 2}
              textAnchor="middle"
              className="font-sans text-[9px] font-bold tracking-widest uppercase fill-sky-400"
            >
              Atmospheric SOI
            </text>
          </g>

          {/* Bottom X-axis */}
          <g className="font-mono text-[9px] fill-gray-400">
            {timeLabels.map((lbl, i) => (
              <text
                key={i}
                x={xScale(i)}
                y={height - margin.bottom + 18}
                textAnchor="middle"
              >
                {lbl}
              </text>
            ))}
            <line
              x1={margin.left}
              y1={height - margin.bottom}
              x2={width - margin.right}
              y2={height - margin.bottom}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
            />
          </g>

          {/* Shaded Coupling Feedback Region Area */}
          <path
            d={couplingAreaPath}
            fill="url(#couplingGrad)"
            opacity="0.12"
          />

          {/* Lines paths with glow filters */}
          <path
            d={soiPath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#glowSoi)"
          />

          <path
            d={ninoPath}
            fill="none"
            stroke="#ef4444"
            strokeWidth="3.0"
            strokeLinecap="round"
            filter="url(#glowNino)"
          />

          {/* Active Hover Crosshairs & Dots */}
          {hoverState.visible && (
            <g>
              <line
                x1={xScale(hoverState.index)}
                y1={margin.top}
                x2={xScale(hoverState.index)}
                y2={height - margin.bottom}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1.5"
                strokeDasharray="3, 3"
              />
              {/* Nino intersection circle */}
              <circle
                cx={xScale(hoverState.index)}
                cy={yLeftScale(activeNino.value)}
                r="5"
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth="1.5"
                filter="drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))"
              />
              {/* SOI intersection circle */}
              <circle
                cx={xScale(hoverState.index)}
                cy={yRightScale(activeSoi.value)}
                r="5"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="1.5"
                filter="drop-shadow(0 0 6px rgba(56, 189, 248, 0.8))"
              />
            </g>
          )}
        </svg>

        {/* Framing motion GlassTooltip */}
        <GlassTooltip
          x={(hoverState.mouseX / width) * 100 + "%"}
          y={hoverState.mouseY - 25}
          visible={hoverState.visible}
        >
          {activeNino && activeSoi && (
            <div className="space-y-2">
              <div className="font-extrabold text-white text-[10px] border-b border-white/10 pb-1 mb-1 tracking-widest uppercase">
                {timeLabels[hoverState.index]} REPORT
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-400">Niño 3.4 SSTA:</span>
                <strong className={activeNino.value >= 0.5 ? "text-red-400" : "text-sky-400"}>
                  {activeNino.value >= 0 ? `+${activeNino.value.toFixed(2)}°C` : `${activeNino.value.toFixed(2)}°C`}
                </strong>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-400">Zonal SOI:</span>
                <strong className={activeSoi.value <= -8 ? "text-amber-500" : "text-emerald-400"}>
                  {activeSoi.value.toFixed(1)}
                </strong>
              </div>
              <div className="text-[8px] text-gray-400 border-t border-white/5 pt-1 mt-1 font-light italic text-center">
                {activeNino.value >= 1.5 && activeSoi.value <= -10 
                  ? "Strong Coupled State" 
                  : "Normal Ocean Coupled Status"}
              </div>
            </div>
          )}
        </GlassTooltip>
      </div>
    </div>
  );
});
