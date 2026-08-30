import * as React from "react";
import { useState, useMemo } from "react";
import * as d3 from "d3";
import { GlassTooltip } from "./GlassTooltip";

interface HovmollerDiagramProps {
  chartData: {
    lon: number[];
    depth: number[];
    lat: number[];
    months?: string[];
    anomaly: number[][][] | number[][];
    thermocline_depth?: (number | null)[][];
  };
}

export const HovmollerDiagram = React.memo(({ chartData }: HovmollerDiagramProps) => {
  const [hoverState, setHoverState] = useState<{
    mouseX: number;
    mouseY: number;
    lonVal: number;
    depthVal: number;
    anomalyVal: number;
    visible: boolean;
  }>({ mouseX: 0, mouseY: 0, lonVal: 0, depthVal: 0, anomalyVal: 0, visible: false });

  const { lon: lons, depth: depths } = chartData;

  // Pipeline v3 stores [month][depth][lon]; select the latest month for display
  const is3D = Array.isArray(chartData.anomaly?.[0]?.[0]);
  const monthIdx = is3D ? (chartData.anomaly as number[][][]).length - 1 : 0;
  const anomaly: number[][] = is3D
    ? (chartData.anomaly as number[][][])[monthIdx]
    : (chartData.anomaly as number[][]);
  const monthLabel = is3D ? chartData.months?.[monthIdx] : undefined;
  const thermo = is3D && chartData.thermocline_depth
    ? chartData.thermocline_depth[monthIdx]
    : undefined;

  const width = 600;
  const height = 300;
  const margin = { top: 20, right: 35, bottom: 45, left: 45 };

  const rawXScale = useMemo(() => d3.scaleLinear()
    .domain([Math.min(...lons), Math.max(...lons)])
    .range([margin.left, width - margin.right]), [lons]);
  const rawYScale = useMemo(() => d3.scaleLinear()
    .domain([Math.min(...depths), Math.max(...depths)])
    .range([margin.top, height - margin.bottom]), [depths]);
  const xScaleSafe = (v: number) => rawXScale(v);
  const yScaleSafe = (v: number) => rawYScale(v);

  // Thermocline polyline (skip null segments)
  const thermoPath = useMemo(() => {
    if (!thermo) return "";
    const pts: string[] = [];
    thermo.forEach((d, i) => {
      if (d === null || d === undefined) return;
      const x = xScaleSafe(lons[i]);
      const y = yScaleSafe(d);
      pts.push(pts.length === 0 ? `M${x},${y}` : `L${x},${y}`);
    });
    return pts.join(" ");
  }, [thermo, lons]);

  const {
    xScale,
    yScale,
    colorScale,
    cells,
    contourPathsStr,
    isothermLabels,
    lonTicks,
    depthTicks
  } = useMemo(() => {
    const xScale = rawXScale;
    const yScale = rawYScale;

    const colorScale = d3.scaleDiverging<string>(d => {
      if (d < 0.5) {
        const t = d * 2;
        return d3.interpolateLab("#3B82F6", "#0f172a")(t); // deep blue to background dark
      } else {
        const t = (d - 0.5) * 2;
        return d3.interpolateLab("#0f172a", "#FF4E4E")(t); // back dark to deep crimson
      }
    }).domain([-3.0, 0.0, 6.0]);

    const cellSizeX = (width - margin.left - margin.right) / lons.length;
    const cellSizeY = (height - margin.top - margin.bottom) / depths.length;

    // Precalculate cells
    const cells: any[] = [];
    depths.forEach((dVal, dIdx) => {
      const row = anomaly[dIdx] || [];
      row.forEach((aVal, lIdx) => {
        const lVal = lons[lIdx];
        cells.push({
          x: xScale(lVal) - cellSizeX / 2,
          y: yScale(dVal) - cellSizeY / 2,
          w: cellSizeX + 0.3,
          h: cellSizeY + 0.3,
          fill: colorScale(aVal),
          lon: lVal,
          depth: dVal,
          anomaly: aVal
        });
      });
    });

    // Compute isotherms at +1.0°C, +2.0°C, and +3.0°C thresholds
    const gridWidth = lons.length;
    const gridHeight = depths.length;
    const flatGrid: number[] = [];
    for (let d = 0; d < gridHeight; d++) {
      for (let l = 0; l < gridWidth; l++) {
        flatGrid.push(anomaly[d][l] || 0);
      }
    }

    const contoursGenerator = d3.contours()
      .size([gridWidth, gridHeight])
      .thresholds([1.0, 2.0, 3.0]);

    const contoursList = contoursGenerator(flatGrid);

    const geoTransformPath = d3.geoPath()
      .projection(d3.geoTransform({
        point: function(x, y) {
          const lIdx = Math.max(0, Math.min(gridWidth - 1, Math.round(x)));
          const dIdx = Math.max(0, Math.min(gridHeight - 1, Math.round(y)));
          const lonVal = lons[lIdx];
          const depthVal = depths[dIdx];
          this.stream.point(xScale(lonVal), yScale(depthVal));
        }
      }));

    const contourPathsStr = contoursList.map((contour, i) => ({
      d: geoTransformPath(contour) || "",
      threshold: contour.value
    }));

    // Find isotope label heights at midpoint 200°E Longitude
    const midLonIdx = lons.indexOf(200) >= 0 ? lons.indexOf(200) : Math.floor(lons.length / 2);
    const midLonVal = lons[midLonIdx];

    const isothermLabels = [1.0, 2.0, 3.0].map(threshold => {
      let closestDepthIdx = 0;
      let minDiff = 999;
      depths.forEach((_, dIdx) => {
        const val = anomaly[dIdx][midLonIdx] || 0;
        const diff = Math.abs(val - threshold);
        if (diff < minDiff) {
          minDiff = diff;
          closestDepthIdx = dIdx;
        }
      });
      return {
        text: `+${threshold}°C Isotherm`,
        x: xScale(midLonVal),
        y: yScale(depths[closestDepthIdx]) - 5
      };
    });

    return {
      xScale,
      yScale,
      colorScale,
      cells,
      contourPathsStr,
      isothermLabels,
      lonTicks: xScale.ticks(8),
      depthTicks: yScale.ticks(6)
    };
  }, [lons, depths, anomaly]);

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * width;
    const mouseY = ((event.clientY - rect.top) / rect.height) * height;

    if (
      mouseX >= margin.left &&
      mouseX <= width - margin.right &&
      mouseY >= margin.top &&
      mouseY <= height - margin.bottom
    ) {
      // Invert scales to retrieve indices
      const hoveredLon = xScale.invert(mouseX);
      const hoveredDepth = yScale.invert(mouseY);

      // Find closest indices
      let closestLonIdx = 0;
      let minLonDiff = 999;
      lons.forEach((l, i) => {
        const diff = Math.abs(l - hoveredLon);
        if (diff < minLonDiff) {
          minLonDiff = diff;
          closestLonIdx = i;
        }
      });

      let closestDepthIdx = 0;
      let minDepthDiff = 999;
      depths.forEach((d, i) => {
        const diff = Math.abs(d - hoveredDepth);
        if (diff < minDepthDiff) {
          minDepthDiff = diff;
          closestDepthIdx = i;
        }
      });

      const lonVal = lons[closestLonIdx];
      const depthVal = depths[closestDepthIdx];
      const anomalyVal = anomaly[closestDepthIdx]?.[closestLonIdx] || 0;

      setHoverState({
        mouseX,
        mouseY,
        lonVal,
        depthVal,
        anomalyVal,
        visible: true
      });
    } else {
      setHoverState(prev => ({ ...prev, visible: false }));
    }
  };

  return (
    <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 space-y-4 shadow-2xl relative select-none">
      <div className="flex justify-between items-center border-b border-white/5 pb-2">
        <span className="text-[10px] font-sans font-bold text-gray-400 tracking-wider uppercase">
          Oceanic Subsurface Thermal Profile
        </span>
        <span className="text-[9px] font-mono bg-[#111827] px-2 py-0.5 rounded text-gray-400 border border-white/5 uppercase">
          120°E To 80°W Transect{monthLabel ? ` · ${monthLabel}` : ""}
        </span>
      </div>

      <div className="w-full relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverState(prev => ({ ...prev, visible: false }))}
          className="w-full h-auto overflow-visible cursor-crosshair pb-2"
        >
          {/* Crisp rendering cell boxes */}
          <g shapeRendering="crispEdges">
            {cells.map((cell, idx) => (
              <rect
                key={idx}
                x={cell.x}
                y={cell.y}
                width={cell.w}
                height={cell.h}
                fill={cell.fill}
              />
            ))}
          </g>

          {/* Draw Isotherm Paths overlays */}
          <g fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1" strokeDasharray="2, 4">
            {contourPathsStr.map((contour, idx) => (
              <path key={idx} d={contour.d} />
            ))}
          </g>

          {/* Thermocline (20°C isotherm depth) overlay */}
          {thermoPath && (
            <g fill="none">
              <path d={thermoPath} stroke="#f59e0b" strokeWidth="1.6" strokeDasharray="5, 3" opacity="0.85" />
              <text
                x={width - margin.right - 4}
                y={12}
                textAnchor="end"
                className="text-[8px] font-mono fill-amber-400/90 font-bold"
              >
                thermocline (20°C)
              </text>
            </g>
          )}

          {/* Isotherm Labels */}
          {isothermLabels.map((lbl, idx) => (
            <text
              key={idx}
              x={lbl.x}
              y={lbl.y}
              className="text-[8px] font-mono fill-white/80 select-none pointer-events-none font-bold"
              textAnchor="middle"
            >
              {lbl.text}
            </text>
          ))}

          {/* Axes */}
          <g className="font-mono text-[8px] fill-gray-400">
            {lonTicks.map((tk, i) => (
              <text key={i} x={xScale(tk)} y={height - margin.bottom + 14} textAnchor="middle">
                {tk}°E
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

          <g className="font-mono text-[8px] fill-gray-400">
            {depthTicks.map((tk, i) => (
              <text key={i} x={margin.left - 8} y={yScale(tk) + 3} textAnchor="end">
                {tk}m
              </text>
            ))}
          </g>

          {/* Axis Labels */}
          <text
            x={width / 2}
            y={height - 8}
            className="fill-slate-500 font-sans text-[8px] tracking-wider uppercase text-center font-bold"
            textAnchor="middle"
          >
            Pacific Equatorial Longitude Transect (Australia 120°E to Galapagos 80°W)
          </text>

          <text
            transform="rotate(-90)"
            y={12}
            x={-height / 2}
            className="fill-slate-500 font-sans text-[8px] tracking-wider uppercase font-bold"
            textAnchor="middle"
          >
            Ocean Depth (Meters)
          </text>

          {/* Hover Tracker crosshairs */}
          {hoverState.visible && (
            <g>
              <line
                x1={xScale(hoverState.lonVal)}
                y1={margin.top}
                x2={xScale(hoverState.lonVal)}
                y2={height - margin.bottom}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1"
                strokeDasharray="2, 2"
              />
              <line
                x1={margin.left}
                y1={yScale(hoverState.depthVal)}
                x2={width - margin.right}
                y2={yScale(hoverState.depthVal)}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1"
                strokeDasharray="2, 2"
              />
              <rect
                x={xScale(hoverState.lonVal) - 4}
                y={yScale(hoverState.depthVal) - 4}
                width="8"
                height="8"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
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
          <div className="space-y-1.5 min-w-[155px]">
            <div className="font-extrabold text-white text-[9px] border-b border-white/10 pb-0.5 uppercase tracking-widest text-amber-500">
              Depth Telemetry Model
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Longitude:</span>
              <strong className="text-white">{hoverState.lonVal}°E</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Water Depth:</span>
              <strong className="text-white">{hoverState.depthVal} meters</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">SST Anomaly:</span>
              <strong className={hoverState.anomalyVal >= 0.5 ? "text-red-400" : hoverState.anomalyVal <= -0.5 ? "text-sky-400" : "text-slate-350"}>
                {hoverState.anomalyVal >= 0 
                  ? `+${hoverState.anomalyVal.toFixed(2)}°C` 
                  : `${hoverState.anomalyVal.toFixed(2)}°C`}
              </strong>
            </div>
          </div>
        </GlassTooltip>
      </div>
    </div>
  );
});
