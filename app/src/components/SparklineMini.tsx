import { useMemo } from "react";
import * as d3 from "d3";

interface SparklineProps {
  data: { value: number }[];
  color: string;
  gradientId: string;
  reverse?: boolean;
}

export function SparklineMini({ data, color, gradientId, reverse = false }: SparklineProps) {
  const width = 240;
  const height = 40;
  const margin = { top: 3, right: 3, bottom: 3, left: 3 };

  const { linePath, areaPath, lastX, lastY } = useMemo(() => {
    if (!data || data.length === 0) {
      return { linePath: "", areaPath: "", lastX: 0, lastY: 0 };
    }

    const xScale = d3.scaleLinear()
      .domain([0, data.length - 1])
      .range([margin.left, width - margin.right]);

    const yExtent = d3.extent(data, d => d.value) as [number, number];
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - 0.1, yExtent[1] + 0.1])
      .range(reverse ? [margin.top, height - margin.bottom] : [height - margin.bottom, margin.top]);

    const lineGenerator = d3.line<any>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    const areaGenerator = d3.area<any>()
      .x((_, i) => xScale(i))
      .y0(height)
      .y1(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    const lastVal = data[data.length - 1];

    return {
      linePath: lineGenerator(data) || "",
      areaPath: areaGenerator(data) || "",
      lastX: xScale(data.length - 1),
      lastY: yScale(lastVal.value)
    };
  }, [data, reverse]);

  if (!data || data.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full text-xs opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Render Area fill */}
      <path d={areaPath} fill={`url(#${gradientId})`} />

      {/* Render Stroke line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" />

      {/* Trailing live value dot marker */}
      <circle
        cx={lastX}
        cy={lastY}
        r="2.5"
        fill={color}
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
      <circle cx={lastX} cy={lastY} r="6" fill="none" stroke={color} strokeWidth="1" opacity="0.5">
        <animate attributeName="r" values="3; 8; 3" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8; 0; 0.8" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
