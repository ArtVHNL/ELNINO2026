import * as React from "react";
import { useState, useMemo } from "react";
import * as d3 from "d3";
import { GlassTooltip } from "./GlassTooltip";
import { ModelPlume } from "../data";

interface EnsemblePlumesChartProps {
  data: {
    months: string[];
    models: ModelPlume[];
    consensus: number[];
  };
}

export const EnsemblePlumesChart = React.memo(({ data }: EnsemblePlumesChartProps) => {
  const [hoverState, setHoverState] = useState<{
    mouseX: number;
    mouseY: number;
    index: number;
    visible: boolean;
  }>({ mouseX: 0, mouseY: 0, index: 0, visible: false });

  const { months, models, consensus } = data;

  const width = 420;
  const height = 280;
  const margin = { top: 20, right: 40, bottom: 45, left: 40 };

  const parsedMonths = useMemo(() => {
    return months.map(raw => {
      const parts = raw.split("-");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIdx = Math.max(0, Math.min(11, parseInt(parts[1]) - 1));
      return `${monthNames[mIdx]} '${parts[0].slice(2)}`;
    });
  }, [months]);

  const {
    xScale,
    yScale,
    envelopePath,
    modelPaths,
    consensusPath,
    ticksLeft,
    representativeTicks
  } = useMemo(() => {
    // Dynamic values check to prevent scale issues during La Nina scenario swaps (-val)
    const allVals = [
      ...consensus,
      ...models.flatMap(m => m.values)
    ];
    const yMin = Math.min(...allVals, -1.0) - 0.2;
    const yMax = Math.max(...allVals, 2.5) + 0.2;

    const xScale = d3.scaleLinear()
      .domain([0, months.length - 1])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([height - margin.bottom, margin.top]);

    // Envelope calculations
    const envelopeData = months.map((_, i) => {
      const vals = models.map(m => m.values[i]);
      return {
        x: i,
        vMin: Math.min(...vals),
        vMax: Math.max(...vals)
      };
    });

    const envelopeGenerator = d3.area<any>()
      .x(d => xScale(d.x))
      .y0(d => yScale(d.vMin))
      .y1(d => yScale(d.vMax))
      .curve(d3.curveCatmullRom);

    // Individual standard model line paths
    const lineGenerator = d3.line<number>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d))
      .curve(d3.curveCatmullRom);

    const modelPaths = models.map(m => ({
      name: m.name,
      path: lineGenerator(m.values) || ""
    }));

    const consensusPath = lineGenerator(consensus) || "";
    const ticksLeft = yScale.ticks(6);
    const representativeTicks = [0, 6, 12, 18, months.length - 1];

    return {
      xScale,
      yScale,
      envelopePath: envelopeGenerator(envelopeData) || "",
      modelPaths,
      consensusPath,
      ticksLeft,
      representativeTicks
    };
  }, [months, models, consensus]);

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * width;
    const mouseY = ((event.clientY - rect.top) / rect.height) * height;

    if (mouseX >= margin.left - 10 && mouseX <= width - margin.right + 10) {
      const pct = (mouseX - margin.left) / (width - margin.left - margin.right);
      const index = Math.min(months.length - 1, Math.max(0, Math.round(pct * (months.length - 1))));
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

  const colors = [
    "rgba(255, 78, 78, 0.45)",  // CFSv2
    "rgba(249, 115, 22, 0.45)", // ECMWF
    "rgba(129, 140, 248, 0.45)", // UKMO
    "rgba(45, 212, 191, 0.45)",  // GFDL
    "rgba(16, 185, 129, 0.45)",  // NASA
    "rgba(236, 72, 153, 0.45)",  // JMA
    "rgba(163, 163, 163, 0.45)"  // Statistical
  ];

  return (
    <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 space-y-4 shadow-2xl relative select-none">
      <div className="flex justify-between items-center border-b border-white/5 pb-2">
        <span className="text-[10px] font-sans font-bold text-gray-400 tracking-wider uppercase">
          Dynamic Forecast Ensemble Plumes
        </span>
        <span className="text-[9px] font-mono bg-[#111827] px-2 py-0.5 rounded text-gray-400 border border-white/5 uppercase">
          SST Niño 3.4 Projections
        </span>
      </div>

      <div className="w-full relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverState(prev => ({ ...prev, visible: false }))}
          className="w-full h-auto overflow-visible cursor-crosshair"
        >
          <defs>
            {/* Soft high-contrast glow filters */}
            <filter id="consensus-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          <g className="opacity-10">
            {ticksLeft.map((tickVal, i) => (
              <line
                key={i}
                x1={margin.left}
                y1={yScale(tickVal)}
                x2={width - margin.right}
                y2={yScale(tickVal)}
                stroke="#ffffff"
                strokeWidth="1"
                strokeDasharray="2, 4"
              />
            ))}
          </g>

          {/* Left Y Axis */}
          <g className="font-mono text-[8px] fill-gray-400">
            {ticksLeft.map((tickVal, i) => (
              <text
                key={i}
                x={margin.left - 8}
                y={yScale(tickVal) + 3}
                textAnchor="end"
              >
                {tickVal >= 0 ? `+${tickVal.toFixed(1)}°` : `${tickVal.toFixed(1)}°`}
              </text>
            ))}
          </g>

          {/* X Axis */}
          <g className="font-mono text-[8px] fill-gray-400">
            {representativeTicks.map((tickIdx, i) => (
              <text
                key={i}
                x={xScale(tickIdx)}
                y={height - margin.bottom + 14}
                textAnchor="middle"
              >
                {parsedMonths[tickIdx]}
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

          {/* Confidence Envelope Region */}
          <path
            d={envelopePath}
            fill="rgba(239, 68, 68, 0.06)"
          />

          {/* Threshold marker: Warm SSTA baseline (+1.5C) */}
          <line
            x1={margin.left}
            x2={width - margin.right}
            y1={yScale(1.5)}
            y2={yScale(1.5)}
            stroke="rgba(239, 68, 68, 0.35)"
            strokeWidth="1"
            strokeDasharray="3, 3"
          />
          <text
            x={width - margin.right - 5}
            y={yScale(1.5) - 4}
            textAnchor="end"
            className="fill-red-400 font-bold font-sans text-[8px] uppercase tracking-wider opacity-85"
          >
            Extreme Threshold (+1.5°C)
          </text>

          {/* Individual Model Plume Lines */}
          {modelPaths.map((mp, i) => (
            <path
              key={mp.name}
              d={mp.path}
              fill="none"
              stroke={colors[i] || "rgba(255,255,255,0.15)"}
              strokeWidth="1.2"
              className="hover:stroke-white transition-colors duration-150"
            />
          ))}

          {/* Glowing Lead Consensus Line */}
          <path
            d={consensusPath}
            fill="none"
            stroke="#ef4444"
            strokeWidth="3.0"
            strokeLinecap="round"
            filter="url(#consensus-glow)"
          />

          {/* Hover crosshairs */}
          {hoverState.visible && (
            <g>
              <line
                x1={xScale(hoverState.index)}
                y1={margin.top}
                x2={xScale(hoverState.index)}
                y2={height - margin.bottom}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
                strokeDasharray="3, 3"
              />
              <circle
                cx={xScale(hoverState.index)}
                cy={yScale(consensus[hoverState.index])}
                r="4.5"
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth="1.5"
                filter="drop-shadow(0 0 4px rgba(239, 68, 68, 0.8))"
              />
            </g>
          )}
        </svg>

        {/* Framing Motion GlassTooltip */}
        <GlassTooltip
          x={(hoverState.mouseX / width) * 100 + "%"}
          y={hoverState.mouseY - 20}
          visible={hoverState.visible}
        >
          <div className="space-y-1.5 min-w-[130px]">
            <div className="font-extrabold text-white text-[9px] border-b border-white/10 pb-1 uppercase tracking-widest">
              {parsedMonths[hoverState.index]} Projections
            </div>
            <div className="flex justify-between gap-4 font-bold text-red-400">
              <span>Mean Consensus:</span>
              <span>
                {consensus[hoverState.index] >= 0
                  ? `+${consensus[hoverState.index].toFixed(2)}°C`
                  : `${consensus[hoverState.index].toFixed(2)}°C`}
              </span>
            </div>
            <div className="text-[8px] text-gray-400 border-t border-white/5 pt-1 mt-1 font-light flex flex-col gap-1">
              {models.map((m, i) => (
                <div key={m.name} className="flex justify-between text-gray-450 gap-2">
                  <span>{m.name}:</span>
                  <span className="font-semibold text-gray-300">
                    {m.values[hoverState.index] >= 0
                      ? `+${m.values[hoverState.index].toFixed(1)}`
                      : `${m.values[hoverState.index].toFixed(1)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </GlassTooltip>
      </div>
    </div>
  );
});
